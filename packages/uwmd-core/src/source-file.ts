// Node-only source loading for starter CLIs. Decoding never rewrites the file.
import { readFile } from 'node:fs/promises';
import {
  CORE_CODEC_REGISTRY, UWX_REPRESENTATION_ID, UWLiteBridgeError,
  UWSourceRepresentationError, compileUWLite, detectUWSourceRepresentation,
  fromUWEnvelope, parseUWFile, parseUWLite, toUWEnvelope,
  type ParsedUWFile, type UWDocumentEnvelope,
} from '@uwmd/verify';

export interface LoadedUWSource {
  representation: string;
  parsed: ParsedUWFile;
  envelope: UWDocumentEnvelope;
}

export async function loadUWSourceFile(file: string): Promise<LoadedUWSource> {
  const codec = CORE_CODEC_REGISTRY.findByFileName(file);
  if (codec) {
    const bytes = await readFile(file);
    const input = codec.descriptor.id === 'uw-csv-bundle' ? new Uint8Array(bytes) : bytes.toString('utf8');
    const envelope = await codec.decode(input);
    return { representation: codec.descriptor.id, envelope, parsed: fromUWEnvelope(envelope) };
  }
  const content = await readFile(file, 'utf8');
  const detection = detectUWSourceRepresentation(content, file);
  if (detection.representation === UWX_REPRESENTATION_ID) {
    const parsed = parseUWFile(content);
    return { representation: detection.representation, parsed, envelope: toUWEnvelope(parsed) };
  }
  const compiled = compileUWLite(parseUWLite(content));
  if (!compiled.ok) {
    const errors = compiled.report.issues.filter(issue => issue.severity === 'error');
    throw new UWLiteBridgeError(errors[0]?.code ?? 'LITE_COMPILE_FAILED',
      `UW Lite compilation failed: ${errors.map(issue => `${issue.code}: ${issue.message}`).join('; ')}`);
  }
  return { representation: detection.representation, envelope: compiled.envelope, parsed: fromUWEnvelope(compiled.envelope) };
}

/** Byte-preserving source edits require the source representation they edit. */
export async function loadEditableUWXFile(file: string): Promise<ParsedUWFile> {
  const source = await loadUWSourceFile(file);
  if (source.representation !== UWX_REPRESENTATION_ID) {
    throw new UWSourceRepresentationError('SOURCE_EDIT_UNSUPPORTED',
      `Source edits require uwx-markdown; supplied ${source.representation}. Convert to .uwx.md before editing.`);
  }
  return source.parsed;
}
