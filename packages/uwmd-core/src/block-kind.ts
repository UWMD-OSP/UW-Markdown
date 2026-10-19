// Internal block/map discriminator. No document-authored variant key is reserved.
// Annotation values use the existing UWFenceAnnotation primitive domain. Checking
// that domain also distinguishes maps named both annotation/content, even when a
// lawful Envelope block carries extra members that resemble annotation fields.
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function hasBlockShape(value: unknown): boolean {
  if (!record(value) || !Object.hasOwn(value, 'annotation') || !Object.hasOwn(value, 'content')
    || !record(value.annotation) || !record(value.content)) return false;
  const annotation = value.annotation;
  return Object.hasOwn(annotation, 'section') && typeof annotation.section === 'string'
    && Object.values(annotation).every(v => v === undefined || ['string', 'number', 'boolean'].includes(typeof v));
}
