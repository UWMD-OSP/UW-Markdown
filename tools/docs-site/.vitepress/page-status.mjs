// Site presentation only: route labels do not amend the standard.
export const PAGE_STATUS = Object.freeze({
  normative: { label: 'Normative', description: 'Part of the UWMD standard. Read with the' },
  guide: { label: 'Guide · non-normative', description: 'Guidance, not a conformance requirement. Requirements live in the' },
  starter: { label: 'Starter product · non-normative', description: 'Reference-tool guidance. Requirements live in the' },
  project: { label: 'Project record', description: 'Project context. Requirements live in the' },
});

export function pageStatus(path, override) {
  if (typeof override === 'string' && Object.hasOwn(PAGE_STATUS, override)) return override;
  const route = `/${String(path).split(/[?#]/, 1)[0].replace(/^\/+/, '').replace(/(?:\/index)?\.(?:md|html)$/, '').replace(/\/$/, '')}`;
  const under = (prefix) => route === prefix || route.startsWith(`${prefix}/`);
  if (route.startsWith('/conformance/starter-') || ['/starter', '/guide', '/ai'].some(under)) return 'starter';
  if (['/spec', '/conformance'].some(under)) return 'normative';
  if (['/tutorials', '/downloads', '/viewer'].some(under)) return 'guide';
  return 'project';
}

export function markNormative(items) {
  return items.map((item) => ({
    ...item,
    ...(item.link && item.text && pageStatus(item.link) === 'normative'
      ? { text: `${item.text} <span class="uw-normative-mark" title="Normative" aria-label="Normative">N</span>` } : {}),
    ...(item.items ? { items: markNormative(item.items) } : {}),
  }));
}

export function siteSidebars(sidebars) {
  return {
    ...sidebars,
    '/downloads/': sidebars['/tutorials/'],
    '/viewer/': sidebars['/tutorials/'],
    '/spec/': markNormative(sidebars['/spec/']),
    '/conformance/': markNormative(sidebars['/conformance/']),
  };
}
