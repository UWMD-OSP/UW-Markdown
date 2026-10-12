import type { AssetClass, UWAssetClassId } from './types.js';
import { ASSET_CLASSES, toBuiltinAssetClass } from './types.js';
import type { ModuleAssetClassDecl, ModuleManifest, ProtocolError } from './protocol.js';
import type { ModuleRegistry } from './modules.js';

/**
 * `segment('.' segment){2,}` where `segment := [a-z][a-z0-9_]*`.
 *
 * Three segments minimum, not two: `com.data_center` reads as a namespace with
 * no owner, and two segments is where squatting on a short prefix starts to
 * look attractive.
 */
const CUSTOM_ASSET_CLASS = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/;

export type AssetClassKind = 'builtin' | 'custom';

export type AssetClassIdentity =
  | { ok: true; kind: 'builtin'; id: AssetClass }
  | { ok: true; kind: 'custom'; id: string; namespace: string; name: string }
  | { ok: false; error: ProtocolError };

function invalid(code: string, message: string, remediation: string): AssetClassIdentity {
  return {
    ok: false,
    error: {
      category: 'validate',
      code,
      message,
      pointer: 'frontmatter.asset_class',
      remediation,
    },
  };
}

/**
 * Classify an asset-class identifier.
 *
 * Total: returns a typed error rather than throwing, because this runs on
 * every parse and a malformed identifier is a document defect to report, not
 * an exception to propagate.
 */
export function parseAssetClass(raw: string): AssetClassIdentity {
  const builtin = toBuiltinAssetClass(raw);
  if (builtin) {
    return { ok: true, kind: 'builtin', id: builtin };
  }

  if (!CUSTOM_ASSET_CLASS.test(raw)) {
    return invalid(
      'INVALID-ASSET-CLASS-001',
      `'${raw}' is neither a builtin asset class nor a valid namespaced identifier.`,
      `Use one of ${ASSET_CLASSES.join(', ')}, or a reverse-DNS identifier of at least three lower-snake-case segments (e.g. 'com.example.specialty_facility').`,
    );
  }

  const segments = raw.split('.');
  const name = segments[segments.length - 1] as string;

  // A namespaced identifier ending in a builtin name is refused. The namespace
  // already prevents *collision*, so this is stricter than correctness
  // requires — but `com.example.multifamily` invites exactly the ambiguity the
  // closed enum exists to remove, and any host doing suffix matching (which is
  // a host bug, and one that will happen) would conflate the two.
  // `com.example.multifamily_senior` remains available and says more.
  if ((ASSET_CLASSES as readonly string[]).includes(name)) {
    return invalid(
      'INVALID-ASSET-CLASS-002',
      `'${raw}' ends in the reserved builtin name '${name}'.`,
      `Rename the final segment so it does not shadow a builtin (e.g. '${raw}_specialty').`,
    );
  }

  return {
    ok: true,
    kind: 'custom',
    id: raw,
    namespace: segments.slice(0, -1).join('.'),
    name,
  };
}

