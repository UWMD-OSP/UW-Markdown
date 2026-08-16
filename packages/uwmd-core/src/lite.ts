import { canonicalizeExact } from './integrity-canonical.js';
import { isBlockedSegment } from './parser.js';
import { UW_LITE_REPRESENTATION_VERSION } from './source-representation.js';

export type UWLiteScalar = string | number | boolean | null;

export interface UWLiteSourceRange {
  line: number;
  column: number;
  end_line: number;
  end_column: number;
}

export interface UWLiteIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  field_path?: string;
}

export interface UWLiteFrontmatterNode {
  kind: 'frontmatter';
  values: Record<string, UWLiteScalar | UWLiteScalar[]>;
  raw: string;
  range: UWLiteSourceRange;
}

export interface UWLiteHeadingNode {
  kind: 'heading';
  depth: number;
  text: string;
  raw: string;
  range: UWLiteSourceRange;
}

export interface UWLiteFieldNode {
  kind: 'field';
  label: string;
  path: string;
  display_value: string;
  value: UWLiteScalar;
  unit?: string;
  period?: string;
  scenario?: string;
  attributes: Record<string, string>;
  raw: string;
  range: UWLiteSourceRange;
}

export interface UWLiteTextNode {
  kind: 'prose' | 'blank' | 'opaque';
  raw: string;
  range: UWLiteSourceRange;
}

export type UWLiteNode =
  | UWLiteFrontmatterNode
  | UWLiteHeadingNode
  | UWLiteFieldNode
  | UWLiteTextNode;

export interface ParsedUWLite {
  representation: 'uw-lite-markdown';
  representation_version: string;
  frontmatter: Record<string, UWLiteScalar | UWLiteScalar[]>;
  nodes: UWLiteNode[];
  fields: UWLiteFieldNode[];
  issues: UWLiteIssue[];
  raw: string;
}

export class UWLiteError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWLiteError';
    this.code = code;
  }
}

const FRONTMATTER_DELIMITER = /^---\s*$/;
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;
const FIELD =
  /^[ \t]*[-*+][ \t]+(.+?):[ \t]*(.*?)[ \t]*<!--[ \t]*uw:([A-Za-z][A-Za-z0-9_.-]*)(.*?)[ \t]*-->[ \t]*$/;
const ATTRIBUTE = /([A-Za-z][A-Za-z0-9_-]*)=("[^"]*"|'[^']*'|[^\s]+)/g;

