// UNAPPLIED proposal: change exactly one loaded module in an isolated process.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(process.env.ASTRA_REPO_ROOT);
const target=pathToFileURL(join(root,'packages/uwmd-verify/dist/integrity-canonical.js')).href;
const ts=createRequire(join(root,'package.json'))('typescript');
const expected='93f3a8b8f57e7135030bf551780fc3d9862a83d8b19d981fe3086e035c1994d3';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function load(url,context,next){
 const loaded=await next(url,context);
 if(url!==target)return loaded;
 if(hash(readFileSync(join(root,'packages/uwmd-verify/src/integrity-canonical.ts')))!==expected)throw new Error('Pinned source contract differs');
 const proposed=readFileSync(new URL('./proposed-jcs-unicode.ts.txt',import.meta.url),'utf8');
 return {...loaded,source:ts.transpileModule(proposed,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText};
}