/** True when `raw` is a well-formed custom identifier (not a builtin). */
export function isCustomAssetClass(raw: string): boolean {
  const parsed = parseAssetClass(raw);
  return parsed.ok && parsed.kind === 'custom';
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export type AssetClassResolution =
  /** A builtin, or a custom class whose declaring module is loaded. */
  | { status: 'resolved'; kind: AssetClassKind; id: string; declaration?: ModuleAssetClassDecl }
  /**
   * The declaring module is absent but the file names a fallback-capable
   * declaration this host already holds. Renderable, and MUST be reported as
   * degraded rather than presented as a full read.
   */
  | { status: 'degraded'; id: string; fallback: AssetClass; issue: ProtocolError }
  /** Neither the module nor a fallback. */
  | { status: 'unresolved'; id: string; issue: ProtocolError };

export interface ResolveAssetClassOptions {
  /**
   * Declarations this host holds independently of the registry — a fallback
   * table an operator configured, or declarations cached from a module that is
   * no longer loaded. Consulted only for the fallback path: a host MUST NOT
   * treat a cached declaration as though the module were loaded, because the
   * module's calcs and validations are what "loaded" means.
   */
  knownDeclarations?: readonly ModuleAssetClassDecl[];
}

/**
 * Resolve a document's asset class against a module registry.
 *
 * Determinism is the whole contract, and it holds in all three outcomes:
 * every host with the module resolves identically, every host without one and
 * with a fallback degrades identically, and every host with neither fails
 * identically. There is no arrangement in which two conforming hosts read the
 * same file differently.
 */
export function resolveAssetClass(
  raw: string,
  registry: ModuleRegistry | null,
  options: ResolveAssetClassOptions = {},
): AssetClassResolution {
  const identity = parseAssetClass(raw);
  if (!identity.ok) return { status: 'unresolved', id: raw, issue: identity.error };
  if (identity.kind === 'builtin') return { status: 'resolved', kind: 'builtin', id: identity.id };

  const loaded = registry ? findDeclaration(registry, raw) : undefined;
  if (loaded) {
    return { status: 'resolved', kind: 'custom', id: raw, declaration: loaded };
  }

  const known = options.knownDeclarations?.find((d) => d.id === raw);
  if (known?.fallback) {
    return {
      status: 'degraded',
      id: raw,
      fallback: known.fallback,
      issue: {
        category: 'module',
        code: 'MOD-FALLBACK-001',
        message: `Asset class '${raw}' is declared by a module this host has not loaded; rendering with the '${known.fallback}' fallback.`,
        pointer: 'frontmatter.asset_class',
        remediation: `Load the declaring module to read this document fully. Values shown come from '${known.fallback}' view models and may omit what the custom class adds.`,
      },
    };
  }

  return {
    status: 'unresolved',
    id: raw,
    issue: {
      category: 'module',
      code: 'MOD-MISSING-001',
      message: `Asset class '${raw}' is declared by a module this host has not loaded, and no fallback is available.`,
      pointer: 'frontmatter.asset_class',
      remediation: `Load the module that declares '${raw}'. The document's frontmatter 'modules' list names it.`,
    },
  };
}

/** Every custom class the loaded modules declare, keyed by id. */
export function declaredAssetClasses(
  registry: ModuleRegistry,
): ReadonlyMap<string, ModuleAssetClassDecl> {
  const out = new Map<string, ModuleAssetClassDecl>();
  for (const manifest of registry.modules) {
    for (const decl of manifest.declares_asset_classes ?? []) {
      // First declaration wins, and a second is reported by
      // `assetClassDeclarationConflicts` rather than silently overwriting —
      // last-write-wins would make resolution depend on registry order.
      if (!out.has(decl.id)) out.set(decl.id, decl);
    }
  }
  return out;
}

/**
 * Two loaded modules declaring the same identifier, or the same display name.
 *
 * The identifier case is a genuine conflict: reverse-DNS says one owner, so
 * two declarations mean one module is squatting. The display-name case is
 * cosmetic and reported at `info` — two unrelated verticals both calling
 * something "Data Center" is confusing for a reader, not wrong for a machine.
 */
export function assetClassDeclarationConflicts(registry: ModuleRegistry): ProtocolError[] {
  const issues: ProtocolError[] = [];
  const byId = new Map<string, string>();
  const byDisplayName = new Map<string, string>();

  for (const manifest of registry.modules) {
    for (const decl of manifest.declares_asset_classes ?? []) {
      const priorId = byId.get(decl.id);
      if (priorId !== undefined && priorId !== manifest.id) {
        issues.push({
          category: 'module',
          code: 'MOD-ASSET-CLASS-CONFLICT-001',
          message: `Modules '${priorId}' and '${manifest.id}' both declare asset class '${decl.id}'. A reverse-DNS identifier names one owner.`,
          pointer: 'declares_asset_classes',
          remediation: 'Load only one of the two modules, or ask the second to declare an identifier inside its own namespace.',
        });
      } else if (priorId === undefined) {
        byId.set(decl.id, manifest.id);
      }

      const priorName = byDisplayName.get(decl.display_name);
      if (priorName !== undefined && priorName !== decl.id) {
        issues.push({
          category: 'module',
          code: 'MOD-DISPLAY-CONFLICT-001',
          message: `Asset classes '${priorName}' and '${decl.id}' share the display name '${decl.display_name}'.`,
          pointer: 'declares_asset_classes',
          remediation: 'Disambiguate one display name, or show the identifier alongside it. Machine behavior is unaffected.',
        });
      } else if (priorName === undefined) {
        byDisplayName.set(decl.display_name, decl.id);
      }
    }
  }
  return issues;
}

/**
 * Module ids a document says it depends on: the object-list spelling of
 * Format §2.2a (`- id: <module>`) only (RFC 0081 §5). A bare-string entry
 * names nothing, and no id is special: an `org.uwmd.*` entry is an ordinary
 * dependency like any other.
 *
 * A file whose `asset_class` is namespaced MUST list them (§X.2), so that a
 * host encountering an identifier it cannot resolve can say *what to load*
 * rather than only that something is missing.
 */
export function declaredModuleDependencies(
  frontmatter: Record<string, unknown>,
): { id: string; version?: string }[] {
  const out: { id: string; version?: string }[] = [];
  for (const entry of moduleListEntries(frontmatter)) if (entry.dependency) out.push(entry.dependency);
  return out;
}

/**
 * Every frontmatter `modules` entry with what it declares. An entry is an
 * object with a string `id` (Format §2.2a). The Appendix D frontmatter subset
 * reads a sequence item as a scalar, so the object spelling can arrive as its
 * `id: <module>` line; that reads too. Anything else (a bare module id, a
 * number, an object without `id`) declares nothing, and the validator reports
 * it rather than dropping it silently.
 */
export function moduleListEntries(
  frontmatter: Record<string, unknown>,
): { index: number; value: unknown; dependency: { id: string; version?: string } | null }[] {
  const raw = frontmatter['modules'];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    if (typeof entry === 'string') {
      const id = /^id:\s*(\S+)$/.exec(entry)?.[1];
      return { index, value: entry, dependency: id !== undefined ? { id } : null };
    }
    if (typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string') {
      const record = entry as { id: string; version?: unknown };
      return {
        index,
        value: entry,
        dependency: { id: record.id, ...(typeof record.version === 'string' ? { version: record.version } : {}) },
      };
    }
    return { index, value: entry, dependency: null };
  });
}

function findDeclaration(
  registry: ModuleRegistry,
  id: string,
): ModuleAssetClassDecl | undefined {
  for (const manifest of registry.modules as readonly ModuleManifest[]) {
    const found = manifest.declares_asset_classes?.find((d) => d.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Re-exported for callers that only need the wider identifier type. */
export type { UWAssetClassId };
