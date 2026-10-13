// RFC 0041 contextual references and the Excel emitter (a starter product).
// The references themselves are @uwmd/verify's (period-path.test.ts there);
// this case moved here with the emitter (RFC 0083).
import { describe, expect, it } from 'vitest';
import { parseExpression } from '@uwmd/verify';
import { emitFromAst } from './excel-emit.js';

describe('RFC 0041 contextual references', () => {
  it('refuses Excel emission explicitly even if a caller offers a static named range', () => {
    const path = 'dcf.annual_cash_flows@Y3.noi';
    expect(() => emitFromAst(parseExpression(path), { namedRanges: new Map([[path, 'noi_y3']]) })).toThrowError(expect.objectContaining({ code: 'EXCEL-EMIT-PATH' }));
  });
});
