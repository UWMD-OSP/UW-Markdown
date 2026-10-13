import type { RepresentationCapability } from './protocol.js';

export const UW_LITE_REPRESENTATION_ID = 'uw-lite-markdown' as const;
export const UWX_REPRESENTATION_ID = 'uwx-markdown' as const;
export const UW_LITE_REPRESENTATION_VERSION = '1.0' as const;
export const UWX_REPRESENTATION_VERSION = '1.0' as const;
export const UW_LITE_MEDIA_TYPE = 'text/vnd.uwmd.lite+markdown' as const;
export const UWX_MEDIA_TYPE = 'text/vnd.uwmd.extended+markdown' as const;
export const UW_LITE_EXTENSION = '.uw.md' as const;
export const UWX_EXTENSION = '.uwx.md' as const;

export const UW_LITE_SOURCE_DESCRIPTOR: RepresentationCapability = {
  id: UW_LITE_REPRESENTATION_ID,
  media_types: [UW_LITE_MEDIA_TYPE],
  file_extensions: [UW_LITE_EXTENSION],
  directions: ['read', 'write'],
  fidelity: 'source',
  representation_version: UW_LITE_REPRESENTATION_VERSION,
};

export const UWX_SOURCE_DESCRIPTOR: RepresentationCapability = {
  id: UWX_REPRESENTATION_ID,
  media_types: [UWX_MEDIA_TYPE],
  file_extensions: [UWX_EXTENSION],
  directions: ['read', 'write'],
  fidelity: 'source',
  representation_version: UWX_REPRESENTATION_VERSION,
};

export type UWSourceRepresentation =
  | typeof UW_LITE_REPRESENTATION_ID
  | typeof UWX_REPRESENTATION_ID;

export interface UWSourceDetection {
  representation: UWSourceRepresentation;
  confidence: 'explicit' | 'content' | 'extension';
  warnings: string[];
}

export class UWSourceRepresentationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWSourceRepresentationError';
    this.code = code;
  }
}

function structuredUnderLiteName(): UWSourceRepresentationError {
  return new UWSourceRepresentationError(
    'SOURCE_CONTENT_MISMATCH',
    'A .uw.md file is UW Lite and must not contain UWX structured section fences; structured records use .uwx.md.',
  );
}

const UWX_FENCE = /^\`\`\`json[ \t]+uw:section=\S+/m;
const LITE_VERSION = /^uw_lite_version\s*:/m;
const LITE_FIELD_ANCHOR = /<!--[ \t]*uw:[A-Za-z0-9_.-]+(?:[ \t]+.*?)?[ \t]*-->/;

/**
 * Detect the two Markdown source representations without interpreting financial
 * values.
 *
 * Structured UWX content under a `.uw.md` name contradicts its representation
 * and is `SOURCE_CONTENT_MISMATCH`, explicit selection or not (RFC 0081 §4):
 * `.uw.md` is the Lite extension, and structured records are `.uwx.md`.
 */
export function detectUWSourceRepresentation(
  content: string,
  fileName?: string,
  explicit?: UWSourceRepresentation,
): UWSourceDetection {
  const normalizedName = fileName?.toLowerCase();
  const hasUWXContent = UWX_FENCE.test(content);
  const hasLiteContent = LITE_VERSION.test(content) || LITE_FIELD_ANCHOR.test(content);

  if (hasUWXContent && hasLiteContent) {
    throw new UWSourceRepresentationError(
      'SOURCE_REPRESENTATION_AMBIGUOUS',
      'Source contains both UWX section fences and UW Lite markers; select a representation explicitly.',
    );
  }

  if (explicit) {
    if (explicit === UWX_REPRESENTATION_ID && hasLiteContent) {
      throw new UWSourceRepresentationError(
        'SOURCE_CONTENT_MISMATCH',
        'Explicit UWX input contains UW Lite markers instead of structured section fences.',
      );
    }
    if (explicit === UW_LITE_REPRESENTATION_ID && hasUWXContent) {
      throw new UWSourceRepresentationError(
        'SOURCE_CONTENT_MISMATCH',
        'Explicit UW Lite input contains UWX structured section fences.',
      );
    }
    if (explicit === UWX_REPRESENTATION_ID && normalizedName?.endsWith(UW_LITE_EXTENSION) === true) {
      throw structuredUnderLiteName();
    }
    return { representation: explicit, confidence: 'explicit', warnings: [] };
  }

  if (hasUWXContent) {
    if (normalizedName?.endsWith(UW_LITE_EXTENSION) === true) throw structuredUnderLiteName();
    return {
      representation: UWX_REPRESENTATION_ID,
      confidence: 'content',
      warnings: [],
    };
  }

  if (normalizedName?.endsWith(UWX_EXTENSION)) {
    throw new UWSourceRepresentationError(
      'SOURCE_CONTENT_MISMATCH',
      'A .uwx.md file must contain UWX structured section fences.',
    );
  }

  if (hasLiteContent) {
    return {
      representation: UW_LITE_REPRESENTATION_ID,
      confidence: 'content',
      warnings: [],
    };
  }

  if (normalizedName?.endsWith(UW_LITE_EXTENSION)) {
    return {
      representation: UW_LITE_REPRESENTATION_ID,
      confidence: 'extension',
      warnings: ['Lite representation inferred from extension; no Lite version or field anchor was found.'],
    };
  }

  throw new UWSourceRepresentationError(
    'SOURCE_REPRESENTATION_UNKNOWN',
    'Cannot detect UW Markdown representation; use a supported extension or explicit representation.',
  );
}
