import { describe, expect, it } from 'vitest';
import { CodecRegistry, UWCodecError, type UWCodec } from './codec.js';
import { toUWEnvelope } from './envelope.js';
import type { ParsedUWFile } from './types.js';
import { UW_JSON_CODEC } from './uwjson.js';

const EMPTY_DOCUMENT = toUWEnvelope({
  frontmatter: {
    uw_version: '1.1',
    deal_id: 'uw_codec',
    deal_name: 'Codec test',
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

describe('CodecRegistry', () => {
  it('discovers codecs by id, media type, and longest file extension', () => {
    const registry = new CodecRegistry([UW_JSON_CODEC]);
    expect(registry.get('uw-json')).toBe(UW_JSON_CODEC);
    expect(registry.findByMediaType('application/vnd.uwmd.document+json; charset=utf-8')).toBe(UW_JSON_CODEC);
    expect(registry.findByFileName('deal.uw.json')).toBe(UW_JSON_CODEC);
    expect(registry.list()).toHaveLength(1);
  });

  it('encodes and decodes through a registered codec', async () => {
    const registry = new CodecRegistry([UW_JSON_CODEC]);
    const encoded = await registry.encode<string>('uw-json', EMPTY_DOCUMENT);
    const decoded = await registry.decode('uw-json', encoded);
    expect(decoded.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(decoded.frontmatter).toEqual(EMPTY_DOCUMENT.frontmatter);
  });

  it('rejects duplicate ids, duplicate media types, and unknown ids', () => {
    const registry = new CodecRegistry([UW_JSON_CODEC]);
    expect(() => registry.register(UW_JSON_CODEC)).toThrow(UWCodecError);

    const conflicting: UWCodec<string> = {
      descriptor: {
        id: 'conflict',
        media_types: ['application/vnd.uwmd.document+json'],
        file_extensions: ['.conflict'],
        directions: ['read'],
        fidelity: 'view',
        representation_version: '1.0.0',
      },
      encode: () => '',
      decode: () => EMPTY_DOCUMENT,
    };
    expect(() => registry.register(conflicting)).toThrow(/CODEC_DUPLICATE_MEDIA_TYPE/);
    expect(() => registry.get('missing')).toThrow(/CODEC_NOT_FOUND/);
  });
});
