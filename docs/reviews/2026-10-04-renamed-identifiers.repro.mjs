// Reproduces every finding in 2026-10-04-renamed-identifiers.md (issue #263).
// Run from the repository root after `npm run build`:
//   node docs/reviews/2026-10-04-renamed-identifiers.repro.mjs
// Prints one JSON line per probe. Exits 1 if any finding no longer reproduces,
// so a later change shows up as a changed result, not a silent pass.
// Every identifier here is synthetic; the old/new namespaces mirror the issue.
import { readFileSync } from 'node:fs';
import {
  assetClassDeclarationConflicts,
  createModuleRegistry,
  evaluateModuleCalculations,
  loadModuleManifest,
  ModuleRegistryError,
  parseUWFile,
  resolveAssetClass,
  validateUWFile,
} from '../../packages/uwmd-core/dist/index.js';

const OLD_MODULE = 'com.example-old.datacenters';
const NEW_MODULE = 'com.example-new.datacenters';
const OLD_CLASS = 'com.example_old.data_center';
const NEW_CLASS = 'com.example_new.data_center';

// The RFC 0003 fixture deal, with its asset_class and modules list rewritten.
const fixture = readFileSync('conformance/modules/asset-classes/01-module-loaded/deal.uwx.md', 'utf8');
const deal = (assetClass, moduleId) =>
  fixture
    .replace(/^asset_class: .*$/m, `asset_class: ${assetClass}`)
    .replace(/^ {2}- id: .*$/m, `  - id: ${moduleId}`);

const manifest = (id, classes, extra = {}) => ({
  manifest_version: '1',
  id,
  name: 'Data Center Module',
  version: '1.4.0',
  description: 'Synthetic module for the renamed-identifier review.',
  authors: ['UW Markdown contributors'],
  license: 'MIT',
  requires_protocol: '>=2.0.0',
  requires_format: '>=1.0',
  requires_tier: 'tier-3-calc-host',
  declares_asset_classes: classes.map((c) => ({ id: c, display_name: 'Data Center', fallback: 'industrial' })),
  calculations: [{ id: 'dc_probe', label: 'Probe', formula: '1 + 1', deterministic: true }],
  ...extra,
});

const registry = (...manifests) => createModuleRegistry({ modules: manifests });
const refusal = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof ModuleRegistryError ? err.errors.map((e) => e.code) : String(err);
  }
};

const results = [];
const probe = (finding, observed, reproduces) => {
  results.push(reproduces);
  console.log(JSON.stringify({ finding, reproduces, ...observed }));
};

// F1. Renaming only the MODULE id leaves an old document resolved. The
// document's `modules` list is never consulted for resolution (§X.2.2); the
// issue's "MOD-MISSING-001 for this document" does not reproduce.
{
  const doc = deal(OLD_CLASS, OLD_MODULE);
  const reg = registry(manifest(NEW_MODULE, [OLD_CLASS]));
  const resolution = resolveAssetClass(OLD_CLASS, reg);
  const calcs = evaluateModuleCalculations(parseUWFile(doc), reg).map((o) => `${o.module_id}:${o.result.ok}`);
  const codes = validateUWFile(parseUWFile(doc)).issues?.map((i) => i.code) ?? [];
  probe(
    'F1 module id renamed, class id kept',
    { status: resolution.status, calcs, mod_codes: codes.filter((c) => c.startsWith('MOD-')) },
    resolution.status === 'resolved' && calcs.length === 1 && !codes.some((c) => c.startsWith('MOD-')),
  );
}

// F2. Renaming the ASSET-CLASS id is what breaks an old document.
{
  const reg = registry(manifest(NEW_MODULE, [NEW_CLASS]));
  const resolution = resolveAssetClass(OLD_CLASS, reg);
  const calcs = evaluateModuleCalculations(parseUWFile(deal(OLD_CLASS, OLD_MODULE)), reg);
  probe(
    'F2 class id renamed',
    { status: resolution.status, code: resolution.issue?.code, module_calcs_run: calcs.length },
    resolution.status === 'unresolved' && resolution.issue?.code === 'MOD-MISSING-001' && calcs.length === 0,
  );
}

