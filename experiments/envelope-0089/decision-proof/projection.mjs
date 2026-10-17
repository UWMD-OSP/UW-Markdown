// UNAPPROVED extension minimum for RFC0089; not a public Reader implementation.
const clone = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.hasOwn(value, key);
export function minimumBlock(block) {
  const body = block.content;
  const value = { content: Object.fromEntries(Object.entries(body).filter(([key]) => !['_meta', '_notes'].includes(key)).map(([key, item]) => [key, clone(item)])) };
  if (own(body, '_meta')) value.meta = clone(body._meta);
  return value;
}
export function extensionMinimum(extensions) {
  return Object.fromEntries(Object.entries(extensions).map(([section, entry]) => {
    if (entry.mode === 'single') return [section, { mode: 'single', block: minimumBlock(entry.block) }];
    if (entry.mode !== 'variants' || !Array.isArray(entry.blocks) || entry.blocks.length === 0) throw new TypeError('candidate extension mode');
    const ids = entry.blocks.map(record => record.variant);
    if (new Set(ids).size !== ids.length || ids.some(id => id !== null && typeof id !== 'string')) throw new TypeError('duplicate/invalid candidate identity');
    const sorted = [...ids].sort((a, b) => a === null ? b === null ? 0 : -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0);
    if (ids.some((id, i) => id !== sorted[i])) throw new TypeError('candidate identity order');
    return [section, { mode: 'variants', blocks: entry.blocks.map(record => {
      if (record.variant !== (record.block.annotation.variant ?? null)) throw new TypeError('candidate annotation identity');
      return { variant: record.variant, block: minimumBlock(record.block) };
    }) }];
  }));
}
export function historyMinimum(superseded) {
  return Object.fromEntries(Object.entries(superseded).map(([section, blocks]) => [section, blocks.map(minimumBlock)]));
}
