// Actual asynchronous production bundle/archive entry points.
import {zipSync} from 'fflate';import * as api from '../../../packages/uwmd-verify/dist/uwcsv.js';
export {DOC,BLOCK,VALUE,PROSE,FLAT,readCSV,writeCSV,flatten,unflatten,utf8} from '../../../packages/uwmd-verify/dist/csv-mapping.js';
export const encodeCSV=async model=>(await api.encodeUWCSVBundle(model)).files;
export const decodeCSV=async files=>api.decodeUWCSVBundle({files});
export const encodeZIP=async(model,level=6)=>level===6?api.encodeUWCSVZip(model):zipSync(Object.fromEntries(Object.entries(await encodeCSV(model)).map(([path,text])=>[path,[Buffer.from(text),{level,mtime:new Date('1980-01-02T00:00:00Z')}]])));
export const decodeZIP=api.decodeUWCSVZip;
