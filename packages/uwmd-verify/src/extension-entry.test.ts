import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseUWFile } from './parser.js';
import { toUWEnvelope, canonicalizeUWEnvelope, computeEnvelopeDigest, fromUWEnvelope } from './envelope.js';
import { extensionBlocks, mapExtensionEntry } from './extension-entry.js';
const packet = JSON.parse(readFileSync(new URL('../../../conformance/rfc-0089/cases.json', import.meta.url), 'utf8'));
describe('RFC 0089 frozen complete source expectations', () => {
  for (const item of packet.source_cases) it(item.name, async () => {
    const model = toUWEnvelope(parseUWFile(item.source), { generatedAt: '2000-01-01T00:00:00Z', generator: 'candidate' });
    expect(model).toEqual(item.expected_model);
    expect(canonicalizeUWEnvelope(model)).toBe(item.expected_preimage);
    expect(await computeEnvelopeDigest(model)).toBe(item.expected_digest);
  });
  it('preserves unknown outer/block values and exact variant identity through the model API', () => {
    const model = structuredClone(packet.direct_models[1].expected_model);
    model.outer = { retained: true };
    model.extensions.x_probe.blocks[0].block.extra = { retained: true };
    model.extensions.x_probe.blocks[0].block.prose = '';
    model.extensions.x_probe.blocks[0].block.rawJson = 'ordinary model extra';
    const actual = toUWEnvelope(structuredClone(fromUWEnvelope(model)), { generatedAt: model.generated_at, generator: model.generator });
    // Existing volatile export labels may be generated; every committed member is exact.
    expect(canonicalizeUWEnvelope(actual)).toBe(canonicalizeUWEnvelope(model));
    const entry = model.extensions.x_probe;
    expect(extensionBlocks(entry)).toEqual(entry.blocks.map((record: {block: unknown}) => record.block));
    expect(mapExtensionEntry(entry, (block: unknown) => block)).toEqual(entry);
  });
});
