import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (s) => `sha256:${createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex')}`;
const DEAL = '---\nuw_version: "1.1"\ndeal_id: pkgfix\n---\n';
const NOTE = '---\nuw_version: "1.1"\ndocument_id: note:1\n---\n';

const base = () => ({
  package_version: '1.0',
  package_id: 'pkg:conformance:1',
  members: [
    { id: 'deal:d', path: 'records/deal.uwx.md', role: 'underwriting',
      media_type: 'text/vnd.uwmd.extended+markdown', sha256: sha(DEAL),
      document_profile: 'deal-underwriting-v1' },
    { id: 'note:n', path: 'notes/note.uwx.md', role: 'source_note',
      media_type: 'text/vnd.uwmd.extended+markdown', sha256: sha(NOTE),
      document_profile: 'source-note-v1' },
    { id: 'src:pdf', path: 'sources/lease.pdf', role: 'source_evidence',
      media_type: 'application/pdf', sha256: sha('%PDF-1.4 evidence') },
  ],
  links: [
    { type: 'abstracts', from: 'note:n', to: 'src:pdf' },
    { type: 'contributes_to', from: 'note:n', to: 'deal:d' },
    { type: 'guarantees', from: 'note:n', to: 'deal:d' },
  ],
});

const accept = {
  '01-valid-deal-with-note': [base(), 'A complete package: an underwriting record, a source note, source evidence, and typed links across all three.'],
  '02-extension-link-type': [(() => { const m = base(); m.links.push({ type: 'org.example.custom', from: 'deal:d', to: 'note:n' }); return m; })(),
    'An unknown extension link type must be preserved, not rejected.'],
};

const reject = {
  '01-dangling-link': [(() => { const m = base(); m.links = [{ type: 'contributes_to', from: 'note:n', to: 'deal:missing' }]; return m; })(),
    ['PKG-016'], 'A link endpoint that does not resolve makes the graph lie.'],
  '02-duplicate-member-id': [(() => { const m = base(); m.members.push({ ...m.members[0] }); return m; })(),
    ['PKG-008'], 'Two members sharing an id make lookup ambiguous.'],
  '03-duplicate-path': [(() => { const m = base(); m.members[1] = { ...m.members[1], path: 'records/deal.uwx.md' }; return m; })(),
    ['PKG-010'], 'Two members claiming one archive entry.'],
  '04-zip-traversal-path': [(() => { const m = base(); m.members[2] = { ...m.members[2], path: '../escape.pdf' }; return m; })(),
    ['PKG-009'], 'Traversal is rejected in the manifest, before any archive is opened.'],
  '05-wrong-layer-edge': [(() => { const m = base(); m.links = [{ type: 'owns', from: 'note:n', to: 'deal:d' }]; return m; })(),
    ['PKG-017'], 'A known entity-layer type used on the member layer is a claim the registry says cannot be true.'],
  '06-bad-digest-format': [(() => { const m = base(); m.members[0] = { ...m.members[0], sha256: 'deadbeef' }; return m; })(),
    ['PKG-012'], 'Digests are the members identity and must be well formed.'],
  '07-unknown-role': [(() => { const m = base(); m.members[0] = { ...m.members[0], role: 'whatever' }; return m; })(),
    ['PKG-011'], 'An unrecognized role would leave a member outside every rule.'],
};

for (const [id, [manifest, why]] of Object.entries(accept)) {
  writeFileSync(`accept/${id}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(`accept/${id}.expected.json`, `${JSON.stringify({ why }, null, 2)}\n`);
}
for (const [id, [manifest, codes, why]] of Object.entries(reject)) {
  writeFileSync(`reject/${id}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(`reject/${id}.expected.json`, `${JSON.stringify({ expected_codes: codes, why }, null, 2)}\n`);
}
console.log(`wrote ${Object.keys(accept).length} accept + ${Object.keys(reject).length} reject`);
