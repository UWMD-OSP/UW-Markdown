// Fixture source addresses retain precision that JSON.parse discards.
// JSON.parse validates syntax first; this walk records numeric token spelling.
import { getStatedDecimals } from '../../packages/uwmd-core/dist/calc/stated-precision.js';
import { readYamlScalar } from '../../packages/uwmd-core/dist/yaml-scalar.js';

export function jsonNumericTokens(source) {
  JSON.parse(source);
  const tokens = source.match(/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/g) ?? [];
  const numbers = new Map();
  let i = 0;
  function value(path) {
    const token = tokens[i++];
    if (token === '{') {
      if (tokens[i] === '}') { i++; return; }
      do {
        const key = JSON.parse(tokens[i++]); i++; // colon
        value([...path, key]);
      } while (tokens[i++] === ',');
    } else if (token === '[') {
      if (tokens[i] === ']') { i++; return; }
      let n = 0;
      do { value([...path, String(n++)]); } while (tokens[i++] === ',');
    } else if (/^-?\d/.test(token)) {
      numbers.set(JSON.stringify(path), token);
    }
  }
  value([]);
  return numbers;
}

export function jsonStatedDecimals(block, path, stated) {
  if (!block.rawJson) return undefined;
  const parsed = JSON.parse(block.rawJson);
  const numbers = jsonNumericTokens(block.rawJson);
  const segments = path.split('.');
  // Match blockPayload: an own content member is the user payload, with either metadata shape.
  const envelope = Object.hasOwn(parsed, 'content');
  const token = numbers.get(JSON.stringify(envelope ? ['content', ...segments] : segments));
  return token !== undefined && Number(token) === stated ? getStatedDecimals(token) : undefined;
}

export function quickMetricDecimals(source, id, stated) {
  const frontmatter = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(source)?.[1];
  if (!frontmatter) return undefined;
  let inQuick = false;
  let token;
  for (const line of frontmatter.split(/\r?\n/)) {
    if (/^quick_metrics\s*:/.test(line)) { inQuick = true; token = undefined; continue; }
    if (/^\S/.test(line) && !line.startsWith('#')) inQuick = false;
    if (!inQuick) continue;
    const match = /^\s+([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (match?.[1] !== id) continue;
    const scalar = readYamlScalar(match[2]);
    token = scalar.ok && !scalar.quoted ? scalar.text : undefined;
  }
  return token !== undefined && Number(token) === stated ? getStatedDecimals(token) : undefined;
}
