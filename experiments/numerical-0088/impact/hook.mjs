// Isolated ESM loader. Only returned source strings change; no dist writes.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, relative, sep } from 'node:path';
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = resolve(process.env.RESEARCH_REPO_ROOT);
const ts = createRequire(resolve(root,'package.json'))('typescript');
const runtime = new URL('./runtime.mjs',import.meta.url).href;
const sha = text => createHash('sha256').update(text).digest('hex');
const isScope = n => ts.isSourceFile(n) || ts.isBlock(n) || ts.isFunctionLike(n) || ts.isCatchClause(n)
  || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n);
function names(node, result=[]) {
  if (ts.isIdentifier(node)) result.push(node.text);
  else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node))
    for(const element of node.elements) if(ts.isBindingElement(element)) names(element.name,result);
  return result;
}
export async function load(url, context, nextLoad) {
  const loaded = await nextLoad(url,context);
  if (!url.startsWith('file:')) return loaded;
  const path = fileURLToPath(url);
  const rel = relative(root,path).split(sep).join('/');
  const runner = rel === 'scripts/run-conformance.mjs';
  const production = /^packages\/[^/]+\/dist\/.*\.js$/.test(rel) && !/\.test\.js$/.test(rel);
  if (!runner && !production) return loaded;
  const source = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8');
  const ast = ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const bindings = new Map();
  function add(scope,node) {
    if(!scope || ts.isSourceFile(scope)) return;
    const set=bindings.get(scope) ?? new Set(); for(const name of names(node)) set.add(name); bindings.set(scope,set);
  }
  function scan(node) {
    if(ts.isVariableDeclaration(node)) {
      let owner=node.parent;
      while(owner && !isScope(owner)) owner=owner.parent;
      add(owner,node.name);
    }
    if(ts.isParameter(node)) add(node.parent,node.name);
    ts.forEachChild(node,scan);
  }
  if(runner) scan(ast);
  const replacements=[]; const snapshots=[]; const excluded=[];
  const f=ts.factory;
  const ident=name=>f.createIdentifier(name);
  const site=node=>`${rel}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).character+1}`;
  const transformed=ts.transform(ast,[ctx=>{
    const visit=node=>{
      if(production && ts.isBinaryExpression(node) && node.operatorToken.kind===ts.SyntaxKind.AsteriskAsteriskToken) {
        const text=node.getText(ast);
        if(/\bBigInt\s*\(|\b[0-9]+n\b/.test(text)) { excluded.push({site:site(node),reason:'BigInt power',text}); return ts.visitEachChild(node,visit,ctx); }
        replacements.push({site:site(node),op:'pow',text});
        return f.createCallExpression(ident('__researchPow'),undefined,[ts.visitNode(node.left,visit),ts.visitNode(node.right,visit),f.createStringLiteral(site(node))]);
      }
      if(production && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.expression.getText(ast)==='Math' && ['log','exp'].includes(node.expression.name.text)) {
        const op=node.expression.name.text;
        if(node.arguments.length!==1) throw new Error(`Unexpected ${op} arity at ${site(node)}`);
        replacements.push({site:site(node),op,text:node.getText(ast)});
        return f.createCallExpression(ident(op==='log'?'__researchLog':'__researchExp'),undefined,[ts.visitNode(node.arguments[0],visit),f.createStringLiteral(site(node))]);
      }
      if(runner && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text==='record') {
        const visible=new Set(); let ancestor=node.parent;
        while(ancestor) { for(const name of bindings.get(ancestor) ?? []) visible.add(name); ancestor=ancestor.parent; }
        const properties=[...visible].sort().filter(name=>!name.startsWith('__research')).map(name=>
          f.createPropertyAssignment(f.createStringLiteral(name),f.createArrowFunction(undefined,undefined,[],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),ident(name))));
        snapshots.push({site:site(node),bindings:[...visible].sort()});
        return f.createCallExpression(ident('__researchCapture'),undefined,[ident('record'),f.createObjectLiteralExpression(properties),f.createStringLiteral(site(node)),...node.arguments.map(a=>ts.visitNode(a,visit))]);
      }
      return ts.visitEachChild(node,visit,ctx);
    };
    return rootNode=>ts.visitNode(rootNode,visit);
  }]);
  let output=ts.createPrinter().printFile(transformed.transformed[0]);
  // A prepended import must not move the executable hashbang to line two.
  output=output.replace(/^#![^\n]*\n/, '');
  transformed.dispose();
  if(replacements.length || snapshots.length) output=`import {pow as __researchPow,log as __researchLog,exp as __researchExp,capture as __researchCapture} from ${JSON.stringify(runtime)};\n${output}`;
  appendFileSync(process.env.RESEARCH_TRANSFORMS,`${JSON.stringify({path:rel,source_sha256:sha(source),transformed_sha256:sha(output),replacements,snapshots,excluded})}\n`);
  return {...loaded,source:output};
}
