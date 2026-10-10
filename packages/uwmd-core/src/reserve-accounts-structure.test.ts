import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseUWFile } from './parser.js';
import { checkReserveAccountsStructure } from './reserve-accounts-structure.js';
import { lookupRemediation } from './validator.js';
import { isStandardSectionId } from './protocol.js';
const read = (p: string) => readFileSync(new URL('../../../' + p, import.meta.url),'utf8');
const ajv=new Ajv2020({strict:false}); addFormats.default(ajv);
const schema=ajv.compile(JSON.parse(read('spec/schemas/section-reserve-accounts.schema.json')));
describe('RFC 0064 structural source profile',()=>{
  it.each(readdirSync(new URL('../../../conformance/reserve-accounts/',import.meta.url),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name))('%s keeps runtime/schema shape parity',name=>{
    const parsed=parseUWFile(read('conformance/reserve-accounts/'+name+'/deal.uwx.md'));
    const structure=checkReserveAccountsStructure(parsed);
    for(const {payload} of structure.sections){
      const accepted=schema(payload);
      // JSON Schema cannot express cross-row identity, order, document currency or finite binary64 arithmetic.
      const semanticOnly=['RSV-02','RSV-05'];
      if(name==='currency-disagrees'||name==='overflow') expect(accepted).toBe(true);
      else if(!accepted) expect(structure.issues.some(i=>!semanticOnly.includes(i.code)),JSON.stringify(schema.errors)).toBe(true);
      else expect(structure.issues.filter(i=>!semanticOnly.includes(i.code))).toEqual([]);
    }
  });
  it('registers the optional standard section and every finding remediation',()=>{
    expect(isStandardSectionId('reserve_accounts')).toBe(true);
    for(let n=1;n<=8;n++) expect(lookupRemediation('RSV-0'+n)?.code).toBe('RSV-0'+n);
  });
  it('refuses nonfinite numeric inputs before arithmetic',()=>{
    const parsed=parseUWFile(read('conformance/reserve-accounts/verified-source-classes/deal.uwx.md'));
    const payload=checkReserveAccountsStructure(parsed).sections[0]!.payload;
    payload.accounts[0]!.periods[0]!.movements[0]!.amount=Infinity;
    expect(checkReserveAccountsStructure(parsed).issues.map(i=>i.code)).toEqual(['RSV-01']);
  });
});
