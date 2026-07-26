import type {
  RepresentationCapability,
  RepresentationDirection,
  RepresentationFidelity,
} from './protocol.js';

export interface NegotiationOptions {
  direction?: RepresentationDirection;
  minimum_fidelity?: RepresentationFidelity;
}

export interface NegotiatedRepresentation {
  descriptor: RepresentationCapability;
  media_type: string;
}

export class RepresentationNegotiationError extends Error {
  readonly code: string;
  readonly status: 406 | 415;

  constructor(code: string, status: 406 | 415, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'RepresentationNegotiationError';
    this.code = code;
    this.status = status;
  }
}

/** Selects a registered representation using HTTP Accept semantics. */
export function negotiateRepresentation(
  accept: string | undefined,
  descriptors: readonly RepresentationCapability[],
  options: NegotiationOptions = {},
): NegotiatedRepresentation {
  const ranges = parseAccept(accept ?? '*/*');
  const minimum = fidelityRank(options.minimum_fidelity ?? 'view');
  const candidates: Array<NegotiatedRepresentation & { q: number; specificity: number; order: number }> = [];

  descriptors.forEach((descriptor, order) => {
    if (options.direction && !descriptor.directions.includes(options.direction)) return;
    if (fidelityRank(descriptor.fidelity) < minimum) return;
    for (const mediaType of descriptor.media_types) {
      const best = ranges
        .filter((range) => mediaRangeMatches(range.mediaRange, mediaType))
        .sort((left, right) => right.specificity - left.specificity || right.q - left.q)[0];
      if (best && best.q > 0) {
        candidates.push({ descriptor, media_type: mediaType, q: best.q, specificity: best.specificity, order });
      }
    }
  });

  const selected = candidates.sort(
    (left, right) => right.q - left.q || right.specificity - left.specificity || left.order - right.order,
  )[0];
  if (!selected) {
    throw new RepresentationNegotiationError(
      'REPRESENTATION_NOT_ACCEPTABLE',
      406,
      `No representation satisfies Accept: ${accept ?? '*/*'}.`,
    );
  }
  return { descriptor: selected.descriptor, media_type: selected.media_type };
}

/** Resolves a request Content-Type to a readable representation. */
export function resolveInputRepresentation(
  contentType: string,
  descriptors: readonly RepresentationCapability[],
): NegotiatedRepresentation {
  const normalized = contentType.split(';', 1)[0]?.trim().toLowerCase();
  for (const descriptor of descriptors) {
    if (!descriptor.directions.includes('read')) continue;
    const mediaType = descriptor.media_types.find((item) => item.toLowerCase() === normalized);
    if (mediaType) return { descriptor, media_type: mediaType };
  }
  throw new RepresentationNegotiationError(
    'REPRESENTATION_UNSUPPORTED_MEDIA_TYPE',
    415,
    `No readable representation owns Content-Type: ${contentType}.`,
  );
}

interface AcceptRange {
  mediaRange: string;
  q: number;
  specificity: number;
}

function parseAccept(value: string): AcceptRange[] {
  return value.split(',').map((part) => {
    const [rawRange = '*/*', ...parameters] = part.trim().split(';');
    const mediaRange = rawRange.toLowerCase();
    const qParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith('q='));
    const parsedQ = qParameter ? Number(qParameter.trim().slice(2)) : 1;
    const q = Number.isFinite(parsedQ) && parsedQ >= 0 && parsedQ <= 1 ? parsedQ : 0;
    const specificity = mediaRange === '*/*' ? 0 : mediaRange.endsWith('/*') ? 1 : 2;
    return { mediaRange, q, specificity };
  });
}

function mediaRangeMatches(range: string, mediaType: string): boolean {
  const normalized = mediaType.toLowerCase();
  if (range === '*/*') return true;
  if (range.endsWith('/*')) return normalized.startsWith(`${range.slice(0, -1)}`);
  return range === normalized;
}

function fidelityRank(fidelity: RepresentationFidelity): number {
  return { view: 0, model: 1, source: 2 }[fidelity];
}
