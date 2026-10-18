// Research-only AST relocation of the current receipt signature stage.
// Files are never written. No financial, wire, subject, comparison or digest code changes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
const ts=createRequire(new URL('package.json',root))('typescript');
const target=new URL('packages/uwmd-verify/dist/receipts.js',root).href;
const runtime=new URL('./runtime.mjs',import.meta.url).href;
export async function load(url,context,nextLoad){
  const loaded=await nextLoad(url,context);
  if(url!==`${target}?research-authenticate-first`)return loaded;
  const source=typeof loaded.source==='string'?loaded.source:Buffer.from(loaded.source).toString('utf8');
  const ast=ts.createSourceFile(fileURLToPath(url),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const fn=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='verifyReceipt');
  assert(fn?.body,'exact current exported verification function required');
  const statements=[...fn.body.statements];
  const auth=statements.find(s=>ts.isIfStatement(s)&&s.expression.getText(ast)==='receipt.signature && options.signatureVerifier');
  const compute=statements.find(s=>ts.isTryStatement(s)&&s.tryBlock.getText(ast).includes('computeReceiptResults('));
  assert(auth&&compute&&statements.indexOf(auth)>statements.indexOf(compute),'current signature-after-recomputation topology required');
  // An authentication exit occurs before recomputation, so it cannot expose a
  // fabricated, empty or unevaluated `recomputed` member. Other returns are untouched.
  let removed=0;
  const authResult=ts.transform(auth,[ctx=>{
    const visit=node=>{
      if(ts.isObjectLiteralExpression(node)){
        const properties=node.properties.filter(p=>{
          if(ts.isShorthandPropertyAssignment(p)&&p.name.text==='recomputed'){removed++;return false;}
          return true;
        });
        return ts.factory.updateObjectLiteralExpression(node,properties.map(p=>ts.visitNode(p,visit)));
      }
      return ts.visitEachChild(node,visit,ctx);
    };
    return node=>ts.visitNode(node,visit);
  }]);
  assert.equal(removed,2,'exact two current authentication exits required');
  const phase=name=>ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier('__authResearchPhase'),undefined,[ts.factory.createStringLiteral(name)]));
  const replacement=[];
  for(const statement of statements){
    if(statement===auth)continue;
    if(statement===compute){replacement.push(phase('authentication'),authResult.transformed[0],phase('recompute'));}
    replacement.push(statement);
  }
  const transformed=ts.transform(ast,[ctx=>node=>ts.visitEachChild(node,function visit(child){
    if(child===fn)return ts.factory.updateFunctionDeclaration(fn,fn.modifiers,fn.asteriskToken,fn.name,fn.typeParameters,fn.parameters,fn.type,ts.factory.updateBlock(fn.body,replacement));
    return ts.visitEachChild(child,visit,ctx);
  },ctx)]);
  const output=`import {phase as __authResearchPhase} from ${JSON.stringify(runtime)};\n${ts.createPrinter().printFile(transformed.transformed[0])}`;
  if(process.env.AUTH_FIRST_TRANSFORMS)appendFileSync(process.env.AUTH_FIRST_TRANSFORMS,`${JSON.stringify({source_sha256:createHash('sha256').update(source).digest('hex'),proposal_sha256:createHash('sha256').update(output).digest('hex'),signature_stage_moved_before_compute:true,authentication_recomputed_members_removed:removed,production_written:false})}\n`);
  authResult.dispose();transformed.dispose();return {...loaded,source:output};
}
