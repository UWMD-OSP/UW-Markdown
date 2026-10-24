import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {carrierSchemas} from './carrier-schema-data.js';
import {admitsCarrierSchema} from './carrier-schema.js';
const read = (path: string) => JSON.parse(readFileSync(new URL('../../../'+path,import.meta.url),'utf8'));
const block=read('spec/schemas/uwmd-block.schema.json'), envelope=read('spec/schemas/uw-document-envelope.schema.json');
const ajv=new Ajv.default({strict:false,allErrors:true});addFormats.default(ajv);ajv.addSchema(block);const shape=ajv.compile(envelope);
const packet=read('conformance/rfc-0089/cases.json');
describe('full carrier schema admission',()=>{
  it('embeds the current normative schemas exactly',()=>expect(carrierSchemas).toEqual([envelope,block]));
  it('agrees with AJV on frozen models and malformed schema boundaries',()=>{
    const normal=packet.source_cases.find((x: any)=>x.name==='named-default-single').expected_model;
    const cases=packet.source_cases.concat(packet.direct_models).map((x: any)=>x.expected_model);
    for(const mutate of [
      (m: any)=>{delete m.frontmatter.deal_name;},
      (m: any)=>{m.extensions.x_probe.block.content._role='invalid';},
      (m: any)=>{delete m.extensions.x_probe.block.content._meta.provenance;},
      (m: any)=>{m.extensions.x_probe.block.content._notes={};},
      (m: any)=>{m.extensions.x_probe.block.content._meta.lifecycle.revision=0;},
      (m: any)=>{m.extensions.x_probe.extra=true;},
      (m: any)=>{m.extensions.x_probe.block.annotation.extra=[];},
    ]) {const changed=structuredClone(normal);mutate(changed);cases.push(changed);}
    for(const field of ['generated_at','generator']) for(const value of [null,0,'','2026-02-29T00:00:00Z','2024-02-29T00:00:00Z','2026-10-23T12:00:00+03:00','2000-01-01 23:59:60Z']) cases.push({...normal,[field]:value});
    for(const value of cases) expect(admitsCarrierSchema(value)).toBe(shape(value));
  });
});
