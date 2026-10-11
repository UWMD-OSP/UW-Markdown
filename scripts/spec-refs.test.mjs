import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSpecRefProblems, headingIndex, loadSpecRefFiles, FORMAT, PROTOCOL } from './spec-refs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('every spec cross-reference and spec_ref in the repository resolves', () => {
  assert.deepEqual(collectSpecRefProblems(loadSpecRefFiles(root)), []);
});

test('heading labels cover section, part, appendix and numbered-item forms', () => {
  const { labels, anchors } = headingIndex([
    '## Part IV — Section Registry',
    '### § 4.4 — Operating Statement',
    '#### 2.5f The `_overrides` block annotation',
    '## X. Module Manifest Specification',
    '### VIII.9.6 Explicit property cash-flow assembly (RFC 0045)',
    '#### 4. Reserve treatment',
    '## Appendix D — Worked example',
    '```',
    '## V.99 inside a fence is not a heading',
    '```',
  ].join('\n'));
  for (const label of ['Part IV', '4.4', '2.5f', 'X', 'VIII.9.6', 'VIII.9.6.4', 'Appendix D']) assert.ok(labels.has(label), label);
  assert.ok(!labels.has('V.99'));
  assert.ok(anchors.has('viii96-explicit-property-cash-flow-assembly-rfc-0045'));
  assert.ok(anchors.has('viii-9-6-explicit-property-cash-flow-assembly-rfc-0045'));
});

test('dangling targets are reported, qualified and bare, in specs and spec_ref values', () => {
  const files = {
    [FORMAT]: '# F\n### 2.6 Source Identifiers\nSee Protocol §V.9 and Protocol §V.7, and §2.6 and §9.9.\nStarter guide §V.7 is another document. [x](UW_PROTOCOL.md#nope)\n',
    [PROTOCOL]: '# P\n### V.9 Canonical block JSON\nSee §V.9, §XIV and format §2.6–§2.7. [ok](UW_FORMAT_SPEC.md#26-source-identifiers)\n',
    'docs/starter/display.md': '# D\n### III.1a Display locales (RFC 0001)\n',
    'packages/uwmd-core/src/protocol.ts': [
      "spec_ref: 'UW_PROTOCOL.md §V.9'",
      "spec_ref: 'UW_PROTOCOL.md §XIV'",
      "spec_ref: 'docs/starter/display.md §III.1a'",
      "spec_ref: '§2.6 / RFC 0031'",
      "spec_ref: '§5.3 CC-01'",
    ].join('\n'),
  };
  assert.deepEqual(collectSpecRefProblems(files), [
    "protocol.ts:2 spec_ref 'UW_PROTOCOL.md §XIV': §XIV does not exist in spec/UW_PROTOCOL.md",
    "protocol.ts:5 spec_ref '§5.3 CC-01': §5.3 does not exist in spec/UW_FORMAT_SPEC.md",
    'spec/UW_FORMAT_SPEC.md:3: §V.7 does not exist in spec/UW_PROTOCOL.md',
    'spec/UW_FORMAT_SPEC.md:3: §9.9 does not exist in spec/UW_FORMAT_SPEC.md',
    'spec/UW_PROTOCOL.md:3: §XIV does not exist in spec/UW_PROTOCOL.md',
    'spec/UW_PROTOCOL.md:3: §2.7 does not exist in spec/UW_FORMAT_SPEC.md',
    'spec/UW_FORMAT_SPEC.md:4: link anchor #nope does not exist in spec/UW_PROTOCOL.md',
  ]);
});
