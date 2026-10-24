// Self-contained schema data for browser-safe carrier admission; no runtime AJV dependency.
import { readFileSync,writeFileSync } from 'node:fs';
const data=['uw-document-envelope','uwmd-block'].map(name=>JSON.parse(readFileSync(new URL('../spec/schemas/'+name+'.schema.json',import.meta.url),'utf8')));
writeFileSync(new URL('../packages/uwmd-verify/src/carrier-schema-data.ts',import.meta.url),'// Generated from the current Envelope/block schemas; carrier-schema.test.ts checks equality.\nexport const carrierSchemas = '+JSON.stringify(data,null,2)+';\n');
