import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'UW Markdown',
  description:
    'An open standard for commercial real-estate underwriting documents — readable by humans, AI tools, and software alike.',
  cleanUrls: true,
  lastUpdated: true,
  // XSD is copied to public/ as a downloadable static asset.
  ignoreDeadLinks: [/\.xsd$/, /^\/downloads\//],
  srcExclude: ['README.md'],

  head: [
    ['meta', { name: 'theme-color', content: '#0f172a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'UW Markdown' }],
    ['meta', {
      property: 'og:description',
      content: 'Open standard for CRE underwriting documents.',
    }],
    ['meta', { property: 'og:site_name', content: 'UW Markdown' }],
    ['meta', { property: 'og:image', content: 'https://www.uwmd.org/og.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'UW Markdown' }],
    ['meta', {
      name: 'twitter:description',
      content: 'Open standard for CRE underwriting documents.',
    }],
    ['meta', { name: 'twitter:image', content: 'https://www.uwmd.org/og.png' }],
  ],

  themeConfig: {
    siteTitle: 'UW Markdown',

    nav: [
      { text: 'Downloads', link: '/downloads/' },
      {
        text: 'Editor',
        link: 'https://www.uwmd.org/editor/',
        target: '_self',
      },
      { text: 'Viewer', link: '/viewer/' },
      { text: 'Guide', link: '/tutorials/your-first-uwmd-file' },
      { text: 'For AI', link: '/ai/' },
      { text: 'Spec', link: '/spec/format' },
      { text: 'Protocol', link: '/spec/protocol' },
      { text: 'XML', link: '/spec/xml' },
      { text: 'CSV', link: '/spec/csv' },
      {
        text: 'Bindings',
        items: [
          { text: 'HTTP 1.0', link: '/spec/http' },
          { text: 'MCP 1.0', link: '/spec/mcp' },
          { text: 'OpenAPI 3.1', link: '/spec/UW_HTTP_API_v1.openapi.json' },
        ],
      },
      { text: 'Schemas', link: '/spec/schemas/' },
      { text: 'Conformance', link: '/conformance/' },
      { text: 'About', link: '/about/roadmap' },
      {
        text: 'v1',
        items: [
          { text: 'Changelog', link: '/about/changelog' },
          { text: 'GitHub', link: 'https://github.com/jaredmaxey/uw-markdown' },
          { text: 'npm — @uwmd/core', link: 'https://www.npmjs.com/package/@uwmd/core' },
        ],
      },
    ],

    sidebar: {
      '/tutorials/': [
        {
          text: 'Get started',
          items: [
            { text: 'Your first .uw.md', link: '/tutorials/your-first-uwmd-file' },
            { text: 'Glossary', link: '/guide/glossary' },
            { text: 'Tools comparison', link: '/guide/tools' },
          ],
        },
      ],
      '/guide/': [
        {
          text: 'Reference',
          items: [
            { text: 'Glossary', link: '/guide/glossary' },
            { text: 'Tools comparison', link: '/guide/tools' },
            { text: 'Feeding .uw.md to an LLM', link: '/guide/feeding-uwmd-to-an-llm' },
          ],
        },
        {
          text: 'Get started',
          items: [
            { text: 'Your first .uw.md', link: '/tutorials/your-first-uwmd-file' },
          ],
        },
      ],
      '/spec/': [
        {
          text: 'Specifications',
          items: [
            { text: 'Format spec (v1.1)', link: '/spec/format' },
            { text: 'Protocol spec (v1.2)', link: '/spec/protocol' },
            { text: 'XML mapping (v1.0)', link: '/spec/xml' },
            { text: 'CSV bundle (v1.0)', link: '/spec/csv' },
            { text: 'HTTP binding (v1.0)', link: '/spec/http' },
            { text: 'MCP binding (v1.0)', link: '/spec/mcp' },
            { text: 'OpenAPI 3.1 contract', link: '/spec/UW_HTTP_API_v1.openapi.json' },
            { text: 'Schemas', link: '/spec/schemas/' },
          ],
        },
      ],
      '/conformance/': [
        {
          text: 'Conformance corpus',
          items: [
            { text: 'Overview', link: '/conformance/' },
            { text: 'Tier 1 — Reader', link: '/conformance/tier-1' },
            { text: 'Tier 2 — Editor', link: '/conformance/tier-2' },
            { text: 'Tier 3 — Calc Host', link: '/conformance/tier-3' },
            { text: 'Tier 4 — Agent Host', link: '/conformance/tier-4' },
          ],
        },
      ],
      '/about/': [
        {
          text: 'Project',
          items: [
            { text: 'Roadmap', link: '/about/roadmap' },
            { text: 'Architecture', link: '/about/architecture' },
            { text: 'Versions', link: '/about/versions' },
            { text: 'Governance', link: '/about/governance' },
            { text: 'Maintainers', link: '/about/maintainers' },
            { text: 'Security', link: '/about/security' },
            { text: 'Contributing', link: '/about/contributing' },
            { text: 'Code of Conduct', link: '/about/code-of-conduct' },
            { text: 'Changelog', link: '/about/changelog' },
          ],
        },
        {
          text: 'RFCs',
          items: [
            { text: 'Process', link: '/about/rfcs/' },
            { text: 'Template', link: '/about/rfcs/template' },
            { text: '0001 — Locale negotiation', link: '/about/rfcs/0001-locale-negotiation' },
            { text: '0002 — Module signing', link: '/about/rfcs/0002-module-signing' },
            { text: '0003 — Module asset classes', link: '/about/rfcs/0003-module-asset-classes' },
            { text: '0004 — Conformance runner v2', link: '/about/rfcs/0004-conformance-runner-v2' },
            { text: '0005 — Stochastic calculations', link: '/about/rfcs/0005-stochastic-calculations' },
            { text: '0006 — Hospitality module', link: '/about/rfcs/0006-hospitality-module' },
            { text: '0007 — Sensitivity tables', link: '/about/rfcs/0007-sensitivity-tables' },
            { text: '0008 — Lease-up modeling', link: '/about/rfcs/0008-lease-up-modeling' },
            { text: '0009 — _meta v2 reorg', link: '/about/rfcs/0009-meta-v2-reorg' },
            { text: '0010 — Signed blocks', link: '/about/rfcs/0010-signed-blocks' },
            { text: '0011 — Capability tokens', link: '/about/rfcs/0011-capability-tokens' },
            { text: '0013 — Corpus retrieval', link: '/about/rfcs/0013-corpus-retrieval' },
            { text: '0014 — Multi-format interchange', link: '/about/rfcs/0014-multi-format-interchange' },
          ],
        },
        {
          text: 'Release Plans',
          collapsed: false,
          items: [
            { text: '1.1+ — Machine interchange', link: '/about/releases/1.1-plus-interchange' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jaredmaxey/uw-markdown' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present UW Markdown contributors',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern:
        'https://github.com/jaredmaxey/uw-markdown/edit/main/:path',
      text: 'Edit this page on GitHub',
    },

    outline: {
      level: [2, 3],
    },
  },
});
