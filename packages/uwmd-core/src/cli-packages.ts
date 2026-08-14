// CLI commands for RFC 0018: lease abstracts and deal packages.
//
// Split out of cli.ts, which is already long. These are Node-side commands and
// are reached only through the CLI entry point, never from browser.ts.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  projectPackageLinksToEntityEdges,
  validateUWDealPackageManifest,
  type UWDealPackageManifest,
} from './deal-package.js';
import {
  projectUWDealPackageContext,
  validateUWDealPackageContext,
} from './deal-package-context.js';
import {
  decodeUWDealPackageZip,
  encodeUWDealPackageZip,
  verifyUWDealPackage,
} from './deal-package-zip.js';
import { projectLeaseAbstractToRentRoll, validateLeaseAbstract } from './lease-abstract.js';
import type { ProtocolError } from './protocol.js';

type Flags = Record<string, string | boolean>;

function readJSONFile(path: string): unknown {
  return JSON.parse(readFileSync(resolve(path), 'utf-8')) as unknown;
}

function readBytes(path: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(path)));
}

function printErrors(errors: readonly ProtocolError[]): void {
  for (const e of errors) {
    console.log(`  ${e.code}${e.pointer ? ` [${e.pointer}]` : ''} ${e.message}`);
  }
}

// ─── Lease abstracts ─────────────────────────────────────────────────────────

export function cmdLeaseValidate(file: string, flags: Flags): void {
  const errors = validateLeaseAbstract(readJSONFile(file));
  if (flags['json']) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2));
    process.exit(errors.length === 0 ? 0 : 1);
  }
  if (errors.length === 0) {
    console.log(`\nOK - ${basename(file)}\n`);
    return;
  }
  console.log(`\nERRORS - ${basename(file)}`);
  printErrors(errors);
  console.log('');
  process.exit(1);
}

export function cmdLeaseProject(file: string, flags: Flags): void {
  const abstract = readJSONFile(file);
  const errors = validateLeaseAbstract(abstract);
  if (errors.length > 0) {
    console.error('Refusing to project an invalid lease abstract:');
    for (const e of errors) console.error(`  ${e.code} ${e.message}`);
    process.exit(1);
  }
  // Emits a proposed row plus its loss report. It never writes to a deal — a
  // host applies the row through the Tier-2 editor, where byte preservation and
  // provenance apply.
  const result = projectLeaseAbstractToRentRoll(abstract as never);
  console.log(JSON.stringify(result, null, flags['compact'] ? 0 : 2));
}

// ─── Packages ────────────────────────────────────────────────────────────────

export async function cmdPackageCreate(manifestPath: string, flags: Flags): Promise<void> {
  const manifest = readJSONFile(manifestPath) as UWDealPackageManifest;
  const errors = validateUWDealPackageManifest(manifest);
  if (errors.length > 0) {
    console.error('Manifest is invalid:');
    printErrors(errors);
    process.exit(1);
  }
  // Member paths resolve relative to the manifest's own directory.
  const root = resolve(manifestPath, '..');
  const payloads: Record<string, Uint8Array> = {};
  for (const member of manifest.members) {
    const full = resolve(root, member.path);
    if (!existsSync(full)) {
      console.error(`Missing member payload: ${member.path}`);
      process.exit(1);
    }
    payloads[member.path] = readBytes(full);
  }
  const out = String(flags['output'] ?? 'package.uwpkg.zip');
  try {
    const bytes = await encodeUWDealPackageZip({ manifest, payloads });
    writeFileSync(resolve(out), bytes);
    console.log(`Wrote ${basename(out)} (${manifest.members.length} member(s)).`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

export async function cmdPackageVerify(file: string, flags: Flags): Promise<void> {
  const decoded = decodeUWDealPackageZip(readBytes(file));
  const result = await verifyUWDealPackage(decoded);
  if (flags['json']) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n${result.status.toUpperCase()} - ${basename(file)}\n`);
    printErrors(result.errors);
    for (const id of result.unverifiable_members) {
      console.log(`  (unverifiable) ${id} — semantic digest could not be checked here`);
    }
    console.log(
      '\nA verified package means its members are unchanged and match the manifest.',
    );
    console.log('It does not mean the inputs are true, complete, or audited.\n');
  }
  // `unverifiable` deliberately does not exit non-zero: an unsupported
  // representation is not evidence of tampering.
  if (result.status === 'failed') process.exit(1);
}

export function cmdPackageList(file: string, flags: Flags): void {
  const decoded = decodeUWDealPackageZip(readBytes(file));
  const rows = decoded.manifest.members.map((m) => ({
    id: m.id,
    role: m.role,
    path: m.path,
    document_profile: m.document_profile ?? null,
  }));
  if (flags['json']) {
    console.log(JSON.stringify(
      { package_id: decoded.manifest.package_id, members: rows, links: decoded.manifest.links },
      null,
      2,
    ));
    return;
  }
  console.log(`\n${decoded.manifest.package_id} — ${rows.length} member(s)\n`);
  for (const r of rows) {
    console.log(`  ${r.id}  [${r.role}]  ${r.path}${r.document_profile ? `  (${r.document_profile})` : ''}`);
  }
  if (decoded.manifest.links.length > 0) {
    console.log('\n  links:');
    for (const l of decoded.manifest.links) {
      console.log(`    ${l.from} --${l.type}--> ${l.to}`);
    }
  }
  console.log('');
}

export function cmdPackageToContext(file: string, flags: Flags): void {
  const decoded = decodeUWDealPackageZip(readBytes(file));
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const contents: Record<string, string> = {};
  for (const member of decoded.manifest.members) {
    // Source evidence is never inlined, no matter how convenient it would be.
    if (member.role === 'source_evidence') continue;
    const bytes = decoded.payloads[member.path];
    if (!bytes) continue;
    try {
      contents[member.id] = decoder.decode(bytes);
    } catch {
      // Not valid UTF-8: describe it in the manifest rather than mangling it
      // into the view.
    }
  }
  const context = projectUWDealPackageContext(decoded.manifest, { contents });
  const serialized = `${JSON.stringify(context, null, flags['compact'] ? 0 : 2)}\n`;
  if (flags['stdout'] || !flags['output']) {
    process.stdout.write(serialized);
    return;
  }
  writeFileSync(resolve(String(flags['output'])), serialized, 'utf-8');
  console.log(`Wrote ${basename(String(flags['output']))}`);
}

export function cmdPackageContextValidate(file: string, flags: Flags): void {
  const errors = validateUWDealPackageContext(readJSONFile(file));
  if (flags['json']) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2));
    process.exit(errors.length === 0 ? 0 : 1);
  }
  if (errors.length === 0) {
    console.log(`\nOK - ${basename(file)}\n`);
    return;
  }
  console.log(`\nERRORS - ${basename(file)}`);
  printErrors(errors);
  console.log('');
  process.exit(1);
}

export function cmdPackageEdges(file: string): void {
  const decoded = decodeUWDealPackageZip(readBytes(file));
  // One-directional by design: member links project up to entity edges with
  // synthesized provenance, and never the reverse.
  console.log(JSON.stringify(projectPackageLinksToEntityEdges(decoded.manifest), null, 2));
}
