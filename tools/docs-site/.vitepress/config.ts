import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { docsVersions } from '../../../scripts/docs-site-sources.mjs';
import { markNormative, siteSidebars } from './page-status.mjs';

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
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
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
        text: 'Get started',
        activeMatch: '^/(tutorials|downloads|viewer)/',
        items: [
          { text: 'Quickstart', link: '/tutorials/quickstart' },
          { text: 'Open a deal in the viewer', link: '/viewer/' },
          { text: 'Example deals (GitHub)', link: 'https://github.com/UWMD-OSP/UW-Markdown/tree/main/examples' },
          { text: 'Reference editor', link: 'https://www.uwmd.org/editor/', target: '_self' },
          { text: 'Your first record, by hand', link: '/tutorials/your-first-uwmd-file' },
          { text: 'Templates and downloads', link: '/downloads/' },
          { text: 'UWX and UW Lite', link: '/guide/lite-and-uwx' },
          { text: 'Glossary', link: '/guide/glossary' },
          { text: 'FAQ', link: '/guide/faq' },
        ],
      },
      {
        // RFC 0078: the standard is the format plus verification, everything a
        // lender needs to check a record with none of the project's tools.
        text: 'Standard',
        activeMatch: '^/(spec|conformance)/',
        items: markNormative([
          {
            text: 'The standard (normative)',
            items: [
              { text: `Format specification (${versions.specFormat})`, link: '/spec/format' },
              { text: `Protocol — verification (${versions.specProtocol})`, link: '/spec/protocol' },
              { text: 'Metric dictionary', link: '/spec/metrics/' },
              { text: 'Verification receipts', link: '/spec/receipt' },
              { text: 'Module system', link: '/spec/protocol#vii-module-system' },
              { text: 'Conformance corpus', link: '/conformance/' },
            ],
          },
          {
            text: 'Representations and bindings',
            items: [
              { text: 'UW Lite specification', link: '/spec/lite' },
              { text: 'Document Envelope (2.0)', link: '/spec/envelope' },
              { text: 'XML mapping', link: '/spec/xml' },
              { text: 'CSV bundle', link: '/spec/csv' },
              { text: 'HTTP and MCP bindings', link: '/spec/bindings/' },
              { text: 'Schemas', link: '/spec/schemas/' },
            ],
          },
        ]),
      },
      {
        // Non-normative reference tools, given away so the standard spreads.
        text: 'Tools',
        activeMatch: '^/(starter|guide|ai)/',
        items: [
          {
            text: 'Starter products (non-normative)',
            items: [
              { text: 'Starter products guide', link: '/starter/' },
              { text: 'Tools and packages', link: '/guide/tools' },
              { text: 'Cookbook', link: '/guide/cookbook' },
            ],
          },
          {
            text: 'Calc engine and defaults',
            items: [
              { text: 'Calc conventions', link: '/guide/calc-conventions' },
              { text: 'Calculation context', link: '/guide/calculation-context' },
              { text: 'Property cash flows', link: '/guide/property-cash-flow' },
              { text: 'Lease-up cash flows', link: '/guide/lease-up-cash-flow' },
              { text: 'Defaults and the cascade', link: '/starter/defaults-and-cascade' },
            ],
          },
          {
            text: 'Editor, viewer, report and Excel',
            items: [
              { text: 'Editing', link: '/starter/editing' },
              { text: 'Viewer', link: '/viewer/' },
              { text: 'Display conventions', link: '/starter/display' },
              { text: 'Excel converter', link: '/guide/tools#excel-converter' },
              { text: 'Issuing receipts', link: '/guide/receipts' },
              { text: 'Portfolio and data lake', link: '/guide/data-lake' },
            ],
          },
          {
            text: 'AI agents',
            items: [
              { text: 'Building with AI', link: '/ai/' },
              { text: 'Bounded agent skills', link: '/ai/skills' },
              { text: 'Agent writers and context profiles', link: '/starter/ai-host' },
            ],
          },
        ],
      },
      {
        text: 'Project',
        activeMatch: '^/about/.',
        items: [
          { text: 'Foundation', link: '/guide/foundation' },
          { text: 'How UWMD grows', link: '/guide/how-uwmd-grows' },
          { text: 'Document types', link: '/guide/document-types' },
          { text: 'Known limits', link: '/guide/known-limits' },
          { text: 'Version matrix', link: '/about/versions' },
          { text: 'Changelog', link: '/about/changelog' },
          { text: 'Roadmap', link: '/about/roadmap' },
          { text: 'RFCs', link: '/about/rfcs/' },
          { text: 'Governance', link: '/about/governance' },
        ],
      },
    ],

    sidebar: siteSidebars({
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
            { text: 'The standard: Protocol — verification', link: '/spec/protocol' },
            { text: 'The standard: metric dictionary', link: '/spec/metrics/' },
            { text: 'Starter products guide', link: '/starter/' },
            { text: 'Tools and packages', link: '/guide/tools' },
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
          text: 'The standard',
          items: [
            { text: 'Protocol — verification', link: '/spec/protocol' },
            { text: 'Metric dictionary', link: '/spec/metrics/' },
            { text: 'Receipt specification', link: '/spec/receipt' },
          ],
        },
        {
          text: 'Starter products',
          items: [
            { text: 'Starter products guide', link: '/starter/' },
            { text: 'Tools and packages', link: '/guide/tools' },
            { text: 'Cookbook', link: '/guide/cookbook' },
            { text: 'Issuing receipts', link: '/guide/receipts' },
            { text: 'Portfolio and data lake', link: '/guide/data-lake' },
            { text: 'Building with AI', link: '/ai/' },
          ],
        },
        {
          text: 'Calc engine (starter)',
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
          text: 'AI agents (starter products)',
          items: [
            { text: 'Building with AI', link: '/ai/' },
            { text: 'Bounded agent skills', link: '/ai/skills' },
            { text: 'MCP binding', link: '/spec/mcp' },
            { text: 'HTTP binding', link: '/spec/http' },
            { text: 'Agent writers and context profiles', link: '/starter/ai-host' },
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
          text: 'The standard (normative)',
          items: [
            { text: `Format spec (${versions.specFormat})`, link: '/spec/format' },
            { text: `Protocol — verification (${versions.specProtocol})`, link: '/spec/protocol' },
            { text: 'Metric dictionary', link: '/spec/metrics/' },
            { text: `Verification receipt (${versions.receipt})`, link: '/spec/receipt' },
            { text: 'Module system', link: '/spec/protocol#vii-module-system' },
            { text: 'Conformance corpus', link: '/conformance/' },
            { text: 'Metric verification', link: '/conformance/metrics' },
          ],
        },
        {
          text: 'Representations and bindings',
          items: [
            { text: 'UW Lite spec (v1.0)', link: '/spec/lite' },
            { text: 'Document Envelope (2.0)', link: '/spec/envelope' },
            { text: 'XML mapping (2.0)', link: '/spec/xml' },
            { text: 'CSV bundle (2.0)', link: '/spec/csv' },
            { text: 'Composition spec (v1.0)', link: '/spec/composition' },
            { text: 'Transport bindings', link: '/spec/bindings/' },
            { text: 'HTTP binding (v1.0)', link: '/spec/http' },
            { text: 'MCP binding (v1.0)', link: '/spec/mcp' },
            { text: 'OpenAPI 3.1 contract', link: '/spec/UW_HTTP_API_v1.openapi.json' },
            { text: 'Schemas', link: '/spec/schemas/' },
          ],
        },
        {
          text: 'Starter products (non-normative)',
          items: [
            { text: 'Starter products guide', link: '/starter/' },
          ],
        },
      ],
      '/starter/': [
        {
          text: 'Starter products (non-normative)',
          items: [
            { text: 'Overview', link: '/starter/' },
            { text: 'Display conventions', link: '/starter/display' },
            { text: 'View models', link: '/starter/view-models' },
            { text: 'Editing', link: '/starter/editing' },
            { text: 'Defaults and the cascade', link: '/starter/defaults-and-cascade' },
            { text: 'Refinement and workbooks', link: '/starter/refinement-and-workbooks' },
            { text: 'Agent writers and context profiles', link: '/starter/ai-host' },
            { text: 'Capability tokens', link: '/starter/capability-tokens' },
            { text: 'CLI reference', link: '/starter/cli' },
            { text: 'Renderer reference', link: '/starter/rendering' },
          ],
        },
        {
          text: 'The reference tools',
          items: [
            { text: 'Tools and packages', link: '/guide/tools' },
            { text: 'Calc conventions', link: '/guide/calc-conventions' },
            { text: 'Excel converter', link: '/guide/tools#excel-converter' },
            { text: 'Viewer', link: '/viewer/' },
            { text: 'Building with AI', link: '/ai/' },
          ],
        },
        {
          text: 'The standard',
          items: [
            { text: `Protocol — verification (${versions.specProtocol})`, link: '/spec/protocol' },
            { text: `Format spec (${versions.specFormat})`, link: '/spec/format' },
            { text: 'Metric dictionary', link: '/spec/metrics/' },
          ],
        },
      ],
      '/conformance/': [
        {
          text: 'Conformance corpus',
          items: [
            { text: 'Overview', link: '/conformance/' },
            { text: 'Reader and validation fixtures', link: '/conformance/documents' },
            { text: 'Editor starter checks', link: '/conformance/starter-editor' },
            { text: 'Calculation fixtures', link: '/conformance/calc' },
            { text: 'Refinement starter checks', link: '/conformance/starter-refinement' },
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
      ],
    }),

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
