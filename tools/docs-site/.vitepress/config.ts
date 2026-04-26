import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'UW Markdown',
  description:
    'An open standard for commercial real-estate underwriting documents — readable by humans, AI tools, and software alike.',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README.md'],

  head: [
    ['meta', { name: 'theme-color', content: '#0f172a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'UW Markdown' }],
    ['meta', {
      property: 'og:description',
      content: 'Open standard for CRE underwriting documents.',
    }],
  ],

  themeConfig: {
    siteTitle: 'UW Markdown',

    nav: [
      { text: 'Spec', link: '/spec/format' },
      { text: 'Protocol', link: '/spec/protocol' },
      { text: 'Schemas', link: '/spec/schemas/' },
      { text: 'Conformance', link: '/conformance/' },
      { text: 'About', link: '/about/roadmap' },
      {
        text: 'v1',
        items: [
          { text: 'Changelog', link: '/about/changelog' },
          { text: 'GitHub', link: 'https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0' },
          { text: 'npm — @uwmd/core', link: 'https://www.npmjs.com/package/@uwmd/core' },
        ],
      },
    ],

    sidebar: {
      '/spec/': [
        {
          text: 'Specifications',
          items: [
            { text: 'Format spec (v1.1)', link: '/spec/format' },
            { text: 'Protocol spec (v1.0)', link: '/spec/protocol' },
            { text: 'JSON Schemas', link: '/spec/schemas/' },
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
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0' },
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
        'https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0/edit/main/:path',
      text: 'Edit this page on GitHub',
    },

    outline: {
      level: [2, 3],
    },
  },
});
