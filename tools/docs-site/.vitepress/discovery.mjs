const ORIGIN = 'https://www.uwmd.org';

// Use page frontmatter so VitePress also updates these tags on client navigation.
export function addDiscoveryMetadata(page, defaultDescription) {
  const head = [...(page.frontmatter.head ?? [])];
  if (page.relativePath === '404.md') {
    head.push(['meta', { name: 'robots', content: 'noindex' }]);
  } else {
    const path = page.relativePath.replace(/(?:^|\/)index\.md$/, '/').replace(/\.md$/, '');
    const url = new URL(path.startsWith('/') ? path : `/${path}`, ORIGIN).href;
    const title = page.title === 'UW Markdown' ? page.title : `${page.title} | UW Markdown`;
    const description = page.description || defaultDescription;
    head.push(
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    );
  }
  page.frontmatter.head = head;
}
