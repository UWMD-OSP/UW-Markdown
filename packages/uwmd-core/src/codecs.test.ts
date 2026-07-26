import { describe, expect, it } from 'vitest';
import { decodeUWDocument, encodeUWDocument, CORE_CODEC_REGISTRY } from './codecs.js';
import { toUWEnvelope } from './envelope.js';
import type { ParsedUWFile } from './types.js';

const envelope = toUWEnvelope({
  frontmatter: {
    uw_version: '1.1',
    deal_id: 'uw_codecs',
    deal_name: 'Codec registry',
  } as ParsedUWFile['frontmatter'],
  sections: {},
  prose: {},
  pipeline_log: [],
  custom_calculations: [],
  custom_scenarios: [],
  extensions: {},
  superseded: {},
  raw: '',
});

describe('core codec registry', () => {
  it('registers JSON and XML through one API', async () => {
    expect(CORE_CODEC_REGISTRY.list().map((item) => item.id)).toEqual([
      'uw-csv-bundle',
      'uw-json',
      'uw-xml',
    ]);
    const encoded = await encodeUWDocument('uw-xml', envelope);
    const decoded = await decodeUWDocument('uw-xml', encoded);
    expect(decoded.frontmatter.deal_id).toBe('uw_codecs');
    const csv = await encodeUWDocument('uw-csv-bundle', envelope);
    const fromCsv = await decodeUWDocument('uw-csv-bundle', csv);
    expect(fromCsv.frontmatter.deal_id).toBe('uw_codecs');
  });
});
