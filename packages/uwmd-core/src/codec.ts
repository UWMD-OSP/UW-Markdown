import type { UWDocumentEnvelope } from './envelope.js';
import type {
  RepresentationCapability,
  RepresentationDirection,
  RepresentationFidelity,
} from './protocol.js';

export type { RepresentationDirection, RepresentationFidelity };
export type RepresentationDescriptor = RepresentationCapability;

export interface UWCodec<TEncoded = unknown> {
  readonly descriptor: RepresentationDescriptor;
  encode(document: UWDocumentEnvelope): TEncoded | Promise<TEncoded>;
  decode(input: TEncoded): UWDocumentEnvelope | Promise<UWDocumentEnvelope>;
}

export class UWCodecError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWCodecError';
    this.code = code;
  }
}

export class CodecRegistry {
  readonly #codecs = new Map<string, UWCodec>();

  constructor(codecs: readonly UWCodec[] = []) {
    for (const codec of codecs) this.register(codec);
  }

  register(codec: UWCodec): this {
    const id = codec.descriptor.id;
    if (this.#codecs.has(id)) {
      throw new UWCodecError('CODEC_DUPLICATE_ID', `Codec "${id}" is already registered.`);
    }
    for (const existing of this.#codecs.values()) {
      const overlap = codec.descriptor.media_types.find((mediaType) =>
        existing.descriptor.media_types.includes(mediaType),
      );
      if (overlap) {
        throw new UWCodecError(
          'CODEC_DUPLICATE_MEDIA_TYPE',
          `Media type "${overlap}" is already owned by codec "${existing.descriptor.id}".`,
        );
      }
    }
    this.#codecs.set(id, codec);
    return this;
  }

  get(id: string): UWCodec {
    const codec = this.#codecs.get(id);
    if (!codec) throw new UWCodecError('CODEC_NOT_FOUND', `No codec registered for "${id}".`);
    return codec;
  }

  findByMediaType(mediaType: string): UWCodec | null {
    const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase();
    for (const codec of this.#codecs.values()) {
      if (codec.descriptor.media_types.some((item) => item.toLowerCase() === normalized)) {
        return codec;
      }
    }
    return null;
  }

  findByFileName(fileName: string): UWCodec | null {
    const normalized = fileName.toLowerCase();
    const codecs = [...this.#codecs.values()].sort(
      (left, right) =>
        Math.max(...right.descriptor.file_extensions.map((item) => item.length)) -
        Math.max(...left.descriptor.file_extensions.map((item) => item.length)),
    );
    return (
      codecs.find((codec) =>
        codec.descriptor.file_extensions.some((extension) =>
          normalized.endsWith(extension.toLowerCase()),
        ),
      ) ?? null
    );
  }

  list(): RepresentationDescriptor[] {
    return [...this.#codecs.values()]
      .map((codec) => codec.descriptor)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async encode<TEncoded>(id: string, document: UWDocumentEnvelope): Promise<TEncoded> {
    return this.get(id).encode(document) as TEncoded | Promise<TEncoded>;
  }

  async decode<TEncoded>(id: string, input: TEncoded): Promise<UWDocumentEnvelope> {
    return this.get(id).decode(input);
  }
}
