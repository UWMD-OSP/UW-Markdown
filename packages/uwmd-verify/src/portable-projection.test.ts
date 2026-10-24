import {describe,it,expect} from 'vitest';
import {parseUWFile} from './parser.js';
import {projectPortableBlock,projectUWParse} from './portable-projection.js';
import {readFileSync} from 'node:fs';
const packet=JSON.parse(readFileSync(new URL('../../../conformance/rfc-0089/cases.json',import.meta.url),'utf8'));
describe('portable extension projection',()=>{
  it('preserves exact tagged identities on all frozen source cases',()=>{
    for(const item of packet.source_cases){
      const project=(block: any)=>{const {_meta,_notes,...content}=block.content;return {...(Object.hasOwn(block.content,'_meta')?{meta:_meta}:{}),content};};
      const expected=Object.fromEntries(Object.entries(item.expected_model.extensions).map(([id,entry]:[string,any])=>[id,entry.mode==='single'?{mode:'single',block:project(entry.block)}:{mode:'variants',blocks:entry.blocks.map((row:any)=>({variant:row.variant,block:project(row.block)}))}]));
      expect(projectUWParse(parseUWFile(item.source)).extensions).toEqual(expected);
    }
  });
  it('retains authored metadata presence and payload identity without notes',()=>{
    for(const content of [{value:1},{_meta:null,_role:'primary',_overrides:[],_notes:'excluded',content:{retained:true}}]){
      const value=projectPortableBlock({content});expect(Object.hasOwn(value,'meta')).toBe(Object.hasOwn(content,'_meta'));expect(value.content).not.toHaveProperty('_notes');
      if(Object.hasOwn(content,'_meta'))expect(value).toEqual({meta:null,content:{_role:'primary',_overrides:[],content:{retained:true}}});
    }
  });
});
