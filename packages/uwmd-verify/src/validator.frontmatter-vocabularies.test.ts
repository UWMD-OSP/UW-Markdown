import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { FRONTMATTER_VOCABULARIES } from './protocol.js';
import { validateUWFile } from './validator.js';

const fields = [
  ['deal_stage', 'INVALID-DEAL-STAGE-001'], ['tier', 'INVALID-TIER-001'],
  ['status', 'INVALID-STATUS-001'], ['recommendation', 'INVALID-RECOMMENDATION-001'],
] as const;
const file = () => parseUWFile('---\nuw_version: "3.0"\nasset_class: multifamily\n---\n');

describe('RFC 0118 closed frontmatter vocabularies', () => {
  for (const [field, code] of fields) {
    it(`${field} admits every named value, null and absence`, () => {
      for (const value of [...FRONTMATTER_VOCABULARIES[field], null, undefined]) {
        const parsed = file();
        Object.assign(parsed.frontmatter, { [field]: value });
        expect(validateUWFile(parsed).issues.filter(issue => issue.code === code)).toEqual([]);
      }
    });
    it(`${field} refuses invalid values without normalizing or mutating them`, () => {
      for (const value of ['bogus', '', 'toString', '__proto__', ' pending', 3, false, [], {}]) {
        const parsed = file();
        Object.assign(parsed.frontmatter, { [field]: value });
        const before = JSON.stringify(parsed);
        const report = validateUWFile(parsed);
        const found = report.issues.filter(issue => issue.code === code);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ severity: 'error', section: 'frontmatter', field, value });
        expect(report.overall_status).toBe('errors');
        expect(Object.keys(report.stage_readiness)).toHaveLength(7);
        if (field === 'deal_stage') expect(report.issues.some(issue => issue.code === 'DQ-06')).toBe(false);
        expect(JSON.stringify(parsed)).toBe(before);
      }
    });
  }
});
