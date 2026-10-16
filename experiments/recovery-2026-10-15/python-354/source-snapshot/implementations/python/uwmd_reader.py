"""Independent Format 3.0 reader, written from Format II/Appendix D.

Raw source and JSON numeric spellings remain available independently of the
portable II.6a.6 projection. No defaults, financial inference or Node runtime.
"""
from dataclasses import dataclass
import json
import math
import re


class ProtocolError(ValueError):
    def __init__(self, code, message, category="parse"):
        super().__init__(message)
        self.code, self.category = code, category

    def as_dict(self):
        return {"category": self.category, "code": self.code, "message": str(self)}


class SourceNumber(float):
    def __new__(cls, token):
        value = super().__new__(cls, token)
        if not math.isfinite(value):
            raise ProtocolError("PARSE_JSON_ERROR", "JSON number exceeds binary64 range")
        value.token = token
        return value

    @property
    def decimal_places(self):
        coefficient, _, exponent = self.token.lower().partition('e')
        fractional = len(coefficient.partition('.')[2])
        return max(0, fractional - int(exponent or 0))


def decode_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ProtocolError("PARSE_JSON_ERROR", "Duplicate decoded JSON member: " + key)
            result[key] = value
        return result

    def constant(token):
        raise ProtocolError("PARSE_JSON_ERROR", "Not a JSON number: " + token)

    try:
        return json.loads(text, parse_int=SourceNumber, parse_float=SourceNumber,
                          parse_constant=constant, object_pairs_hook=pairs)
    except (ValueError, OverflowError) as error:
        if isinstance(error, ProtocolError):
            raise
        raise ProtocolError("PARSE_JSON_ERROR", str(error)) from error


def yaml_error(message):
    raise ProtocolError("UNSUPPORTED_YAML_FEATURE", message)


_ESCAPES = dict(zip('0abtnvfre "/\\N_LP',
                    '\0\a\b\t\n\v\f\r\x1b "/\\\x85\xa0\u2028\u2029'))


def scalar(source):
    """Appendix D one-line scalar, with comments outside quotes only."""
    source = source.strip()
    if source.startswith('#'):
        return None
    if source.startswith(('"', "'")):
        quote, output, index = source[0], [], 1
        while index < len(source):
            char = source[index]
            index += 1
            if char == quote:
                if quote == "'" and source[index:index + 1] == "'":
                    output.append("'")
                    index += 1
                    continue
                tail = source[index:]
                if tail and not re.fullmatch(r"\s+#.*|\s*", tail):
                    yaml_error("Trailing content after quoted scalar")
                return ''.join(output)
            if quote == '"' and char == '\\':
                if index == len(source):
                    yaml_error("Incomplete escape")
                escape = source[index]
                index += 1
                if escape in 'xuU':
                    width = {'x': 2, 'u': 4, 'U': 8}[escape]
                    digits = source[index:index + width]
                    if len(digits) != width or not re.fullmatch('[0-9a-fA-F]+', digits):
                        yaml_error("Invalid Unicode escape")
                    point = int(digits, 16)
                    if point > 0x10ffff or 0xd800 <= point <= 0xdfff:
                        yaml_error("Invalid Unicode scalar")
                    output.append(chr(point))
                    index += width
                elif escape in _ESCAPES:
                    output.append(_ESCAPES[escape])
                else:
                    yaml_error("Unknown YAML escape")
            else:
                output.append(char)
        yaml_error("Unclosed quoted scalar")
    source = re.split(r'\s+#', source, maxsplit=1)[0].rstrip()
    if source == '[]':
        return []
    if re.search(r'(^|\s)[&*!]|[{}\[\]]|:\s', source) or source.startswith(('|', '>', '?', '%', '@', '`')):
        yaml_error("Unsupported YAML construct")
    if source.lower() in ('null', '~') or not source:
        return None
    if source.lower() in ('true', 'false'):
        return source.lower() == 'true'
    if re.fullmatch(r'[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?', source):
        return SourceNumber(source)
    return source


def frontmatter(text):
    rows = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if '\t' in line[:len(line) - len(line.lstrip())]:
            yaml_error("Tabs in indentation")
        indent = len(line) - len(line.lstrip(' '))
        if indent not in (0, 2):
            yaml_error("Only one nested mapping level is supported")
        rows.append((indent, line[indent:]))
    result, index = {}, 0
    while index < len(rows):
        indent, row = rows[index]
        if indent:
            yaml_error("Unexpected indentation")
        match = re.fullmatch(r'([^:]+):(?:\s+(.*)|\s*)', row)
        if not match:
            yaml_error("Expected simple mapping entry")
        key, value = match[1].strip(), match[2] or ''
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*', key):
            yaml_error("Unsupported mapping key")
        if key in result:
            yaml_error("Duplicate mapping key: " + key)
        index += 1
        children = []
        while index < len(rows) and rows[index][0] == 2:
            children.append(rows[index][1])
            index += 1
        if children:
            if value and not value.startswith('#'):
                yaml_error("Scalar cannot have nested entries")
            sequence = children[0].startswith('- ')
            nested = [] if sequence else {}
            for child in children:
                if sequence:
                    if not child.startswith('- '):
                        yaml_error("Mixed sequence and mapping")
                    nested.append(scalar(child[2:]))
                else:
                    match = re.fullmatch(r'([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*)|\s*)', child)
                    if not match or match[1] in nested:
                        yaml_error("Invalid or duplicate nested mapping entry")
                    nested[match[1]] = scalar(match[2] or '')
            result[key] = nested
        else:
            result[key] = scalar(value)
    return result


