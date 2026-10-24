// Test-only synchronous interface for retained reviewer scripts. Admission,
// projection and canonicalization delegate to actual production modules.
// SHA uses node:crypto for the scripts' synchronous comparisons. Native async
// hashing/stamping APIs are independently exercised by the production suites.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import * as envelope from '../../../packages/uwmd-verify/dist/envelope.js';
import {parseUWFile,parsedPhysicalBlocks} from '../../../packages/uwmd-verify/dist/parser.js';
import {canonicalize} from '../../../packages/uwmd-verify/dist/integrity-canonical.js';
import {assertJSONValue,snapshotJSONValue} from '../../../packages/uwmd-verify/dist/json-admission.js';
import * as values from '../../../packages/uwmd-verify/dist/carrier-values.js';
import {mapExtensionEntry} from '../../../packages/uwmd-verify/dist/extension-entry.js';
import {projectPortableBlock} from '../../../packages/uwmd-verify/dist/portable-projection.js';
import {stringifyUWX} from '../../../packages/uwmd-verify/dist/lite-bridge.js';
export const {VERSION,REPRESENTATION,NAMESPACE,check,object,put,readJSON,esc,arrays,descriptors}=values;
export const has=Object.hasOwn;export const jcs=canonicalize;
export const admitJSONValue=assertJSONValue;export const unicode=text=>{canonicalize(text);return text;};
export const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
export const semantic=envelope.envelopeSemanticValue;export const preimage=envelope.canonicalizeUWEnvelope;
export const digest=model=>sha(Buffer.from(preimage(model)));
export function validateModel(model,stamped=false){envelope.assertUWEnvelope(model);if(stamped)check(model.semantic_digest===digest(model),'semantic digest mismatch');return model;}
export function stamp(model){validateModel(model);const copy=snapshotJSONValue(model);const semantic_digest=digest(copy);return {...copy,semantic_digest};}
export function projectSource(source){const parsed=typeof source==='string'?parseUWFile(source):source;envelope.assertSourceBlockAccounting(parsed);const model=envelope.toUWEnvelope(parsed,{generatedAt:'2000-01-01T00:00:00Z',generator:'candidate'});const count=parsedPhysicalBlocks(parsed).length;return {model,physical_count:count,accounted_count:count};}
export const portable=model=>Object.fromEntries(Object.entries(model.extensions).map(([id,entry])=>[id,mapExtensionEntry(entry,projectPortableBlock)]));
export const toMarkdown=stringifyUWX;
export const candidateSchema=JSON.parse(readFileSync(new URL('../../../spec/schemas/uw-document-envelope.schema.json',import.meta.url),'utf8'));
