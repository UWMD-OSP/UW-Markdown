// The two entries (RFC 0083 §1): `./browser` exports exactly what `.` exports,
// binding for binding. Nothing in this package is Node-only
// (`standard-closure.test.ts` refuses a static `node:` import anywhere), so a
// name missing from the browser entry would only be an omission.
import { describe, expect, it } from 'vitest';
import * as browser from './browser.js';
import * as index from './index.js';

describe('the browser entry', () => {
  it('exports every name the main entry exports, and nothing else', () => {
    expect(Object.keys(browser).sort()).toEqual(Object.keys(index).sort());
  });

  it('exports the same bindings', () => {
    for (const name of Object.keys(index)) {
      expect((browser as Record<string, unknown>)[name], name).toBe((index as Record<string, unknown>)[name]);
    }
  });

  it('includes the integrity verifiers the core browser entry lacked before RFC 0083', () => {
    for (const name of ['verifyChain', 'verifyProvenance', 'computeBlockHash', 'canonicalize', 'sha256Hex']) {
      expect(typeof (browser as Record<string, unknown>)[name], name).toBe('function');
    }
  });
});