export function parseUWLite(content: string): ParsedUWLite {
  const lines = content.split(/\r?\n/);
  const nodes: UWLiteNode[] = [];
  const fields: UWLiteFieldNode[] = [];
  const issues: UWLiteIssue[] = [];
  let frontmatter: Record<string, UWLiteScalar | UWLiteScalar[]> = {};
  let index = 0;

  if (FRONTMATTER_DELIMITER.test(lines[0] ?? '')) {
    const end = lines.findIndex((line, lineIndex) => lineIndex > 0 && FRONTMATTER_DELIMITER.test(line));
    if (end === -1) {
      throw new UWLiteError('LITE_UNCLOSED_FRONTMATTER', 'Lite frontmatter has no closing delimiter.');
    }
    const rawLines = lines.slice(0, end + 1);
    const parsedFrontmatter = parseLiteFrontmatter(lines.slice(1, end), issues);
    frontmatter = parsedFrontmatter;
    nodes.push({
      kind: 'frontmatter',
      values: parsedFrontmatter,
      raw: rawLines.join('\n'),
      range: rangeForLines(rawLines, 1),
    });
    index = end + 1;
  } else {
    issues.push({
      code: 'LITE_FRONTMATTER_REQUIRED',
      severity: 'error',
      message: 'UW Lite documents require YAML-subset frontmatter.',
      line: 1,
    });
  }

  for (; index < lines.length; index++) {
    const raw = lines[index] ?? '';
    const line = index + 1;
    const heading = HEADING.exec(raw);
    if (heading) {
      nodes.push({
        kind: 'heading',
        depth: heading[1].length,
        text: heading[2],
        raw,
        range: rangeForLine(raw, line),
      });
      continue;
    }

    const field = FIELD.exec(raw);
    if (field) {
      const attributes = parseAttributes(field[4] ?? '', line, issues);
      const parsedValue = parseLiteDisplayValue(field[2], attributes['unit']);
      if (!parsedValue.ok) {
        issues.push({
          code: 'LITE_VALUE_INVALID',
          severity: 'error',
          message: parsedValue.message,
          line,
          field_path: field[3],
        });
      }
      const parsedUnit = parsedValue.ok ? parsedValue.unit : undefined;
      const node: UWLiteFieldNode = {
        kind: 'field',
        label: field[1].trim(),
        path: field[3],
        display_value: field[2].trim(),
        value: parsedValue.value,
        ...(parsedUnit ? { unit: parsedUnit } : {}),
        ...(attributes['period'] ? { period: attributes['period'] } : {}),
        ...(attributes['scenario'] ? { scenario: attributes['scenario'] } : {}),
        attributes,
        raw,
        range: rangeForLine(raw, line),
      };
      nodes.push(node);
      fields.push(node);
      continue;
    }

    if (raw.trim() === '') {
      nodes.push({ kind: 'blank', raw, range: rangeForLine(raw, line) });
      continue;
    }
    if (raw.includes('<!--') && raw.includes('uw:')) {
      issues.push({
        code: 'LITE_FIELD_SYNTAX',
        severity: 'error',
        message: 'A UW field anchor is present but the field line does not match Lite syntax.',
        line,
      });
      nodes.push({ kind: 'opaque', raw, range: rangeForLine(raw, line) });
      continue;
    }
    nodes.push({ kind: 'prose', raw, range: rangeForLine(raw, line) });
  }

  const version = frontmatter['uw_lite_version'];
  const versionString =
    typeof version === 'number' ? version.toFixed(1) : String(version ?? '');

  if (version === undefined) {
    issues.push({
      code: 'LITE_VERSION_REQUIRED',
      severity: 'error',
      message: 'Frontmatter must declare uw_lite_version.',
      line: 1,
    });
  } else if (versionString !== UW_LITE_REPRESENTATION_VERSION) {
    issues.push({
      code: 'LITE_VERSION_UNSUPPORTED',
      severity: 'error',
      message:
        `Unsupported uw_lite_version ${versionString}; expected ${UW_LITE_REPRESENTATION_VERSION}.`,
      line: 1,
    });
  }

  const seen = new Map<string, number>();
  for (const field of fields) {
    const identity = [field.path, field.period ?? '', field.scenario ?? ''].join('|');
    const priorLine = seen.get(identity);
    if (priorLine !== undefined) {
      issues.push({
        code: 'LITE_FIELD_DUPLICATE',
        severity: 'error',
        message: `Duplicate financial field identity; first declared on line ${priorLine}.`,
        line: field.range.line,
        field_path: field.path,
      });
    } else {
      seen.set(identity, field.range.line);
    }
  }

  return {
    representation: 'uw-lite-markdown',
    representation_version: versionString,
    frontmatter,
    nodes,
    fields,
    issues,
    raw: content,
  };
}

