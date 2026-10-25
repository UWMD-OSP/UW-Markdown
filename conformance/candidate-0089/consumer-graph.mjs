// Static discovery follows resolved call targets and aliases, not digest spellings.
// Explicit data/storage and opaque-callback edges remain reviewed inventory inputs.
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
function* sources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-validator', 'public', '.git'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path)) yield path;
  }
}
export function discoverCalls(seeds) {
  const files = ['packages', 'tools'].flatMap(group => [...sources(resolve(root, group))]);
  const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, jsx: ts.JsxEmit.Preserve, skipLibCheck: true, noEmit: true });
  const checker = program.getTypeChecker();
  const name = path => relative(root, path).replaceAll('\\', '/').replace(/\/dist\//, '/src/').replace(/\.d\.ts$/, '.ts');
  const identity = (path, symbol) => `${name(path)}#${symbol}`;
  const edges = [];
  const declarations = new Map();
  const resolutionMisses = [];
  const identityReferences = new Map();
  const identityNames = new Set(['semantic_digest', 'source_envelope_digest', 'binding_digest', 'semanticDigestOf', 'semanticDigest']);
  for (const path of files) {
    const source = program.getSourceFile(path);
    function visit(node, owner = `${name(path)}#<module>`) {
      if (ts.isFunctionLike(node) && node.body) {
        const label = node.name?.getText(source) ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(source) : null);
        if (label) { owner = identity(path, label); declarations.set(owner, node.getText(source)); }
      }
      if (ts.isCallExpression(node)) {
        let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        const expression = node.expression.getText(source);
        const declarations = symbol?.getDeclarations() ?? [];
        if (!declarations.length) resolutionMisses.push({ owner, expression });
        for (const declaration of declarations) {
          const file = name(declaration.getSourceFile().fileName);
          if (!/^(packages|tools)\//.test(file) || file.includes('/node_modules/')) continue;
          edges.push({ from: owner, to: `${file}#${symbol.getName()}`, expression, arguments: node.arguments.map(arg => arg.getText(source)),
            kind: ts.isPropertySignature(declaration) || ts.isMethodSignature(declaration) ? 'typed-callback-or-method' : 'call' });
        }
      }
      // Discover downstream reads/writes/SQL independently of reverse-call seeds.
      // This finds storage and propagation even when it never calls a hash API.
      const field = ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text
        : ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isBindingElement(node) ? node.name?.text : null;
      const sqlOrField = ts.isStringLiteralLike(node) && !ts.isLiteralTypeNode(node.parent)
        && /\b(?:semantic_digest|source_envelope_digest|binding_digest)\b/.test(node.text);
      if (identityNames.has(field) || sqlOrField) {
        const references = identityReferences.get(owner) ?? [];
        references.push(node.getText(source)); identityReferences.set(owner, references);
      }
      ts.forEachChild(node, child => visit(child, owner));
    }
    if (source) visit(source);
  }
  const reached = new Set(seeds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) if (reached.has(edge.to) && !reached.has(edge.from)) { reached.add(edge.from); changed = true; }
  }
  return { reached: [...reached].sort(), edges: edges.filter(edge => reached.has(edge.to) && reached.has(edge.from)),
    allEdges: edges, identityReferences, declarations, resolutionMisses, limits: 'Resolved static calls plus an independent field/read/write/SQL discovery pass. Opaque callbacks, generic field aliases, storage clients, exports, JSX and dynamic imports still need explicit reviewed edges; this is not a whole-program proof.' };
}
