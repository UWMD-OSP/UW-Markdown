// Execute the exact prepared Vitest test text with a small Node assert matcher adapter.
// This is NOT the Vitest runner, a production patch, or a conformance claim.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]);
const {canonicalize}=await import(pathToFileURL(join(root,'packages/uwmd-verify/dist/integrity-canonical.js')).href);
const ts=createRequire(join(root,'package.json'))('typescript');
const source=readFileSync(join(here,'proposed-jcs-unicode.test.ts.txt'),'utf8');
const body=source.replace(/^import[^\n]*from 'vitest';\r?\n/,'').replace(/^import[^\n]*from '\.\/integrity-canonical\.js';\r?\n/m,'');
assert.notEqual(source,body);
const executed=[];
const describe=(_name,fn)=>fn();
const it=(name,fn)=>{fn();executed.push(name);};
it.each=values=>(name,fn)=>{for(const value of values)it(name.replace('%j',JSON.stringify(value)),()=>fn(value));};
const expect=value=>({toBe:expected=>assert.equal(value,expected),toContain:part=>assert.ok(value.includes(part)),
 toThrow:matcher=>assert.throws(value,matcher),not:{toBe:expected=>assert.notEqual(value,expected)}});
const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
new Function('describe','expect','it','canonicalize',compiled)(describe,expect,it,canonicalize);
assert.equal(executed.length,16);
const hash=value=>createHash('sha256').update(value).digest('hex');
const result={scope:'Exact prepared unit-test text executed through Node assert adapter; NOT actual Vitest invocation or production activation',test_source_sha256:hash(source),proposal_source_sha256:hash(readFileSync(join(here,'proposed-jcs-unicode.ts.txt'))),passed:executed.length,executed};
const index=process.argv.indexOf('--output');
if(index>=0){const path=resolve(process.argv[index+1]);if(existsSync(path))throw new Error('Refusing to overwrite frozen evidence');writeFileSync(path,`${JSON.stringify(result,null,2)}\n`);}
else assert.deepEqual(result,JSON.parse(readFileSync(join(here,'astra-jcs-unit-evidence.json'),'utf8')));
console.log(JSON.stringify({prepared_tests_executed:executed.length,status:'passed',framework:'Node assert matcher adapter, not Vitest'}));
