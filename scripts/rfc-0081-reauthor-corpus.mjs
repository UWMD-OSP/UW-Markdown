// One-off RFC 0081 Phase 3 corpus re-authoring; delete in Phase 4.
// This is repository maintenance, not an exported migration feature.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { migrateSourceTags, migrateToV2, reshapeMetaV1toV2, reshapeMetaV2toV1, parseUWFile, issueReceipt, toUWEnvelope, computeEnvelopeDigest, encodeUWDealPackageZip, runBancroftAgent } from '../packages/uwmd-core/dist/index.js';
import { canonicalizeExact } from '../packages/uwmd-core/dist/integrity-canonical.js';
import { importPrivateKey, signBlock, stampModuleSignature } from '../packages/uwmd-signing/dist/index.js';

const root = resolve('.');
const write = process.argv.includes('--write');
const files = execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean);
const key = { kid: 'uwmd-conformance-ed25519', alg:'ed25519', privateKey: await importPrivateKey('ed25519',{jwk:JSON.parse(readFileSync('conformance/signing/keys/signer-private.jwk.json','utf8'))}) };
const report = { files: {}, refusals: [], conflicts: [], dropped: [], receipts: [], uses_differences: [] };
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const retired = new Set(['HDG-04','HDG-05','ESC-03','CAPX-05','REC-10','TAX-04','CLS-01','CLS-02','CLS-05']);
const oldTiers = {'tier-1-reader':'reader','tier-2-editor':'reader','tier-3-calc-host':'verifier','tier-4-agent-host':'verifier'};
function mergeFact(target,key,value,file) {
  if (target[key] === undefined) target[key] = value;
  else if (JSON.stringify(target[key]) !== JSON.stringify(value)) report.conflicts.push({file,field:key,kept:target[key],removed:value});
}
function moveGroups(payload,section,file) {
  if (section === 'debt_structure' && Object.hasOwn(payload,'rate_cap_pct')) {
    if (payload.rate_cap_pct !== null) {
      payload.rate_hedge ??= {instrument:'rate_cap'};
      if(obj(payload.rate_hedge)) mergeFact(payload.rate_hedge,'strike_rate',payload.rate_cap_pct,file);
    }
    delete payload.rate_cap_pct;
  }
  const uses = payload.uses;
  if (obj(uses)) {
    for (const [legacy,name] of [['interest_reserve','interest'],['operating_reserves','operating']]) {
      if (!Object.hasOwn(uses,legacy)) continue;
      if (uses[legacy] !== null) {
        uses.escrows ??= [];
        if (Array.isArray(uses.escrows)) {
          let escrow = uses.escrows.find(e => obj(e)&&e.name===name);
          if(!escrow) uses.escrows.push(escrow={name});
          mergeFact(escrow,'upfront',uses[legacy],file);
        }
      }
      delete uses[legacy];
    }
    for(const [legacy,name] of [['renovation_budget','budget'],['renovation_contingency','contingency']]) {
      if(!Object.hasOwn(uses,legacy)) continue;
      if(uses[legacy] !== null) { uses.renovation ??= {}; if(obj(uses.renovation)) mergeFact(uses.renovation,name,uses[legacy],file); }
      delete uses[legacy];
    }
  }
  function tenants(value) {
    if (Array.isArray(value)) { value.forEach(tenants); return; }
    if(!obj(value)) return;
    if(Object.hasOwn(value,'cam_cap_pct')) {
      if(value.cam_cap_pct !== null) { value.recovery_terms ??= {}; if(obj(value.recovery_terms)) { value.recovery_terms.cap ??= {}; if(obj(value.recovery_terms.cap)) mergeFact(value.recovery_terms.cap,'pct',value.cam_cap_pct,file); } }
      delete value.cam_cap_pct;
    }
    if(Object.hasOwn(value,'sale_triggers_reassessment')) {
      if(value.sale_triggers_reassessment===true) {value.reassessment ??= {}; if(obj(value.reassessment)) mergeFact(value.reassessment,'trigger','sale',file);}
      delete value.sale_triggers_reassessment;
    }
    for(const [k,v] of Object.entries(value)) if(k !== '_meta') tenants(v);
  }
  tenants(payload);
}
function bare(value,section,file) {
  if(!obj(value)) return value;
  if(Object.hasOwn(value,'section_id') && Object.hasOwn(value,'content') && obj(value.content)) {
    const {section_id:_id,content,...annotations}=value;
    value={...annotations,...content};
  }
  const raw=value._meta;
  if(obj(raw)) {
    if(!(obj(raw.provenance)&&obj(raw.lifecycle))) {
      const reshaped=reshapeMetaV1toV2({...raw,section:raw.section ?? raw.section_id ?? section});
      value={_meta:reshaped,...Object.fromEntries(Object.entries(value).filter(([k])=>k!=='_meta'))};
      if(raw.field_overrides && !value._overrides) value._overrides=raw.field_overrides;
    }
    delete value._meta.section_id;
  }
  moveGroups(value,section,file);
  return value;
}
function preserveNumbers(original,json) {
  const tokens = new Map();
  for(const m of original.matchAll(/"([^"\n]+)"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)) {
    const id=m[1]+'='+Number(m[2]);
    if(!tokens.has(id)) tokens.set(id,m[2]);
  }
  return json.replace(/"([^"\n]+)"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,(s,k,v)=>s.slice(0,s.lastIndexOf(v))+(tokens.get(k+'='+Number(v))??v));
}
async function document(source,file) {
  if(!/uw_version\s*:/.test(source) && !source.includes('```json uw:')) return source;
  const original=source;
  const sourceTags=migrateSourceTags(source); source=sourceTags.content;
  const migrated=await migrateToV2(source,{resign:async req=>signBlock({meta:{section:req.section,actor:req.actor,timestamp:req.timestamp,content_hash:req.content_hash}}, {...key,kid:req.prior.kid},{signedAt:req.prior.signed_at})});
  if(migrated.ok) source=migrated.content;
  else report.refusals.push({file,reasons:migrated.refusals});
  source=source.replace(/^(\s*uw_version:\s*)(?:["']?)[^\s"']+(?:["']?)/gm,'$1"3.0"').replaceAll('org.uwmd.data_center','data_center');
  // Official module dependencies are satisfied by the builtin class, not modules.
  source=source.replace(/^modules:\s*\n(?:[ \t]+[^\n]*\n)+/gm, block => {
    const lines=block.split('\n');const result=[];let drop=false;
    for(const line of lines) {if(/^\s*-\s*(?:id:\s*)?/.test(line)) drop=/org\.uwmd\.(hospitality|datacenters)/.test(line); if(!drop) result.push(line);}
    return result.filter(l=>l.trim()).length>1 ? result.join('\n') : '';
  });
  const blocks=[];
  const re=/^```json\s+uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm;
  for(const match of source.matchAll(re)) {
    try { blocks.push({match,section:match[1],body:bare(JSON.parse(match[3]),match[1],file),original:match[3]}); }
    catch(error){ report.refusals.push({file,section:match[1],reasons:[error.message]}); }
  }
  const active=blocks.filter(b=>!b.body._meta?.lifecycle?.superseded);
  const debts=active.filter(b=>b.section==='debt_structure');
  for(const block of active.filter(b=>b.section==='sources_uses')) {
    const uses=block.body.uses;
    if(!obj(uses)||!Object.hasOwn(uses,'rate_cap_cost')) continue;
    if(uses.rate_cap_cost!==null) {
      const hedgeDebts=debts.filter(b=>obj(b.body.rate_hedge));
      const alreadyStated=hedgeDebts.filter(b=>Object.hasOwn(b.body.rate_hedge,'premium'));
      if(alreadyStated.length) { for(const b of alreadyStated) mergeFact(b.body.rate_hedge,'premium',uses.rate_cap_cost,file); }
      else if(hedgeDebts.length===1) mergeFact(hedgeDebts[0].body.rate_hedge,'premium',uses.rate_cap_cost,file);
      else report.dropped.push({file,field:'uses.rate_cap_cost',value:uses.rate_cap_cost,reason:'no unique stated hedge'});
    }
    delete uses.rate_cap_cost;
  }
  if(/^asset_class:\s*["']?hospitality/m.test(source)) {
    let roll=active.find(b=>b.section==='rent_roll'); const property=active.find(b=>b.section==='property');
    for(const hotel of active.filter(b=>b.section==='hotel_metrics')) {
      if(!roll && ['adr', 'occupancy', 'available_room_nights', 'occupied_room_nights'].some(k=>Object.hasOwn(hotel.body,k))) {
        const meta=structuredClone(hotel.body._meta); if(meta) meta.section='rent_roll';
        roll={section:'rent_roll',body:{...(meta?{_meta:meta}:{})}, original:'', match:null}; active.push(roll);
      }
      for(const field of ['adr','occupancy','available_room_nights','occupied_room_nights']) if(Object.hasOwn(hotel.body,field)&&roll) {mergeFact(roll.body,field,hotel.body[field],file);delete hotel.body[field];}
      if(Object.hasOwn(hotel.body,'key_count')&&property) {mergeFact(property.body,'keys',hotel.body.key_count,file);delete hotel.body.key_count;}
    }
    if(property&&Object.hasOwn(property.body,'key_count')) {mergeFact(property.body,'keys',property.body.key_count,file);delete property.body.key_count;}
    if(roll&&Object.hasOwn(roll.body,'keys')&&property) {mergeFact(property.body,'keys',roll.body.keys,file);delete roll.body.keys;}
  }
  if(/\.uwx?\.md$/.test(file)) {
    const numeric = value => typeof value === 'number' ? value : 0;
    const sum = value => !obj(value) ? 0 : Object.entries(value).reduce((t,[k,v]) => t+(k==='total'?0:obj(v)?sum(v):numeric(v)),0);
    try {
      const before=parseUWFile(original);
      const old=before.sections.sources_uses;
      const oldBlocks=!old?[]:old.annotation?[[old.annotation.variant??'',old]]:Object.entries(old);
      const premiums=debts.reduce((t,b)=>t+numeric(b.body.rate_hedge?.premium),0);
      for(const [variant,block] of oldBlocks) {
        const payload=block.content.section_id&&block.content.content?block.content.content:block.content;
        const beforeUses=sum(payload.uses);
        const current=active.find(b=>b.section==='sources_uses' && (/\bvariant=(\S+)/.exec(b.match[2])?.[1]??'')===variant);
        if(!current?.body.uses) continue;
        const escrows=Array.isArray(current.body.uses.escrows)?current.body.uses.escrows:[];
        const afterUses=sum(current.body.uses)+premiums+escrows.filter(e=>['interest','operating'].includes(e.name)).reduce((t,e)=>t+numeric(e.upfront),0);
        if(beforeUses!==afterUses) report.uses_differences.push({file,variant,before:beforeUses,after:afterUses});
      }
    } catch { /* Malformed negative documents are compared by their refusal. */ }
  }
  const priorHashes=new Map();
  for(const b of blocks) {
    const integrity=b.body._meta?.integrity;
    if(integrity && (integrity.content_hash || integrity.signature)) {
      const {_meta:_m,...payload}=b.body;
      const hash=createHash('sha256').update(canonicalizeExact(payload)).digest('hex');
      const chain=b.section+'#'+(/\bvariant=(\S+)/.exec(b.match[2])?.[1]??'');
      if(integrity.content_hash) integrity.content_hash=hash;
      if(integrity.parent_hash && priorHashes.has(chain)) integrity.parent_hash=priorHashes.get(chain);
      priorHashes.set(chain,hash);
      if(integrity.signature) {
        const flat=reshapeMetaV2toV1(b.body._meta);
        integrity.signature=await signBlock({meta:{...flat,content_hash:hash}}, {...key,kid:integrity.signature.kid},{signedAt:integrity.signature.signed_at});
      }
    }
  }
  for(const b of blocks.reverse()) {
    const replacement=b.match[0].replace(b.match[3],preserveNumbers(original,JSON.stringify(b.body,null,2))+'\n');
    source=source.slice(0,b.match.index)+replacement+source.slice(b.match.index+b.match[0].length);
  }
  for(const b of active.filter(b=>b.match===null)) source+='\n```json uw:section='+b.section+'\n'+preserveNumbers(original,JSON.stringify(b.body,null,2))+'\n```\n';
  return source;
}
function jsonValue(value,file) {
  if(Array.isArray(value)) return value.filter(v=>!retired.has(v)).map(v=>jsonValue(v,file));
  if(!obj(value)) return value;
  if(value._meta) value=bare(value,value._meta.section??value.section_id,file);
  if(value.manifest_version==='1' && (Object.hasOwn(value,'requires_tier')||Object.hasOwn(value,'requires_conformance'))) {
    if(Object.hasOwn(value,'requires_tier')) {value.requires_conformance=oldTiers[value.requires_tier]??value.requires_tier;delete value.requires_tier;}
    if(value.calculations?.length && !value.requires_profiles) value.requires_profiles=['module'];
    // Impossible ranges remain impossible, preserving rejection controls.
    if(typeof value.requires_protocol==='string' && !/99|nonsense|banana/.test(value.requires_protocol)) value.requires_protocol='^4.0.0';
    if(typeof value.requires_format==='string' && !/99|nonsense|banana/.test(value.requires_format)) value.requires_format='^3.0';
  }
  if(Object.hasOwn(value,'uw_version') && typeof value.uw_version==='string' && /^[12]\./.test(value.uw_version)) value.uw_version='3.0';
  if(value.format_version && /^[12]\./.test(value.format_version)) value.format_version='3.0';
  for(const [k,v] of Object.entries(value)) value[k]=jsonValue(v,file);
  return value;
}
async function processFile(file) {
  const before=readFileSync(file,'utf8'); let after=before;
  if(/\.md$/.test(file)) after=await document(before,file);
  else if(/\.json$/.test(file) && !/package(-lock)?\.json$|keys\//.test(file)) {
    try { const parsed=JSON.parse(before); const value=jsonValue(structuredClone(parsed),file); if(JSON.stringify(value)!==JSON.stringify(parsed)) after=preserveNumbers(before,JSON.stringify(value,null,2))+'\n'; } catch { return; }
  } else if(/\.[cm]?[jt]sx?$/.test(file) && !file.startsWith('scripts/rfc-0081-')) {
    const source=ts.createSourceFile(file,before,ts.ScriptTarget.Latest,true); const edits=[];
    async function visit(node) {
      if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)) && /uw_version\s*:|```json\s+uw:/.test(node.text)) {
        const replacement=await document(node.text,file+':'+source.getLineAndCharacterOfPosition(node.getStart()).line);
        if(replacement!==node.text) {
          const quote=before[node.getStart()];
          const encoded=quote==='`' ? '`'+replacement.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${')+'`' : JSON.stringify(replacement);
          edits.push({start:node.getStart(),end:node.end,text:encoded});
        }
      } else {const children=[];node.forEachChild(child=>{children.push(child);});for(const child of children) await visit(child);}
    }
    await visit(source);
    for(const edit of edits.sort((a,b)=>b.start-a.start)) after=after.slice(0,edit.start)+edit.text+after.slice(edit.end);
  }
  if(after!==before) {report.files[file]=file.split('/')[0]; if(write) writeFileSync(file,after);}
}
async function refreshArtifacts() {
  const dirs = path => readdirSync(path,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
  for(const suite of ['issue','verify']) for(const name of dirs('conformance/receipts/'+suite)) {
    const dir='conformance/receipts/'+suite+'/'+name;const entries=readdirSync(dir);
    const deal=entries.find(f=>/^deal\.uwx?\.md$/.test(f));const receiptFile=entries.find(f=>f==='receipt.json'||f==='expected-receipt.json');if(!deal||!receiptFile)continue;
    const old=JSON.parse(readFileSync(dir+'/'+receiptFile,'utf8'));
    const fresh=await issueReceipt(readFileSync(dir+'/'+deal,'utf8'),{issued_at:old.issued_at,issuer:old.issuer});
    if(suite==='issue') writeFileSync(dir+'/'+receiptFile,JSON.stringify(fresh,null,2)+'\n');
    else {
      old.subject=fresh.subject;old.receipt_version='1.1';
      const expected=JSON.parse(readFileSync(dir+'/expected-verdict.json','utf8'));
      if(expected.codes?.includes('RCP-01')) old.subject.digest=old.subject.digest.slice(0,-1)+(old.subject.digest.endsWith('0')?'1':'0');
      writeFileSync(dir+'/'+receiptFile,JSON.stringify(old,null,2)+'\n');
    }
    report.receipts.push(dir+'/'+receiptFile);
  }
  for(const name of dirs('conformance/reserve-draw-bindings')) {
    const dir='conformance/reserve-draw-bindings/'+name;const entries=readdirSync(dir);if(!entries.includes('plan.json')||name==='stale-digest')continue;
    const plan=JSON.parse(readFileSync(dir+'/plan.json','utf8'));const deal=entries.find(f=>/^deal\.uwx?\.md$/.test(f));
    if(!deal||!plan||typeof plan.source_digest!=='string'||!/^sha256:[0-9a-f]{64}$/.test(plan.source_digest))continue;
    plan.source_digest=await computeEnvelopeDigest(toUWEnvelope(parseUWFile(readFileSync(dir+'/'+deal,'utf8'))));
    writeFileSync(dir+'/plan.json',JSON.stringify(plan,null,2)+'\n');
  }
  const dir='examples/standalone/package';const manifest=JSON.parse(readFileSync(dir+'/manifest.json','utf8'));const payloads={};
  for(const member of manifest.members) {
    const bytes=readFileSync(dir+'/'+member.path);payloads[member.path]=bytes;member.sha256='sha256:'+createHash('sha256').update(bytes).digest('hex');
    if(member.semantic_digest&&member.path.endsWith('.uwx.md')) member.semantic_digest=await computeEnvelopeDigest(toUWEnvelope(parseUWFile(bytes.toString())));
  }
  writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(dir+'/standalone-demo.uwpkg.zip',await encodeUWDealPackageZip({manifest,payloads}));
  execFileSync(process.execPath,['scripts/gen-signing-fixtures.mjs'],{stdio:'inherit'});
  const replay='conformance/tier-4-agent-host/replay/l6-risk-rating';
  const cassette=JSON.parse(readFileSync(replay+'/cassette.json','utf8'));let cursor=0;
  const provider={id:'replay',async complete(request) {const exchange=cassette.exchanges[cursor++];if(!exchange)throw new Error('Replay added a provider call');exchange.request=request;return exchange.completion;}};
  const agent=await runBancroftAgent(readFileSync(replay+'/before.uwx.md','utf8'),'L6-01',{provider,now:()=>Date.parse('2026-08-13T00:00:00.000Z')});
  if(!agent.success)throw new Error(agent.error);if(cursor!==cassette.exchanges.length)throw new Error('Replay dropped a provider call');
  writeFileSync(replay+'/cassette.json',JSON.stringify(cassette,null,2)+'\n');writeFileSync(replay+'/after.uwx.md',agent.updatedContent);
}
if(!process.argv.includes('--artifacts-only')) for(const file of files.filter(f=>!/^docs\/(rfcs|releases)\//.test(f) && !['CHANGELOG.md','VERSIONS.md'].includes(f) && !/^(spec\/metrics\/builtin|conformance\/runner\/cases\/)/.test(f) && /\.(?:md|json|[cm]?[jt]sx?)$/.test(f))) await processFile(file);
if(write) await refreshArtifacts();
if(process.argv.includes('--report')) writeFileSync(process.argv[process.argv.indexOf('--report')+1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({write,files:Object.keys(report.files).length,areas:Object.values(report.files).reduce((a,k)=>(a[k]=(a[k]??0)+1,a),{}),refusals:report.refusals.length,conflicts:report.conflicts.length,dropped:report.dropped,uses_differences:report.uses_differences}));