PARALLEL = frozenset(('operating_statement', 'stress_tests', 'due_diligence',
                     'lease_up_schedule', 'cash_flow_series', 'distribution_waterfall', 'reserve_accounts'))
APPEND = frozenset(('pipeline_log', 'custom_calculations', 'custom_scenarios'))


@dataclass
class Block:
    annotation: dict
    body: dict
    raw_json: str
    start: int
    end: int

    @property
    def superseded(self):
        meta = self.body.get('_meta')
        lifecycle = meta.get('lifecycle') if isinstance(meta, dict) else None
        return isinstance(lifecycle, dict) and lifecycle.get('superseded') is True

    def projection(self):
        result = {'meta': self.body.get('_meta', {}),
                  'content': {key: value for key, value in self.body.items()
                              if key not in ('_meta', '_notes')}}
        if '_role' in self.body:
            result['role'] = self.body['_role']
        if '_overrides' in self.body:
            result['overrides'] = self.body['_overrides']
        return result


@dataclass
class Document:
    source: str
    frontmatter: dict
    blocks: list

    def projection(self):
        output = dict(frontmatter=self.frontmatter, sections={}, superseded={},
                      pipeline_log=[], custom_calculations=[], custom_scenarios=[],
                      extensions={}, prose={})
        active = [block for block in self.blocks if not block.superseded]
        role_parallel = ({block.annotation['section'] for block in active if '_role' in block.body}
                         & {block.annotation['section'] for block in active if 'variant' in block.annotation})
        for block in self.blocks:
            section = block.annotation['section']
            projected = block.projection()
            if block.superseded:
                output['superseded'].setdefault(section, []).append(projected)
            elif section in APPEND:
                output[section].append(block.body if section == 'pipeline_log' else projected)
            elif section.startswith('x_'):
                output['extensions'][section] = projected
            elif section in PARALLEL or section in role_parallel:
                output['sections'].setdefault(section, {})[block.annotation.get('variant', 'default')] = projected
            else:
                output['sections'][section] = projected
        return output


def parse(source, filename=None):
    """Read without changing bytes; offsets index the supplied Unicode source."""
    lines = source.splitlines(keepends=True)
    if not lines or lines[0].rstrip('\r\n') != '---':
        raise ProtocolError('UNSUPPORTED_FORMAT_VERSION', 'Declared version absent; supported: 3.0')
    closing = next((i for i in range(1, len(lines)) if lines[i].rstrip('\r\n') == '---'), None)
    if closing is None:
        yaml_error('Unclosed frontmatter')
    fm = frontmatter(''.join(lines[1:closing]))
    if fm.get('uw_version') != '3.0':
        raise ProtocolError('UNSUPPORTED_FORMAT_VERSION',
                            f"Declared version {fm.get('uw_version')!r}; supported: 3.0")
    blocks, index = [], closing + 1
    offsets, offset = [], 0
    for line in lines:
        offsets.append(offset)
        offset += len(line)
    while index < len(lines):
        opening = re.fullmatch(r' {0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n?', lines[index])
        if not opening:
            index += 1
            continue
        fence, info = opening[1], opening[2].strip()
        start = index
        index += 1
        while index < len(lines) and not re.fullmatch(r' {0,3}' + re.escape(fence[0]) + '{' + str(len(fence)) + r',}\s*', lines[index]):
            index += 1
        structured = info.startswith('json ') and 'uw:section=' in info
        if index == len(lines):
            if structured:
                raise ProtocolError('PARSE_JSON_ERROR', 'Unclosed structured fence')
            break
        if structured:
            if filename and str(filename).endswith('.uw.md'):
                raise ProtocolError('SOURCE_CONTENT_MISMATCH', 'Structured records require .uwx.md')
            annotation = {}
            for attribute in info.split()[1:]:
                if '=' not in attribute:
                    raise ProtocolError('PARSE_JSON_ERROR', 'Malformed fence attribute')
                key, value = attribute.split('=', 1)
                key = 'section' if key == 'uw:section' else key
                if key in annotation or not value:
                    raise ProtocolError('PARSE_JSON_ERROR', 'Repeated or empty fence attribute')
                annotation[key] = value
            raw = ''.join(lines[start + 1:index])
            body = decode_json(raw)
            if not isinstance(body, dict):
                raise ProtocolError('PARSE_JSON_ERROR', 'Block must be a JSON object')
            blocks.append(Block(annotation, body, raw, offsets[start], offsets[index] + len(lines[index])))
        index += 1
    return Document(source, fm, blocks)
