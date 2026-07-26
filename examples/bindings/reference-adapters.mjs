// Runnable, SDK-neutral HTTP/MCP binding example.
// Run `npm run build` first, then `node examples/bindings/reference-adapters.mjs`.

import { readFile } from 'node:fs/promises';
import {
  createUWMCPApplyEditResult,
  createUWHTTPResponse,
  createUWMCPGetDocumentResult,
  createUWMCPListRepresentationsResult,
  createUWMCPResource,
  createUWMCPValidationResult,
  parseUWFile,
  stampEnvelopeDigest,
  toUWEnvelope,
  uwmdETag,
} from '../../packages/uwmd-core/dist/index.js';

export function createReferenceBindings(initialSource) {
  let source = initialSource;

  async function load() {
    return stampEnvelopeDigest(toUWEnvelope(parseUWFile(source)));
  }

  return {
    // Adapt this result to Node, Express, Hono, Workers, or another HTTP stack.
    async httpGet({ accept, ifNoneMatch } = {}) {
      return createUWHTTPResponse(await load(), { accept, ifNoneMatch });
    },

    // Adapt these callbacks to resources/read and tools/call in the MCP SDK used
    // by the deployment. They already return MCP-compatible content shapes.
    async readResource({ deal_id, representation, view }) {
      return {
        contents: [await createUWMCPResource(await load(), deal_id, { representation, view })],
      };
    },

    tools: {
      async 'uwmd.get_document'({ deal_id, representation, view }) {
        return createUWMCPGetDocumentResult(await load(), deal_id, { representation, view });
      },
      async 'uwmd.validate'({ deal_id }) {
        return createUWMCPValidationResult(await load(), deal_id);
      },
      async 'uwmd.convert'({ deal_id, target_representation }) {
        return createUWMCPGetDocumentResult(await load(), deal_id, {
          representation: target_representation,
        });
      },
      async 'uwmd.apply_edit'({ deal_id, if_match, operation, context }) {
        const applied = await createUWMCPApplyEditResult(source, operation, context, if_match);
        source = applied.edit.source;
        return applied.result;
      },
      async 'uwmd.list_representations'() {
        return createUWMCPListRepresentationsResult();
      },
    },

    async currentETag() {
      return uwmdETag(await load());
    },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const source = await readFile(new URL('../Parkview-Apts-Glendale-AZ.uw.md', import.meta.url), 'utf8');
  const bindings = createReferenceBindings(source);
  console.log(JSON.stringify((await bindings.tools['uwmd.list_representations']()).structuredContent, null, 2));
}
