import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyUWMDSourceEdit, createUWMCPApplyEditResult } from './bindings-edit.js';
import {
  UWBindingError,
  uwmdETag,
  stampEnvelopeDigest,
  toUWEnvelope,
  parseUWFile,
} from '@uwmd/verify';
import * as browserSurface from './browser.js';
import * as indexSurface from './index.js';

const source = readFileSync(
  resolve(process.cwd(), '..', '..', 'conformance', 'rfc-0089', 'fixtures', 'complete-current.uwx.md'),
  'utf8',
);
const dealId = String(parseUWFile(source).frontmatter.deal_id);

describe('source-edit bindings wired to the starter editor', () => {
  it('reuses Tier-2 source editing with semantic If-Match protection', async () => {
    const current = await stampEnvelopeDigest(toUWEnvelope(parseUWFile(source)));
    const edited = await applyUWMDSourceEdit(
      source,
      { kind: 'frontmatter_set', path: 'deal_name', value: 'Parkview Updated' },
      { actor: 'API test', source: 'manual', confidence: 'high' },
      uwmdETag(current),
      { integrity: false, maintainGaps: false },
    );
    expect(edited.envelope.frontmatter.deal_name).toBe('Parkview Updated');
    expect(edited.etag).not.toBe(uwmdETag(current));

    const applied = await createUWMCPApplyEditResult(
      source,
      { kind: 'frontmatter_set', path: 'deal_name', value: 'Parkview MCP Updated' },
      { actor: 'MCP test', source: 'manual', confidence: 'high' },
      uwmdETag(current),
    );
    expect(applied.edit.envelope.frontmatter.deal_name).toBe('Parkview MCP Updated');
    expect(applied.result.structuredContent).toMatchObject({ ok: true, deal_id: dealId });
    expect(applied.result.content.at(-1)?.type).toBe('resource_link');
  });

  it('maps an editor refusal to a 409 binding error carrying the editor code', async () => {
    const current = await stampEnvelopeDigest(toUWEnvelope(parseUWFile(source)));
    const refused = applyUWMDSourceEdit(
      source,
      { kind: 'frontmatter_set', path: 'deal_id', value: 'uw_other' },
      { actor: 'API test', source: 'manual', confidence: 'high' },
      uwmdETag(current),
    );
    await expect(refused).rejects.toBeInstanceOf(UWBindingError);
    await expect(refused).rejects.toMatchObject({ status: 409 });
  });

  it('is what both public entry points export', () => {
    expect(indexSurface.applyUWMDSourceEdit).toBe(applyUWMDSourceEdit);
    expect(indexSurface.createUWMCPApplyEditResult).toBe(createUWMCPApplyEditResult);
    expect(browserSurface.applyUWMDSourceEdit).toBe(applyUWMDSourceEdit);
    expect(browserSurface.createUWMCPApplyEditResult).toBe(createUWMCPApplyEditResult);
  });
});
