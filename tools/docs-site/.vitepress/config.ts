import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { docsVersions } from '../../../scripts/docs-site-sources.mjs';

const versions = docsVersions(fileURLToPath(new URL('../../../', import.meta.url)));
const SITE_DESCRIPTION =
  'One verifiable underwriting record for every CRE deal: the open .uwx.md standard that keeps deal facts, assumptions, narrative, and provenance together, with financial results computed by deterministic code.';

export default defineConfig({
  title: 'UW Markdown',
  description: SITE_DESCRIPTION,
  cleanUrls: true,
  lastUpdated: true,
  // XSD is copied to public/ as a downloadable static asset.
  ignoreDeadLinks: [/\.xsd$/, /^\/downloads\//],
  srcExclude: ['README.md'],

  head: [
    ['meta', { name: 'theme-color', content: '#315f4b' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'UW Markdown' }],
    ['meta', {
      property: 'og:description',
      content: SITE_DESCRIPTION,
    }],
    ['meta', { property: 'og:site_name', content: 'UW Markdown' }],
    ['meta', { property: 'og:image', content: 'https://www.uwmd.org/og-v2.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'UW Markdown' }],
    ['meta', {
      name: 'twitter:description',
      content: SITE_DESCRIPTION,
    }],
    ['meta', { name: 'twitter:image', content: 'https://www.uwmd.org/og-v2.png' }],
  ],

  themeConfig: {
    siteTitle: 'UW Markdown',

    nav: [
      { text: 'Why UWMD', link: '/about/', activeMatch: '^/about/$' },
      {
        text: 'Examples',
        items: [
          { text: 'Open a deal in the viewer', link: '/viewer/' },
          { text: 'Edit a deal in the reference editor', link: 'https://www.uwmd.org/editor/', target: '_self' },
          { text: 'All example records (GitHub)', link: 'https://github.com/UWMD-OSP/UW-Markdown/tree/main/examples' },
        ],
      },
      {
        text: 'Get started',
        activeMatch: '^/(tutorials|downloads)/',
        items: [
          { text: 'Quickstart', link: '/tutorials/quickstart' },
          { text: 'Your first record, by hand', link: '/tutorials/your-first-uwmd-file' },
          { text: 'Templates and downloads', link: '/downloads/' },
          { text: 'UWX and UW Lite', link: '/guide/lite-and-uwx' },
          { text: 'Glossary', link: '/guide/glossary' },
          { text: 'FAQ', link: '/guide/faq' },
        ],
      },
      {
        text: 'Integrate',
        activeMatch: '^/(guide|ai)/',
        items: [
          {
            items: [
              { text: 'Tools and packages', link: '/guide/tools' },
              { text: 'Cookbook', link: '/guide/cookbook' },
              { text: 'Verification receipts', link: '/guide/receipts' },
              { text: 'Portfolio and data lake', link: '/guide/data-lake' },
            ],
          },
          {
            text: 'Calculation',
            items: [
              { text: 'Calc conventions', link: '/guide/calc-conventions' },
              { text: 'Calculation context', link: '/guide/calculation-context' },
              { text: 'Property cash flows', link: '/guide/property-cash-flow' },
              { text: 'Lease-up cash flows', link: '/guide/lease-up-cash-flow' },
            ],
          },
          {
            text: 'AI and services',
            items: [
              { text: 'Building with AI', link: '/ai/' },
              { text: 'Bounded agent skills', link: '/ai/skills' },
              { text: 'HTTP and MCP bindings', link: '/spec/bindings/' },
            ],
          },
        ],
      },
      {
        text: 'Reference',
        activeMatch: '^/(spec|conformance)/',
        items: [
          {
            text: 'Normative contract',
            items: [
              { text: `Format specification (v${versions.format})`, link: '/spec/format-v2' },
              { text: `Protocol (${versions.protocol})`, link: '/spec/protocol' },
              { text: 'UW Lite specification', link: '/spec/lite' },
              { text: 'Schemas', link: '/spec/schemas/' },
              { text: 'Conformance corpus', link: '/conformance/' },
            ],
          },
          {
            text: 'Project',
            items: [
              { text: 'Version matrix', link: '/about/versions' },
              { text: 'Changelog', link: '/about/changelog' },
              { text: 'Roadmap', link: '/about/roadmap' },
              { text: 'RFCs', link: '/about/rfcs/' },
              { text: 'Governance', link: '/about/governance' },
            ],
          },
        ],
      },
    ],

    sidebar: {
      '/tutorials/': [
        {
          text: 'Get started',
          items: [
            { text: 'Quickstart', link: '/tutorials/quickstart' },
            { text: 'Your first record, by hand', link: '/tutorials/your-first-uwmd-file' },
            { text: 'Templates and downloads', link: '/downloads/' },
            { text: 'UWX and UW Lite', link: '/guide/lite-and-uwx' },
            { text: 'Glossary', link: '/guide/glossary' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
        {
          text: 'Next',
          items: [
            { text: 'Tools and packages', link: '/guide/tools' },
            { text: 'Verification receipts', link: '/guide/receipts' },
            { text: 'Building with AI', link: '/ai/' },
          ],
        },
      ],
      '/guide/': [
        {
          text: 'Get started',
          items: [
            { text: 'Quickstart', link: '/tutorials/quickstart' },
            { text: 'UWX and UW Lite', link: '/guide/lite-and-uwx' },
            { text: 'Glossary', link: '/guide/glossary' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
        {
          text: 'Integrate',
          items: [
            { text: 'Tools and packages', link: '/guide/tools' },
            { text: 'Cookbook', link: '/guide/cookbook' },
            { text: 'Verification receipts', link: '/guide/receipts' },
            { text: 'Portfolio and data lake', link: '/guide/data-lake' },
            { text: 'Building with AI', link: '/ai/' },
          ],
        },
        {
          text: 'Calculation',
          items: [
            { text: 'Calc conventions', link: '/guide/calc-conventions' },
            { text: 'Calculation context', link: '/guide/calculation-context' },
            { text: 'Property cash flows', link: '/guide/property-cash-flow' },
            { text: 'Lease-up cash flows', link: '/guide/lease-up-cash-flow' },
          ],
        },
      ],
      '/ai/': [
        {
          text: 'AI and agents',
          items: [
            { text: 'Building with AI', link: '/ai/' },
            { text: 'Bounded agent skills', link: '/ai/skills' },
            { text: 'MCP binding', link: '/spec/mcp' },
            { text: 'HTTP binding', link: '/spec/http' },
          ],
        },
        {
          text: 'Related',
          items: [
            { text: 'Verification receipts', link: '/guide/receipts' },
            { text: 'Calc conventions', link: '/guide/calc-conventions' },
            { text: 'Tools and packages', link: '/guide/tools' },
          ],
        },
      ],
      '/spec/': [
        {
          text: 'Specifications',
          items: [
            { text: 'Format spec (v2.0)', link: '/spec/format-v2' },
            { text: 'Format spec (v1.1)', link: '/spec/format' },
            { text: `Protocol spec (${versions.protocol})`, link: '/spec/protocol' },
            { text: 'UW Lite spec (v1.0)', link: '/spec/lite' },
            { text: 'XML mapping (v1.0)', link: '/spec/xml' },
            { text: 'CSV bundle (v1.0)', link: '/spec/csv' },
            { text: 'Verification receipt (v1.0)', link: '/spec/receipt' },
            { text: 'Composition spec (v1.0)', link: '/spec/composition' },
            { text: 'Transport bindings', link: '/spec/bindings/' },
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
            { text: 'Language-agnostic runner', link: '/conformance/runner' },
          ],
        },
      ],
      '/about/': [
        {
          text: 'Project',
          items: [
            { text: 'About UW Markdown', link: '/about/' },
            { text: 'Roadmap', link: '/about/roadmap' },
            { text: 'Architecture', link: '/about/architecture' },
            { text: 'Versions', link: '/about/versions' },
            { text: 'Governance', link: '/about/governance' },
            { text: 'Maintainers', link: '/about/maintainers' },
            { text: 'Security', link: '/about/security' },
            { text: 'Contributing', link: '/about/contributing' },
            { text: 'Reporting problems', link: '/about/feedback' },
            { text: 'Code of Conduct', link: '/about/code-of-conduct' },
            { text: 'Changelog', link: '/about/changelog' },
          ],
        },
        {
          text: 'RFCs',
          items: [
            { text: 'Process and index', link: '/about/rfcs/' },
            { text: 'Template', link: '/about/rfcs/template' },
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
      { icon: 'github', link: 'https://github.com/UWMD-OSP/UW-Markdown' },
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
        'https://github.com/UWMD-OSP/UW-Markdown/edit/main/:path',
      text: 'Edit this page on GitHub',
    },

    outline: {
      level: [2, 3],
    },
  },
});
