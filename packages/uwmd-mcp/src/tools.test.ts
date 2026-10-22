import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConnectorError, explainCode, MAX_SOURCE_BYTES, validateSource, verifySource } from './tools.js';
import { CONNECTOR_VERSION } from './version.js';

const repo = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8');
const VALID = repo('examples/verification/deal.uwx.md');
const WRONG_CAP_RATE = repo('examples/verification/deal.wrong-cap-rate.uwx.md');

describe('validateSource', () => {
  it('validates a clean record', () => {
    const result = validateSource(VALID);
    expect(result.rule_set).toBe('3.0');
    expect(result.error_count).toBe(0);
    expect(typeof result.stage_readiness.screening).toBe('boolean');
    for (const issue of result.issues) expect(Object.keys(issue).sort()).toEqual(expect.arrayContaining(['code', 'message', 'severity']));
  });

  it('reports a parse refusal as a ConnectorError carrying the standard code', () => {
    expect(() => validateSource('---\nuw_version: "9.9"\n---\n')).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FORMAT_VERSION' }));
  });

  it('refuses no source and an oversized source', () => {
    expect(() => validateSource('')).toThrow(ConnectorError);
    expect(() => validateSource(undefined)).toThrow(expect.objectContaining({ code: 'UWMD-MCP-NO-SOURCE' }));
    expect(() => validateSource('x'.repeat(MAX_SOURCE_BYTES + 1))).toThrow(expect.objectContaining({ code: 'UWMD-MCP-TOO-LARGE' }));
  });
});

describe('verifySource', () => {
  it('verifies a record whose stated metrics all recompute', async () => {
    const result = await verifySource(VALID);
    expect(result.ok).toBe(true);
    expect([result.validation.rule_set, result.stated_metrics.rule_set]).toEqual(['3.0', '3.0']);
    expect(result.stated_metrics.counts.failed).toBe(0);
    expect(result.stated_metrics.counts.verified).toBeGreaterThan(0);
  });

  it('fails the record with a wrong stated cap rate, naming what was stated and recomputed', async () => {
    const result = await verifySource(WRONG_CAP_RATE);
    expect(result.ok).toBe(false);
    expect(result.stated_metrics.failed).toEqual([{ id: 'cap_rate', path: 'quick_metrics.cap_rate', stated: 0.06, computed: 0.0542 }]);
  });
});

describe('explainCode', () => {
  it('returns the registry entry for a code, case-insensitively', () => {
    const entry = explainCode('size-01');
    expect(entry.code).toBe('SIZE-01');
    expect(entry.severity).toBe('error');
    expect(entry.remediation.length).toBeGreaterThan(0);
  });

  it('refuses an unknown or missing code', () => {
    expect(() => explainCode('NOPE-99')).toThrow(expect.objectContaining({ code: 'UWMD-MCP-UNKNOWN-CODE' }));
    expect(() => explainCode('')).toThrow(expect.objectContaining({ code: 'UWMD-MCP-NO-CODE' }));
  });
});

describe('version', () => {
  it('matches package.json and server.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as { version: string };
    const server = JSON.parse(readFileSync(resolve(__dirname, '../server.json'), 'utf8')) as { version: string; packages: Array<{ version: string }> };
    expect(CONNECTOR_VERSION).toBe(pkg.version);
    expect(server.version).toBe(pkg.version);
    expect(server.packages.map((p) => p.version)).toEqual([pkg.version]);
  });
});