export function canonicalizeUWLiteFinancial(document: ParsedUWLite): string {
  const blocking = document.issues.filter((issue) => issue.severity === 'error');
  if (blocking.length > 0) {
    throw new UWLiteError(
      'LITE_CANONICALIZATION_BLOCKED',
      `Cannot canonicalize a Lite document with ${blocking.length} error(s).`,
    );
  }
  const fields = document.fields
    .map((field) => ({
      path: field.path,
      value: field.value,
      unit: field.unit ?? null,
      period: field.period ?? null,
      scenario: field.scenario ?? null,
      attributes: Object.fromEntries(
        Object.entries(field.attributes)
          .filter(([key]) => !['unit', 'period', 'scenario'].includes(key))
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    }))
    .sort((left, right) =>
      [left.path, left.period ?? '', left.scenario ?? '']
        .join('|')
        .localeCompare([right.path, right.period ?? '', right.scenario ?? ''].join('|')),
    );

  return canonicalizeExact({
    canonicalization: 'uw-lite-financial',
    version: UW_LITE_REPRESENTATION_VERSION,
    fields,
  });
}

export function renderCanonicalUWLite(document: ParsedUWLite): string {
  const output: string[] = [];
  const frontmatterNode = document.nodes.find(
    (node): node is UWLiteFrontmatterNode => node.kind === 'frontmatter',
  );
  if (frontmatterNode) output.push(frontmatterNode.raw.replace(/\r\n/g, '\n'));

  for (const node of document.nodes) {
    if (node.kind === 'frontmatter') continue;
    if (node.kind === 'heading') {
      output.push(`${'#'.repeat(node.depth)} ${node.text.trim()}`);
      continue;
    }
    if (node.kind === 'field') {
      const attributes = Object.entries(node.attributes)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${quoteAttribute(value)}`)
        .join(' ');
      output.push(
        `- ${node.label.trim()}: ${node.display_value.trim()} <!-- uw:${node.path}${attributes ? ` ${attributes}` : ''} -->`,
      );
      continue;
    }
    output.push(node.raw.replace(/[ \t]+$/g, ''));
  }
  return output.join('\n');
}

function parseLiteFrontmatter(
  lines: string[],
  issues: UWLiteIssue[],
): Record<string, UWLiteScalar | UWLiteScalar[]> {
  const values: Record<string, UWLiteScalar | UWLiteScalar[]> = {};
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index] ?? '';
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (/^\s/.test(raw)) {
      issues.push({
        code: 'LITE_FRONTMATTER_NESTING_UNSUPPORTED',
        severity: 'error',
        message: 'Lite v1 frontmatter supports top-level scalar keys only.',
        line: index + 2,
      });
      continue;
    }
    const separator = raw.indexOf(':');
    if (separator < 1) {
      issues.push({
        code: 'LITE_FRONTMATTER_SYNTAX',
        severity: 'error',
        message: 'Frontmatter entries must use key: value syntax.',
        line: index + 2,
      });
      continue;
    }
    const key = raw.slice(0, separator).trim();
    const value = raw.slice(separator + 1).trim();
    if (isBlockedSegment(key)) {
      issues.push({
        code: 'LITE_FRONTMATTER_KEY_RESERVED',
        severity: 'error',
        message: `Frontmatter key ${key} is reserved and cannot be used.`,
        line: index + 2,
      });
      continue;
    }
    if (Object.hasOwn(values, key)) {
      issues.push({
        code: 'LITE_FRONTMATTER_DUPLICATE',
        severity: 'error',
        message: `Duplicate frontmatter key ${key}.`,
        line: index + 2,
      });
      continue;
    }
    values[key] = parseScalar(value);
  }
  return values;
}

function parseAttributes(
  raw: string,
  line: number,
  issues: UWLiteIssue[],
): Record<string, string> {
  const attributes: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let match = ATTRIBUTE.exec(raw);
  while (match) {
    const key = match[1];
    const value = unquote(match[2]);
    if (isBlockedSegment(key)) {
      issues.push({
        code: 'LITE_ATTRIBUTE_KEY_RESERVED',
        severity: 'error',
        message: `Field attribute ${key} is reserved and cannot be used.`,
        line,
      });
      match = ATTRIBUTE.exec(raw);
      continue;
    }
    if (Object.hasOwn(attributes, key)) {
      issues.push({
        code: 'LITE_ATTRIBUTE_DUPLICATE',
        severity: 'error',
        message: `Duplicate field attribute ${key}.`,
        line,
      });
    }
    attributes[key] = value;
    match = ATTRIBUTE.exec(raw);
  }
  const residue = raw.replace(ATTRIBUTE, '').trim();
  if (residue !== '') {
    issues.push({
      code: 'LITE_ATTRIBUTE_SYNTAX',
      severity: 'error',
      message: 'Field attributes must use key=value syntax.',
      line,
    });
  }
  return attributes;
}

type ParsedDisplayValue =
  | { ok: true; value: UWLiteScalar; unit?: string }
  | { ok: false; value: string; message: string };

function parseLiteDisplayValue(display: string, explicitUnit?: string): ParsedDisplayValue {
  const value = display.trim();
  if (value === '') {
    return { ok: false, value, message: 'Financial field value cannot be empty.' };
  }
  if (value === 'null' || value === '~') return { ok: true, value: null, ...(explicitUnit ? { unit: explicitUnit } : {}) };
  if (value === 'true' || value === 'false') {
    return { ok: true, value: value === 'true', ...(explicitUnit ? { unit: explicitUnit } : {}) };
  }

  const currency = /^\$\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)$/.exec(value);
  if (currency) {
    return { ok: true, value: Number(currency[1].replaceAll(',', '')), unit: explicitUnit ?? 'USD' };
  }
  const percent = /^(-?(?:\d+(?:\.\d+)?|\.\d+))%$/.exec(value);
  if (percent) {
    return { ok: true, value: Number(percent[1]) / 100, unit: explicitUnit ?? 'fraction' };
  }
  const ratio = /^(-?(?:\d+(?:\.\d+)?|\.\d+))[xX]$/.exec(value);
  if (ratio) {
    return { ok: true, value: Number(ratio[1]), unit: explicitUnit ?? 'ratio' };
  }
  const number = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.exec(value);
  if (number) {
    return {
      ok: true,
      value: Number(value.replaceAll(',', '')),
      ...(explicitUnit ? { unit: explicitUnit } : {}),
    };
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return { ok: true, value: value.slice(1, -1), ...(explicitUnit ? { unit: explicitUnit } : {}) };
  }
  return { ok: true, value, ...(explicitUnit ? { unit: explicitUnit } : {}) };
}

function parseScalar(raw: string): UWLiteScalar {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function quoteAttribute(value: string): string {
  return /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function rangeForLine(raw: string, line: number): UWLiteSourceRange {
  return { line, column: 1, end_line: line, end_column: raw.length + 1 };
}

function rangeForLines(lines: string[], firstLine: number): UWLiteSourceRange {
  const lastLine = firstLine + lines.length - 1;
  return {
    line: firstLine,
    column: 1,
    end_line: lastLine,
    end_column: (lines.at(-1) ?? '').length + 1,
  };
}
