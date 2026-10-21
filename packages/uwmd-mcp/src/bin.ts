#!/usr/bin/env node
// stdio entry point: `npx @uwmd/mcp` (after launch) or `node dist/bin.js`.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

await createServer().connect(new StdioServerTransport());
