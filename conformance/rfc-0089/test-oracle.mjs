// Test-only hash oracle; production implementations are imported directly.
import {createHash} from 'node:crypto';
import {canonicalize} from '../../packages/uwmd-verify/dist/integrity-canonical.js';
import {parseUWFile,parsedPhysicalBlocks} from '../../packages/uwmd-verify/dist/parser.js';
import {toUWEnvelope,stampEnvelopeDigest} from '../../packages/uwmd-verify/dist/envelope.js';
export const jcs=canonicalize;
export const preimage = model => jcs(Object.fromEntries(Object.entries(model).filter(([key])=>!['generated_at','generator','semantic_digest'].includes(key))));
export const digest = model => `sha256:${createHash('sha256').update(preimage(model)).digest('hex')}`;
export const stamp=stampEnvelopeDigest;
export const projectSource = source => { const parsed=typeof source==='string'?parseUWFile(source):source; const model=toUWEnvelope(parsed,{generatedAt:'2000-01-01T00:00:00Z',generator:'candidate'});return {model,physical_count:parsedPhysicalBlocks(parsed).length}; };
