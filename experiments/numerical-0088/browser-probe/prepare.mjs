// Bundle the actual public browser API, using the repository's existing dev bundler.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(resolve(repo,'package.json'));
const {build}=require('esbuild');
const output=resolve(process.argv[2]);mkdirSync(output,{recursive:true});
const inputs=JSON.parse(readFileSync(resolve(repo,'experiments/numerical-0088/native-reference/inputs.json'),'utf8')).cases.filter(row=>['pow','exp','log'].includes(row.op));
const result=await build({entryPoints:[resolve(repo,'experiments/numerical-0088/browser-probe/probe.mjs')],bundle:true,platform:'browser',format:'iife',target:'es2020',external:['node:crypto'],outfile:resolve(output,'bundle.js'),metafile:true,banner:{js:`globalThis.researchInputs=${JSON.stringify(inputs)};`}});
const sha=x=>createHash('sha256').update(x).digest('hex');
writeFileSync(resolve(output,'index.html'),'<!doctype html><meta charset="utf-8"><pre id="result"></pre><script src="./bundle.js"></script>');
writeFileSync(resolve(output,'bundle-provenance.json'),JSON.stringify({scope:'UNACCEPTED actual browser public primitive run; no production activation',input_count:inputs.length,esbuild:require('esbuild').version,bundle_sha256:sha(readFileSync(resolve(output,'bundle.js'))),source_hashes:Object.fromEntries(Object.keys(result.metafile.inputs).map(path=>[path,sha(readFileSync(resolve(repo,path)))]))},null,2));
console.log(JSON.stringify({inputs:inputs.length,bundle_bytes:readFileSync(resolve(output,'bundle.js')).length}));
