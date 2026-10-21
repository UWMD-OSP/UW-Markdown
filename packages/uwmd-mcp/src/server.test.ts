import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from './server.js';

const WRONG_CAP_RATE = readFileSync(resolve(__dirname, '../../../examples/verification/deal.wrong-cap-rate.uwx.md'), 'utf8');

describe('the MCP server', () => {
  const client = new Client({ name: 'test', version: '0.0.0' });
  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    await client.connect(clientTransport);
  });
  afterAll(async () => { await client.close(); });

  it('lists exactly three read-only tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['uwmd_explain_code', 'uwmd_validate', 'uwmd_verify']);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
    }
  });

  it('returns structured content and the same value as JSON text', async () => {
    const result = await client.callTool({ name: 'uwmd_verify', arguments: { source: WRONG_CAP_RATE } });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { ok: boolean };
    expect(structured.ok).toBe(false);
    const [text] = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(text!.text)).toEqual(structured);
  });

  it('reports a refusal as isError with a code and no stack trace', async () => {
    const result = await client.callTool({ name: 'uwmd_validate', arguments: { source: '---\nuw_version: "9.9"\n---\n' } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'UNSUPPORTED_FORMAT_VERSION' });
    const [text] = result.content as Array<{ type: string; text: string }>;
    expect(text!.text).not.toMatch(/\bat \S+:\d+:\d+/);
  });
});
