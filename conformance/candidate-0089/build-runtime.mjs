// Explicit unmerged candidate fork of the actual producer/verifier state machines.
// Financial algorithms and refusal precedence are not replaced by raw crypto tests.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = resolve(root, 'packages/uwmd-verify/dist');
export const runtime = resolve(root, 'node_modules/.cache/rfc0089-candidate-runtime');
mkdirSync(runtime, { recursive: true });
const model = new URL('./model.mjs', import.meta.url).href;
const originals = ['receipts.js', 'document-signatures.js', 'reserve-draw-bindings.js', 'integrity.js', 'property-cash-flows.js'];
const forks = new Set([...originals, 'envelope.js', 'parser.js']);
const url = name => pathToFileURL(resolve(runtime, name)).href;
writeFileSync(resolve(runtime, 'package.json'), '{"type":"module","private":true}\n');
writeFileSync(resolve(runtime, 'parser.js'), `
export * from ${JSON.stringify(pathToFileURL(resolve(native, 'parser.js')).href)};
import * as base from ${JSON.stringify(pathToFileURL(resolve(native, 'parser.js')).href)};
export function parseUWFile(source, options) {
  const parsed = base.parseUWFile(source, options);
  parsed.candidatePhysicalBlocks = [...base.parsedPhysicalBlocks(parsed)];
  return parsed;
}
`);
writeFileSync(resolve(runtime, 'envelope.js'), `
export * from ${JSON.stringify(pathToFileURL(resolve(native, 'envelope.js')).href)};
import { projectSource, digest, preimage } from ${JSON.stringify(model)};
export const UW_ENVELOPE_VERSION = '2.0';
export const toUWEnvelope = parsed => projectSource(parsed).model;
export const computeEnvelopeDigest = async value => digest(value);
export const canonicalizeUWEnvelope = preimage;
export const stampEnvelopeDigest = async value => {
  const semantic_digest = digest(value);
  return { ...value, semantic_digest };
};
`);
const evidence = [];
for (const name of originals) {
  const original = readFileSync(resolve(native, name), 'utf8');
  let code = original.replace(/(from\s*['"])(\.[^'"]+)(['"])/g, (_match, before, spec, after) => {
    const target = spec.startsWith('./') && forks.has(spec.slice(2)) ? url(spec.slice(2)) : pathToFileURL(resolve(native, spec)).href;
    return `${before}${target}${after}`;
  });
  if (name === 'receipts.js') code = code.replace("export const UWX_CANONICALIZATION_VERSION = '1.0'", "export const UWX_CANONICALIZATION_VERSION = '2.0'");
  if (name === 'document-signatures.js') {
    code = code.replace("canonicalization: 'uw-envelope-semantic', canonicalization_version: '1.0'", "canonicalization: 'uw-envelope-semantic', canonicalization_version: '2.0'")
      .replace("subject.canonicalization_version !== '1.0'", "subject.canonicalization_version !== '2.0'")
      .replace('...Object.values(envelope.extensions)', "...Object.values(envelope.extensions).flatMap(entry => entry.mode === 'single' ? [entry.block] : entry.blocks.map(record => record.block))");
  }
  if (name === 'reserve-draw-bindings.js') {
    // The production guard is correct for the old lossy projection. The candidate
    // replaces it with complete occurrence accounting in its Envelope provider.
    const start = code.indexOf('        // The current Envelope cannot represent');
    if (start !== -1) {
      const end = code.indexOf('        source_digest = await computeEnvelopeDigest', start);
      if (end < 0) throw new Error('candidate source guard boundary changed');
      code = code.slice(0, start) + code.slice(end);
    }
  }
  writeFileSync(resolve(runtime, name), code);
  evidence.push({ module: name, native_sha256: createHash('sha256').update(original).digest('hex'),
    candidate_sha256: createHash('sha256').update(code).digest('hex') });
}
writeFileSync(resolve(runtime, 'runtime-manifest.json'), `${JSON.stringify({ candidate: '0089', evidence }, null, 2)}\n`);
export const candidate = {
  parser: await import(url('parser.js')),
  envelope: await import(url('envelope.js')),
  receipts: await import(url('receipts.js')),
  signing: await import(url('document-signatures.js')),
  integrity: await import(url('integrity.js')),
  reserves: await import(url('reserve-draw-bindings.js')),
  propertyCash: await import(url('property-cash-flows.js')),
};
