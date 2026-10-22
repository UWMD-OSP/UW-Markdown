// The MCP server: three read-only tools over the functions in tools.ts.
// Results follow the UW MCP binding's result rule (spec/bindings/UW_MCP_BINDING_v1.md
// §3): structured content plus the same value as one compact JSON text block;
// errors are `isError: true` with a structured code and no stack trace.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ConnectorError, explainCode, validateSource, verifySource } from './tools.js';
import { CONNECTOR_VERSION } from './version.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function ok(value: object): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> };
}

function refused(error: unknown): ToolResult {
  const e = error instanceof ConnectorError ? error : new ConnectorError('UWMD-MCP-INTERNAL', 'The record could not be processed.');
  const value = { code: e.code, message: e.message };
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, isError: true };
}

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false } as const;

const SOURCE = z.string().describe('The complete text of a .uwx.md record, frontmatter included.');

export function createServer(): McpServer {
  const server = new McpServer({ name: 'uwmd', version: CONNECTOR_VERSION });

  server.registerTool('uwmd_validate', {
    title: 'Validate a UW Markdown record',
    description: 'Check a .uwx.md underwriting record against the UW Markdown Format rules. Returns the overall status, stage readiness, every issue (code, severity, section, field, message) and, separately, deal flags: Format §5.2 financial-validity bands the deal crosses (code, band, section, field, message), which describe the deal, not a defect in the record. Use uwmd_explain_code for what a code means.',
    inputSchema: { source: SOURCE },
    annotations: READ_ONLY,
  }, async ({ source }) => {
    try { return ok(validateSource(source)); } catch (error) { return refused(error); }
  });

  server.registerTool('uwmd_verify', {
    title: 'Verify a UW Markdown record',
    description: 'Verify a .uwx.md record: validation, every stated metric recomputed from the record\'s own inputs (failed and unverifiable statements are listed), the hash chain and provenance. The figures are computed by the standard\'s reference implementation; do not recompute them yourself.',
    inputSchema: { source: SOURCE },
    annotations: READ_ONLY,
  }, async ({ source }) => {
    try { return ok(await verifySource(source)); } catch (error) { return refused(error); }
  });

  server.registerTool('uwmd_explain_code', {
    title: 'Explain a UW Markdown validation code',
    description: 'What a validation code (for example CC-03 or SIZE-01) means, its severity, how to fix it, and where the spec defines it.',
    inputSchema: { code: z.string().describe('A validation code, for example CC-03.') },
    annotations: READ_ONLY,
  }, async ({ code }) => {
    try { return ok(explainCode(code)); } catch (error) { return refused(error); }
  });

  return server;
}
