import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { discoverCalls, root } from './consumer-graph.mjs';
import { sha } from './model.mjs';

const specification = JSON.parse(readFileSync(new URL('./consumer-flows.json', import.meta.url), 'utf8'));
const normalize = text => text.replace(/\s+/g, '');
function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-validator', 'public', '.git'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path)) yield path;
  }
}

test('F4 reviewed call/data-flow inventory covers resolved producers, delegation and opaque storage', () => {
  const graph = discoverCalls(specification.seeds);
  const nodes = new Map(specification.nodes.map(node => [node.id, node]));
  assert.equal(nodes.size, specification.nodes.length);
  for (const id of graph.reached) assert.ok(nodes.has(id), `unclassified resolved caller: ${id}`);
  for (const [id] of graph.identityReferences) assert.ok(nodes.has(id), `unclassified downstream identity owner: ${id}`);
  const source = file => readFileSync(resolve(root, file), 'utf8');
  for (const node of nodes.values()) {
    assert.ok(node.reviewed_flow && node.scope && node.production_action);
    if (node.symbol !== '<module>') assert.ok(graph.declarations.has(node.id), `missing scoped declaration: ${node.id}`);
  }
  for (const edge of specification.manual_edges) {
    assert.ok(nodes.has(edge.from) && nodes.has(edge.to));
    const from = nodes.get(edge.from); const to = nodes.get(edge.to);
    const body = from.symbol === '<module>' ? source(from.file) : graph.declarations.get(from.id);
    for (const anchor of edge.evidence) assert.ok(normalize(body).includes(normalize(anchor)), `${edge.kind}: missing source edge ${anchor}`);
    for (const anchor of edge.target_evidence ?? []) assert.ok(normalize(graph.declarations.get(to.id)).includes(normalize(anchor)), `missing target flow ${anchor}`);
  }
  const resolvedEdges = graph.allEdges.filter(edge => nodes.has(edge.from) && nodes.has(edge.to));
  const edges = [...resolvedEdges, ...specification.manual_edges];
  for (const route of specification.required_routes) for (let index = 1; index < route.length; index++) {
    assert.ok(edges.some(edge => edge.from === route[index - 1] && edge.to === route[index]), `unconnected required route ${route[index - 1]} -> ${route[index]}`);
  }
  const classifiedFiles = new Set([...nodes.values()].map(node => node.file));
  for (const record of specification.passive) {
    classifiedFiles.add(record.file);
    for (const anchor of record.evidence) assert.ok(source(record.file).includes(anchor), `stale passive classification: ${record.file}`);
  }
  // Spelling search remains a discovery cross-check, not proof of closure.
  const discovery = [];
  const terms = /semantic_digest|semanticDigestOf|EnvelopeDigest|UWEnvelope|resolveDocumentSigningSubject|signDocument|issueReceipt|verifyReceipt|source_envelope_digest|binding_digest/g;
  for (const group of ['packages', 'tools']) for (const path of files(resolve(root, group))) {
    const text = readFileSync(path, 'utf8'); const matches = [...text.matchAll(terms)];
    if (!matches.length) continue;
    const name = relative(root, path).replaceAll('\\', '/');
    assert.ok(classifiedFiles.has(name), `unclassified discovery hit (inspect scope): ${name}`);
    discovery.push({ file: name, matches: matches.length, proof: 'discovery only' });
  }
  const results = [...classifiedFiles].sort().map(file => {
    const raw = Buffer.from(source(file));
    return { file, source_sha256: sha(raw), source_lf_sha256: sha(Buffer.from(raw.toString('utf8').replaceAll('\r\n', '\n'))),
      nodes: [...nodes.values()].filter(node => node.file === file), passive: specification.passive.filter(record => record.file === file) };
  });
  const folder = resolve(root, 'node_modules/.cache/rfc0089-evidence'); mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, 'consumer-inventory.json'), `${JSON.stringify({ platform: process.platform,
    method: specification.method, scope: specification.scope, results, nodes: specification.nodes, resolved_edges: resolvedEdges,
    downstream_audit: specification.downstream_audit, identity_references: [...graph.identityReferences].map(([id, evidence]) => ({ id, evidence })),
    manual_edges: specification.manual_edges, required_routes: specification.required_routes, discovery,
    unresolved_calls: graph.resolutionMisses, limits: [graph.limits, ...specification.limits],
    production_adoption: 'not activated; requires explicit acceptance and later integration evidence' }, null, 2)}\n`);
});
