/// <reference types="vite/client" />
// The example gallery: the synthetic builtin-class examples from examples/,
// bundled at build time. They are illustrations, not market data or a track record.
const SOURCES = import.meta.glob('../../../../examples/*.uwx.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface GalleryExample {
  file: string;
  asset_class: string;
  deal_name: string;
  source: string;
}

function field(source: string, key: string): string {
  const match = new RegExp(`^${key}:\\s*"?([^"\\n]*)"?\\s*$`, 'm').exec(source.split('\n---')[0] ?? '');
  return match?.[1]?.trim() ?? '';
}

export const GALLERY: readonly GalleryExample[] = Object.entries(SOURCES)
  .map(([path, source]) => ({
    file: path.split('/').pop() ?? path,
    asset_class: field(source, 'asset_class'),
    deal_name: field(source, 'deal_name'),
    source,
  }))
  // parkview-reviewed is the reviewed Parkview record, not another class.
  .filter((example) => example.asset_class !== '' && example.file !== 'parkview-reviewed.uwx.md')
  .sort((a, b) => a.asset_class.localeCompare(b.asset_class) || a.file.localeCompare(b.file));