// F3. One module declaring both class ids resolves old and new documents and
// runs the same calculations for both, with no spec change. The only side
// effect is an info-level display-name report, which fires inside one module.
{
  const reg = registry(manifest(NEW_MODULE, [NEW_CLASS, OLD_CLASS]));
  const statuses = [OLD_CLASS, NEW_CLASS].map((c) => resolveAssetClass(c, reg).status);
  const calcs = [OLD_CLASS, NEW_CLASS].map(
    (c) => evaluateModuleCalculations(parseUWFile(deal(c, NEW_MODULE)), reg).length,
  );
  const conflicts = assetClassDeclarationConflicts(reg).map((e) => e.code);
  probe(
    'F3 one module declares old and new class ids',
    { statuses, calcs, conflicts },
    statuses.every((s) => s === 'resolved') &&
      calcs.every((n) => n === 1) &&
      conflicts.length === 1 &&
      conflicts[0] === 'MOD-DISPLAY-CONFLICT-001',
  );
}

// F4. Nothing states that the two class ids are one class: each resolves to
// its own declaration and reports its own id.
{
  const reg = registry(manifest(NEW_MODULE, [NEW_CLASS, OLD_CLASS]));
  const oldRes = resolveAssetClass(OLD_CLASS, reg);
  const newRes = resolveAssetClass(NEW_CLASS, reg);
  probe(
    'F4 dual declaration states no equivalence',
    { old_id: oldRes.id, old_decl: oldRes.declaration?.id, new_id: newRes.id, new_decl: newRes.declaration?.id },
    oldRes.declaration?.id === OLD_CLASS && newRes.declaration?.id === NEW_CLASS,
  );
}

// F5. A dependent module's `depends_on` names a module by exact id, so a
// dependent still naming the old id refuses to load against the renamed one.
{
  const dependent = {
    ...manifest('com.example-new.datacenters_addon', []),
    declares_asset_classes: undefined,
    calculations: undefined,
    depends_on: [{ id: OLD_MODULE, version: '>=1.0.0 <2.0.0' }],
  };
  delete dependent.declares_asset_classes;
  delete dependent.calculations;
  const codes = refusal(() => registry(manifest(NEW_MODULE, [NEW_CLASS]), dependent));
  probe('F5 depends_on names the old module id', { codes }, Array.isArray(codes) && codes.includes('PROTO-MOD-027'));
}

// F6. Loading the old and new module side by side reports the double claim
// on the class.
{
  const noCalcs = (id) => {
    const m = manifest(id, [OLD_CLASS]);
    delete m.calculations;
    return m;
  };
  const classConflicts = assetClassDeclarationConflicts(registry(noCalcs(OLD_MODULE), noCalcs(NEW_MODULE))).map(
    (e) => e.code,
  );
  probe(
    'F6 old and new module loaded together',
    { class_conflicts: classConflicts },
    classConflicts.includes('MOD-ASSET-CLASS-CONFLICT-001'),
  );
}

// R1 (related defect, outside #263; fixed after this review). Protocol
// §VII.3: two unrelated modules declaring the same calculation id MUST refuse
// the second. The registry once loaded both and let registry order decide the
// threaded value; it now refuses with PROTO-MOD-081 in either order.
{
  const a = manifest(OLD_MODULE, []);
  const b = manifest(NEW_MODULE, []);
  delete a.declares_asset_classes;
  delete b.declares_asset_classes;
  const forward = refusal(() => registry(a, b));
  const reverse = refusal(() => registry(b, a));
  probe(
    'R1 duplicate calculation id across unrelated modules is refused',
    { forward, reverse },
    Array.isArray(forward) && forward.includes('PROTO-MOD-081') && Array.isArray(reverse) && reverse.includes('PROTO-MOD-081'),
  );
}

// F7. A manifest carrying a field today's schema does not define is refused
// whole (additionalProperties: false, PROTO-MOD-064). A renamed module that
// adds any new identity field is unloadable on every host older than the
// release that defines it.
{
  const r = loadModuleManifest(manifest(NEW_MODULE, [NEW_CLASS], { previous_ids: [OLD_MODULE] }));
  const codes = r.errors.map((e) => e.code);
  probe('F7 unknown manifest field refuses the manifest', { ok: r.ok, codes }, !r.ok && codes.includes('PROTO-MOD-064'));
}

// F8. Unresolved: a manifest-side mapping cannot help a host that lacks the
// module, because that host holds no manifest to read it from. The remediation
// can only repeat what the document states.
{
  const resolution = resolveAssetClass(OLD_CLASS, registry());
  probe(
    'F8 unresolved remediation names only what the document states',
    { code: resolution.issue?.code, remediation: resolution.issue?.remediation },
    resolution.issue?.code === 'MOD-MISSING-001' && resolution.issue.remediation.includes(OLD_CLASS),
  );
}

if (results.some((r) => !r)) process.exit(1);
