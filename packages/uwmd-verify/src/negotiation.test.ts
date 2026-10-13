import { describe, expect, it } from 'vitest';
import { negotiateRepresentation, resolveInputRepresentation } from './negotiation.js';
import type { RepresentationCapability } from './protocol.js';

const representations: RepresentationCapability[] = [
  {
    id: 'uw-json',
    media_types: ['application/vnd.uwmd.document+json'],
    file_extensions: ['.uw.json'],
    directions: ['read', 'write'],
    fidelity: 'model',
    representation_version: '1.0.0',
  },
  {
    id: 'deal-summary',
    media_types: ['text/csv'],
    file_extensions: ['.csv'],
    directions: ['write'],
    fidelity: 'view',
    representation_version: '1.0.0',
    view: 'deal_summary',
  },
];

describe('representation negotiation', () => {
  it('honors quality values and exact media types', () => {
    const result = negotiateRepresentation(
      'text/csv;q=0.4, application/vnd.uwmd.document+json;q=0.9',
      representations,
    );
    expect(result.descriptor.id).toBe('uw-json');
  });

  it('lets a specific q=0 exclusion override a wildcard', () => {
    expect(
      negotiateRepresentation(
        '*/*;q=1, application/vnd.uwmd.document+json;q=0',
        representations,
      ).descriptor.id,
    ).toBe('deal-summary');
  });
  it('supports wildcards and minimum fidelity', () => {
    expect(negotiateRepresentation('*/*', representations).descriptor.id).toBe('uw-json');
    expect(
      negotiateRepresentation('text/*, application/*;q=0.5', representations, {
        minimum_fidelity: 'model',
      }).descriptor.id,
    ).toBe('uw-json');
  });

  it('returns typed 406 and 415 failures', () => {
    expect(() => negotiateRepresentation('application/xml', representations)).toThrow(
      /REPRESENTATION_NOT_ACCEPTABLE/,
    );
    expect(() => resolveInputRepresentation('application/xml', representations)).toThrow(
      /REPRESENTATION_UNSUPPORTED_MEDIA_TYPE/,
    );
  });

  it('resolves readable Content-Type parameters', () => {
    expect(
      resolveInputRepresentation('application/vnd.uwmd.document+json; charset=utf-8', representations).descriptor.id,
    ).toBe('uw-json');
  });
});
