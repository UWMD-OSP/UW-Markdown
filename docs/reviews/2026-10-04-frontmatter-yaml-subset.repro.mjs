// Reproduces every finding in 2026-10-04-frontmatter-yaml-subset.md.
// Run from the repository root after `npm run build`:
//   node docs/reviews/2026-10-04-frontmatter-yaml-subset.repro.mjs
// Prints one JSON line per probe. Exits 1 if any finding no longer reproduces,
// so a later fix shows up as a changed result, not a silent pass.
import { parse as parseYaml } from 'yaml';
import {
  applyEdit,
  generateBlankUWFile,
  parseUWFile,
  parseUWLite,
  stringifyUWX,
  toUWJson,
} from '../../packages/uwmd-core/dist/index.js';

const base = generateBlankUWFile({ dealId: 'uw_2026_REPRO', dealName: 'Repro' });
const frontmatterText = (doc) => doc.split('\n---\n')[0].slice('---\n'.length);
const withLine = (pattern, line) => base.replace(pattern, line);
const results = [];
const probe = (finding, observed, reproduces) => {
  results.push(reproduces);
  console.log(JSON.stringify({ finding, reproduces, ...observed }));
};

const QUOTED = 'He said "hi"';
const BACKSLASH = 'C:\\deals';

// F3a. Tier-2 editor writes a JSON-escaped double-quoted scalar.
{
  const r = applyEdit(base, parseUWFile(base), { kind: 'frontmatter_set', path: 'deal_name', value: QUOTED }, {
    actor: 'user',
    source: 'manual',
    timestamp: '2026-10-04T00:00:00.000Z',
  });
  const written = r.content.split('\n').find((l) => l.startsWith('deal_name:'));
  const reference = parseUWFile(r.content).frontmatter.deal_name;
  const library = parseYaml(frontmatterText(r.content)).deal_name;
  probe('F3a editor round trip', { written, reference, library }, reference !== QUOTED && library === QUOTED);
}

// F3b. UW JSON -> UWX conversion writes a JSON-escaped double-quoted scalar.
{
  const envelope = toUWJson(parseUWFile(base));
  envelope.frontmatter.deal_name = BACKSLASH;
  const uwx = stringifyUWX(envelope);
  const written = uwx.split('\n').find((l) => l.startsWith('deal_name:'));
  const reference = parseUWFile(uwx).frontmatter.deal_name;
  const library = parseYaml(frontmatterText(uwx)).deal_name;
  probe('F3b convert round trip', { written, reference, library }, reference !== BACKSLASH && library === BACKSLASH);
}

// F3c. Both readers keep quoted content verbatim; a YAML library unescapes.
{
  const line = 'deal_name: "a \\"b\\" c"';
  const doc = withLine(/^deal_name: .*$/m, line);
  const reference = parseUWFile(doc).frontmatter.deal_name;
  const library = parseYaml(frontmatterText(doc)).deal_name;
  const lite = parseUWLite(`---\nuw_lite_version: "1.0"\nname: "a \\"b\\" c"\n---\n`).frontmatter.name;
  const single = parseUWFile(withLine(/^deal_name: .*$/m, "deal_name: 'O''Brien'")).frontmatter.deal_name;
  probe(
    'F3c verbatim quoted scalars',
    { line, reference, lite, library, single_quoted_reference: single },
    reference === 'a \\"b\\" c' && lite === reference && library === 'a "b" c' && single === "O''Brien",
  );
}

// F4a. The pre-pass rejects anchor/alias/tag text inside quoted scalars.
for (const line of ['deal_name: "Smith: &Co"', 'deal_name: "Note: *starred"', 'deal_name: "Status: !Important"', "deal_name: 'Smith: &Co'"]) {
  let threw = null;
  try {
    parseUWFile(withLine(/^deal_name: .*$/m, line), { strict: true });
  } catch (err) {
    threw = String(err.message).split(',')[0];
  }
  probe('F4a false rejection', { line, threw }, threw?.includes('UNSUPPORTED_YAML_FEATURE') === true);
}

// F4b. Flow-style values, which Appendix D.2 says MUST be rejected, are accepted as strings.
for (const line of ['deal_name: {a: 1}', 'deal_name: [1, 2, 3]']) {
  let parsed;
  let threw = null;
  try {
    parsed = parseUWFile(withLine(/^deal_name: .*$/m, line), { strict: true }).frontmatter.deal_name;
  } catch (err) {
    threw = String(err.message);
  }
  probe('F4b missing rejection', { line, parsed, threw }, threw === null && typeof parsed === 'string');
}

// F4c. A trailing comment on an unquoted value becomes part of the value.
{
  const line = 'state: AZ # trailing comment';
  const parsed = parseUWFile(withLine(/^state: .*$/m, line), { strict: true }).frontmatter.state;
  probe('F4c comment kept in value', { line, parsed }, parsed === 'AZ # trailing comment');
}

process.exit(results.every(Boolean) ? 0 : 1);
