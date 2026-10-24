"""Independent Python complete Envelope codecs/projector; no Node reconstruction imports.

Uses the existing independently authored Reader/JCS and Python standard-library
XML, CSV, DEFLATE and CRC implementations. RFC 0089 production representation API; financial verification remains separately scoped.
"""
import calendar
import copy
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile
import zlib
from uwmd_xml_names import ascii_prefixes

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'implementations/python'))
from uwmd_jcs import canonicalize
from uwmd_reader import parse, APPEND, PARALLEL
from uwmd_jcs import CanonicalizationError
from uwmd_source_lifecycle import source_superseded
from uwmd_text import trim

VERSION, REPRESENTATION = '2.0', '2.0.0'
NS = 'https://uwmd.org/ns/document/2'
ARRAYS = ['pipeline_log', 'custom_calculations', 'custom_scenarios']
RESERVED = ['envelope_version', 'format_version', 'generated_at', 'generator', 'semantic_digest', 'frontmatter', 'sections', *ARRAYS, 'extensions', 'superseded']
DOC = ['envelope_version', 'format_version', 'generated_at_json', 'generator_json', 'semantic_digest', 'deal_id_json', 'deal_name_json', 'extra_json', 'empty_collections_json']
BLOCK = ['block_ref', 'collection', 'section_json', 'variant_json', 'ordinal', 'state', 'extension_mode']
VALUE = ['block_ref', 'scope', 'pointer', 'json_type', 'value_json']
PROSE = ['prose_ref', 'scope', 'block_ref', 'prose_json']
FLAT = ['pointer', 'json_type', 'value_json']
SCOPES = ['annotation', 'meta', 'content', 'block-extra']
REQUIRED = ['document.csv', 'frontmatter.csv', 'blocks.csv', 'block_values.csv', 'prose.csv']


def need(condition, reason):
    if not condition:
        raise ValueError(reason)


def load_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            need(key not in result, 'duplicate decoded JSON name')
            result[key] = value
        return result
    def number(token):
        value = float(token)
        need(math.isfinite(value), 'nonfinite binary64')
        return value
    value = json.loads(text, object_pairs_hook=pairs, parse_int=number, parse_float=number,
                       parse_constant=lambda _: need(False, 'nonfinite JSON token'))
    admit_json(value)
    canonicalize(value)
    return value


def admit_json(value, depth=0):
    need(depth < 128, 'JSON value depth limit')
    need(value is None or isinstance(value, (bool, int, float, str, list, dict)), 'non-JSON value')
    if isinstance(value, dict):
        need(all(isinstance(key, str) for key in value), 'non-JSON member name')
        for child in value.values():
            admit_json(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            admit_json(child, depth + 1)


def dump(value):
    return canonicalize(value)


def sha(value):
    return 'sha256:' + hashlib.sha256(value).hexdigest()


def preimage(value):
    return dump({key: item for key, item in value.items() if key not in ('generated_at', 'generator', 'semantic_digest')})


def digest(value):
    return sha(preimage(value).encode('utf-8'))


def esc(value):
    return value.replace('~', '~0').replace('/', '~1')


def parts(pointer):
    if pointer == '':
        return []
    need(pointer.startswith('/'), 'pointer root')
    result = []
    for segment in pointer[1:].split('/'):
        need(re.search(r'~(?![01])', segment) is None, 'pointer escape')
        key = segment.replace('~1', '/').replace('~0', '~')
        need(esc(key) == segment, 'pointer alias')
        result.append(key)
    return result


def sortkey(value):
    return (0, b'') if value is None else (1, value.encode('utf-16-be'))


def kind(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'boolean'
    if isinstance(value, (int, float)):
        return 'number'
    if isinstance(value, str):
        return 'string'
    return 'array' if isinstance(value, list) else 'object'


def date_time(value):
    if not isinstance(value, str):
        return False
    match = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})[tT\s](\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)([zZ]|([+-])(\d{2}):?(\d{2}))', value)
    if not match:
        return False
    y, mo, d, h, mi = map(int, match.groups()[:5])
    sec = float(match.group(6))
    if not (1 <= mo <= 12 and 1 <= d <= calendar.monthrange(y, mo)[1]):
        return False
    th, tm = (0, 0) if match.group(7).lower() == 'z' else (int(match.group(9)), int(match.group(10)))
    if th > 23 or tm > 59:
        return False
    if h <= 23 and mi <= 59 and sec < 60:
        return True
    sign = -1 if match.group(8) == '-' else 1
    utc_m = mi - tm * sign
    utc_h = h - th * sign - (1 if utc_m < 0 else 0)
    return utc_h in (23, -1) and utc_m in (59, -1) and sec < 61


BLOCK_SCHEMA = json.loads((ROOT / 'spec/schemas/uwmd-block.schema.json').read_text(encoding='utf-8'))


def schema_ok(value, schema, root=BLOCK_SCHEMA):
    """Independent evaluator for the operators used by the block schema."""
    if isinstance(schema, bool):
        return schema
    if '$ref' in schema:
        target = root
        for part in schema['$ref'].removeprefix('#/').split('/'):
            target = target[part]
        if not schema_ok(value, target, root):
            return False
    if 'type' in schema:
        types = schema['type'] if isinstance(schema['type'], list) else [schema['type']]
        if not any(kind(value) == item or item == 'integer' and kind(value) == 'number' and float(value).is_integer() for item in types):
            return False
    if 'const' in schema and dump(value) != dump(schema['const']):
        return False
    if 'enum' in schema and not any(dump(value) == dump(item) for item in schema['enum']):
        return False
    if any(not schema_ok(value, item, root) for item in schema.get('allOf', [])):
        return False
    if 'anyOf' in schema and not any(schema_ok(value, item, root) for item in schema['anyOf']):
        return False
    if 'oneOf' in schema and sum(schema_ok(value, item, root) for item in schema['oneOf']) != 1:
        return False
    if 'not' in schema and schema_ok(value, schema['not'], root):
        return False
    if 'if' in schema and not schema_ok(value, schema.get('then', {}) if schema_ok(value, schema['if'], root) else schema.get('else', {}), root):
        return False
    if isinstance(value, dict):
        if any(key not in value for key in schema.get('required', [])) or len(value) < schema.get('minProperties', 0):
            return False
        properties = schema.get('properties', {})
        for key, item in value.items():
            if not schema_ok(item, properties.get(key, schema.get('additionalProperties', True)), root):
                return False
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0) or any(not schema_ok(item, schema.get('items', {}), root) for item in value):
            return False
        if 'contains' in schema and not any(schema_ok(item, schema['contains'], root) for item in value):
            return False
    if isinstance(value, str):
        if len(value) < schema.get('minLength', 0) or 'pattern' in schema and re.search(schema['pattern'], value, re.ASCII) is None:
            return False
        if schema.get('format') == 'date-time' and not date_time(value):
            return False
    if kind(value) == 'number' and value < schema.get('minimum', -math.inf):
        return False
    return True


def blocks(model):
    result = []
    def add(ref, collection, section, variant, ordinal, state, mode, block):
        need(isinstance(block, dict) and isinstance(block.get('annotation'), dict) and isinstance(block.get('content'), dict), 'block shape')
        a, body = block['annotation'], block['content']
        need(isinstance(section, str) and bool(section) and a.get('section') == section and isinstance(body.get('_meta'), dict) and body['_meta'].get('section') == section, 'section identity')
        need('variant' not in a or isinstance(a['variant'], str), 'variant annotation')
        need(all(kind(v) in ('string', 'number', 'boolean') for v in a.values()), 'annotation scalar')
        need(schema_ok(body, BLOCK_SCHEMA), 'block schema')
        need('prose' not in block or isinstance(block['prose'], str), 'prose type')
        result.append((ref, collection, section, variant, ordinal, state, mode, block))
    for section in sorted(model['sections'], key=lambda x: x.encode('utf-16-be')):
        entry = model['sections'][section]
        if isinstance(entry.get('annotation'), dict) and isinstance(entry.get('content'), dict):
            add('/sections/' + esc(section), 'sections', section, entry['annotation'].get('variant'), '', 'current', '', entry)
        else:
            need(entry, 'empty builtin variant map')
            for variant in sorted(entry, key=lambda x: x.encode('utf-16-be')):
                add('/sections/' + esc(section) + '/' + esc(variant), 'sections', section, variant, '', 'current', '', entry[variant])
    for key in ARRAYS:
        for index, block in enumerate(model[key]):
            add(f'/{key}/{index}', key, block['annotation']['section'], None, str(index), 'current', '', block)
    for section in sorted(model['extensions'], key=lambda x: x.encode('utf-16-be')):
        entry = model['extensions'][section]
        need(section.startswith('x_'), 'extension id')
        if entry.get('mode') == 'single':
            need(set(entry) == {'mode', 'block'}, 'closed single wrapper')
            peers = [(entry['block']['annotation'].get('variant'), entry['block'])]
            add(f'/extensions/{esc(section)}/block', 'extensions', section, peers[0][0], '', 'current', 'single', peers[0][1])
        else:
            need(set(entry) == {'mode', 'blocks'} and entry['mode'] == 'variants' and isinstance(entry['blocks'], list) and entry['blocks'], 'closed variants wrapper')
            peers = []
            for index, record in enumerate(entry['blocks']):
                need(set(record) == {'variant', 'block'}, 'closed variant record')
                variant = record['variant']
                need(variant is None or isinstance(variant, str), 'nullable variant')
                need(variant == record['block']['annotation'].get('variant'), 'exact variant identity')
                peers.append((variant, record['block']))
                add(f'/extensions/{esc(section)}/blocks/{index}/block', 'extensions', section, variant, str(index), 'current', 'variants', record['block'])
            ids = [key for key, _ in peers]
            need(ids == sorted(ids, key=sortkey) and len(set(ids)) == len(ids), 'extension order/duplicates')
        for _, block in peers:
            need(not block['annotation'].get('superseded') and not block['content']['_meta']['lifecycle'].get('superseded'), 'historical active extension')
    for section in sorted(model['superseded'], key=lambda x: x.encode('utf-16-be')):
        for index, block in enumerate(model['superseded'][section]):
            add(f'/superseded/{esc(section)}/{index}', 'superseded', section, None, str(index), 'superseded', '', block)
    return result


def is_envelope_block(value):
    annotation = value.get('annotation') if isinstance(value, dict) else None
    return (isinstance(annotation, dict) and isinstance(annotation.get('section'), str)
            and all(isinstance(item, (str, int, float, bool)) for item in annotation.values())
            and isinstance(value.get('content'), dict))


def validate(model, stamped=True):
    admit_json(model)
    need(isinstance(model, dict) and set(RESERVED) - {'generated_at', 'generator', 'semantic_digest'} <= model.keys(), 'model fields')
    need(model['envelope_version'] == VERSION and model['format_version'] == '3.0', 'model regime')
    need(isinstance(model['frontmatter'], dict) and model['frontmatter'].get('uw_version') == '3.0' and all(isinstance(model['frontmatter'].get(k), str) for k in ('deal_id', 'deal_name')), 'frontmatter shape')
    need('asset_class' not in model['frontmatter'] or isinstance(model['frontmatter']['asset_class'], str), 'frontmatter asset class')
    need(all(isinstance(model[key], dict) for key in ('sections', 'extensions', 'superseded')) and all(isinstance(model[key], list) for key in ARRAYS), 'collections')
    need(all(isinstance(value, list) for value in model['superseded'].values()), 'history array')
    need('generated_at' not in model or date_time(model['generated_at']), 'generated date-time')
    need('generator' not in model or isinstance(model['generator'], str) and bool(model['generator']), 'generator type')
    need('semantic_digest' not in model or isinstance(model['semantic_digest'], str) and re.fullmatch(r'sha256:[0-9a-f]{64}', model['semantic_digest']), 'digest shape')
    dump(model)
    blocks(model)
    if stamped:
        need(model.get('semantic_digest') == digest(model), 'semantic digest')
    return model


def stamp(model):
    result = copy.deepcopy(model)
    validate(result, False)
    result['semantic_digest'] = digest(result)
    return result


def lexical(value):
    units = value.encode('utf-16-be')
    out = '"'
    for i in range(0, len(units), 2):
        code = int.from_bytes(units[i:i+2], 'big')
        out += '\\"' if code == 34 else '\\\\' if code == 92 else f'\\u{code:04x}' if code < 32 or code >= 127 else chr(code)
    return out + '"'


def encode_xml(model):
    model = stamp(model)
    ET.register_namespace('uw', NS)
    def write(value):
        t = kind(value)
        node = ET.Element('{' + NS + '}value', {'type': t})
        if t == 'object':
            for key in sorted(value, key=lambda x: x.encode('utf-16-be')):
                member = ET.SubElement(node, '{' + NS + '}member', {'name-json': lexical(key)})
                member.append(write(value[key]))
        elif t == 'array':
            for child in value:
                node.append(write(child))
        elif t != 'null':
            node.text = lexical(value) if t == 'string' else dump(value)
        return node
    root = ET.Element('{' + NS + '}document', {'envelope-version': VERSION, 'format-version': model['format_version']})
    root.append(write(model))
    return ET.tostring(root, encoding='unicode')


def decode_xml(text):
    need(len(text.encode('utf-8')) <= 50 * 1024 * 1024, 'XML size limit')
    need('<!' not in text, 'XML declaration/entity/comment')
    bom = '\ufeff' if text.startswith('\ufeff') else ''
    text = text.removeprefix('\ufeff')
    declaration = r'''^<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(?:"1\.0"|'1\.0')(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(?:"[uU][tT][fF]-8"|'[uU][tT][fF]-8'))?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(?:"(?:yes|no)"|'(?:yes|no)'))?[ \t\r\n]*\?>'''
    rest = text
    if text.startswith('<?xml'):
        match = re.match(declaration, text)
        need(match is not None, 'XML malformed declaration')
        rest = text[match.end():]
    need('<?' not in rest, 'XML processing instruction')
    # Preserve declaration position as well as its validated spelling. Removing
    # it would make a following BOM appear to ET as a fresh document-start BOM.
    prefix = text[:len(text) - len(rest)]
    root = ET.fromstring(bom + prefix + ascii_prefixes(rest))
    need(root.tag == '{' + NS + '}document' and set(root.attrib) == {'envelope-version', 'format-version'}, 'XML root/attributes')
    def space(value):
        return value is None or re.fullmatch(r'[ \t\r\n]*', value) is not None
    def string(token):
        value = load_json(token)
        need(isinstance(value, str) and lexical(value) == token, 'XML canonical lexical string')
        return value
    def read(node, depth=0):
        need(depth < 128 and node.tag == '{' + NS + '}value' and set(node.attrib) == {'type'}, 'XML value/attributes')
        t = node.attrib['type']
        if t in ('array', 'object'):
            need(space(node.text) and all(space(child.tail) for child in node), 'XML mixed content')
            if t == 'array':
                return [read(child, depth + 1) for child in node]
            result = {}
            for member in node:
                need(member.tag == '{' + NS + '}member' and set(member.attrib) == {'name-json'} and len(member) == 1 and space(member.text) and space(member[0].tail), 'XML member')
                key = string(member.attrib['name-json'])
                need(key not in result, 'duplicate XML name')
                result[key] = read(member[0], depth + 1)
            return result
        need(len(node) == 0, 'XML scalar children')
        token = node.text or ''
        if t == 'string':
            return string(token)
        if t == 'null':
            need(token == '', 'XML null content')
            return None
        value = load_json(token)
        need(t in ('number', 'boolean') and kind(value) == t and dump(value) == token, 'XML scalar lexical type')
        return value
    need(len(root) == 1 and space(root.text) and space(root[0].tail), 'XML root cardinality')
    model = read(root[0])
    need(root.attrib['envelope-version'] == model['envelope_version'] and root.attrib['format-version'] == model['format_version'], 'XML stamp agreement')
    return validate(model)


def flatten(value, pointer=''):
    t = kind(value)
    result = [[pointer, t, dump({} if t == 'object' else [] if t == 'array' else value)]]
    if t == 'array':
        for index, child in enumerate(value):
            result += flatten(child, pointer + '/' + str(index))
    elif t == 'object':
        for key in sorted(value, key=lambda x: x.encode('utf-16-be')):
            result += flatten(value[key], pointer + '/' + esc(key))
    return result


def unflatten(rows):
    nodes = {}
    for pointer, t, token in rows:
        path = tuple(parts(pointer))
        need(path not in nodes, 'duplicate CSV path')
        value = load_json(token)
        need(kind(value) == t and (t not in ('object', 'array') or len(value) == 0), 'CSV node type/hidden values')
        nodes[path] = (t, value)
    used = set()
    def build(path):
        need(path in nodes, 'CSV missing root/parent')
        used.add(path)
        t, value = nodes[path]
        children = [key for key in nodes if len(key) == len(path) + 1 and key[:-1] == path]
        if t not in ('array', 'object'):
            need(not children, 'CSV scalar children')
            return value
        if t == 'array':
            children.sort(key=lambda key: int(key[-1]) if re.fullmatch(r'0|[1-9][0-9]*', key[-1]) else -1)
            need([key[-1] for key in children] == list(map(str, range(len(children)))), 'CSV array gap/alias')
            return [build(key) for key in children]
        return {key[-1]: build(key) for key in children}
    value = build(())
    need(len(used) == len(nodes), 'CSV orphan rows')
    return value


def table(text, header):
    field = r'(?:"(?:[^"]|"")*"|[^",\r\n]*)'
    record = field + r'(?:,' + field + r')*'
    need(re.fullmatch(record + r'(?:(?:\r\n|\n)' + record + r')*(?:\r\n|\n)?', text), 'CSV quote/record grammar')
    result = list(csv.reader(io.StringIO(text, newline=''), strict=True))
    need(result and result[0] == header and all(len(row) == len(header) for row in result), 'CSV header/width')
    return result[1:]


def rows(values):
    stream = io.StringIO(newline='')
    csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator='\r\n').writerows(values)
    return stream.getvalue()


def encode_csv(model):
    model = stamp(model)
    extra = {key: value for key, value in model.items() if key not in RESERVED}
    empty = sorted(({'path': '/superseded/' + esc(key), 'kind': 'array'} for key, value in model['superseded'].items() if not value), key=lambda v: v['path'].encode('utf-16-be'))
    files = {'document.csv': rows([DOC, [VERSION, model['format_version'], dump(model.get('generated_at')), dump(model.get('generator')), model['semantic_digest'], dump(model['frontmatter']['deal_id']), dump(model['frontmatter']['deal_name']), dump(extra), dump(empty)]]),
             'frontmatter.csv': rows([FLAT, *flatten(model['frontmatter'])])}
    b_rows, v_rows, p_rows = [BLOCK], [VALUE], [PROSE]
    for ref, collection, section, variant, ordinal, state, mode, block in blocks(model):
        b_rows.append([ref, collection, dump(section), dump(variant), ordinal, state, mode])
        scopes = {'annotation': block['annotation'], 'meta': block['content']['_meta'], 'content': {k: v for k, v in block['content'].items() if k != '_meta'}, 'block-extra': {k: v for k, v in block.items() if k not in ('annotation', 'content', 'prose')}}
        for scope in SCOPES:
            v_rows += [[ref, scope, *row] for row in flatten(scopes[scope])]
        if 'prose' in block:
            p_rows.append([ref + '/prose', 'block', ref, dump(block['prose'])])
    files.update({'blocks.csv': rows(b_rows), 'block_values.csv': rows(v_rows), 'prose.csv': rows(p_rows)})
    manifest = dict(bundle_version=REPRESENTATION, envelope_version=VERSION, format_version=model['format_version'], canonicalization_version=VERSION, semantic_digest=model['semantic_digest'], normalized_value_encoding='canonical-json', csv_dialect='rfc4180', views=[], files=[])
    for path in sorted(files):
        value = files[path].encode('utf-8')
        manifest['files'].append(dict(path=path, media_type='text/csv; charset=utf-8', sha256=sha(value), bytes=len(value), fidelity='model'))
    files['manifest.json'] = dump(manifest)
    return files


def safe_path(path):
    return isinstance(path, str) and bool(path) and '\\' not in path and '\0' not in path and not path.startswith('/') and re.match(r'^[A-Za-z]:', path) is None and all(part not in ('', '.', '..') for part in path.split('/'))


def decode_csv(files):
    raw = {key: value.encode('utf-8') if isinstance(value, str) else value for key, value in files.items()}
    need(len(raw) <= 100 and all(safe_path(key) for key in raw), 'CSV file/path limit')
    manifest = load_json(raw['manifest.json'].decode('utf-8-sig'))
    need(manifest['bundle_version'] == REPRESENTATION and manifest['envelope_version'] == VERSION and manifest['canonicalization_version'] == VERSION, 'CSV regime')
    need(manifest['normalized_value_encoding'] == 'canonical-json' and manifest['csv_dialect'] == 'rfc4180', 'CSV encoding')
    listed = set()
    for entry in manifest['files']:
        path = entry['path']
        need(path not in listed and path in raw and len(raw[path]) == entry['bytes'] and sha(raw[path]) == entry['sha256'], 'CSV raw inventory')
        listed.add(path)
        need(entry['fidelity'] == ('model' if path in REQUIRED else 'view'), 'CSV model/view substitution')
        need(path in REQUIRED or any(view['path'] == path for view in manifest['views']), 'CSV unbound model file')
    need(set(REQUIRED) <= listed and set(raw) == listed | {'manifest.json'}, 'CSV file membership')
    text = {key: value.decode('utf-8-sig') for key, value in raw.items()}
    documents = table(text['document.csv'], DOC)
    need(len(documents) == 1, 'CSV document cardinality')
    doc = documents[0]
    extra = load_json(doc[7])
    need(isinstance(extra, dict) and not set(extra) & set(RESERVED), 'CSV outer overlap')
    model = dict(extra, envelope_version=doc[0], format_version=doc[1], semantic_digest=doc[4], frontmatter=unflatten(table(text['frontmatter.csv'], FLAT)), sections={}, pipeline_log=[], custom_calculations=[], custom_scenarios=[], extensions={}, superseded={})
    for key, token in [('generated_at', doc[2]), ('generator', doc[3])]:
        value = load_json(token)
        if value is not None:
            model[key] = value
    need(load_json(doc[5]) == model['frontmatter']['deal_id'] and load_json(doc[6]) == model['frontmatter']['deal_name'], 'CSV frontmatter echo')
    empty = load_json(doc[8])
    need(isinstance(empty, list), 'CSV empty descriptors')
    previous = b''
    for item in empty:
        need(set(item) == {'path', 'kind'} and item['path'].encode('utf-16-be') > previous, 'CSV empty descriptor order')
        previous = item['path'].encode('utf-16-be')
        path = parts(item['path'])
        need(len(path) == 2 and path[0] in ('sections', 'superseded') and item['kind'] == ('array' if path[0] == 'superseded' else 'object'), 'CSV empty location/kind')
        model[path[0]][path[1]] = [] if item['kind'] == 'array' else {}
    values, prose = {}, {}
    for ref, scope, *row in table(text['block_values.csv'], VALUE):
        need(scope in SCOPES, 'CSV unknown scope')
        values.setdefault((ref, scope), []).append(row)
    for ref, scope, block, token in table(text['prose.csv'], PROSE):
        need(scope == 'block' and ref == block + '/prose' and block not in prose, 'CSV prose descriptor')
        value = load_json(token)
        need(isinstance(value, str), 'CSV prose type')
        prose[block] = value
    received, seen = [], set()
    rank = {key: index for index, key in enumerate(['sections', *ARRAYS, 'extensions', 'superseded'])}
    def row_order(row):
        section = load_json(row[2])
        need(isinstance(section, str) and (row[4] == '' or re.fullmatch(r'0|[1-9][0-9]*', row[4])), 'CSV descriptor/ordinal')
        return (rank.get(row[1], 99), b'' if row[1] in ARRAYS else section.encode('utf-16-be'), -1 if row[4] == '' else int(row[4]), row[0].encode('utf-16-be'))
    for row in sorted(table(text['blocks.csv'], BLOCK), key=row_order):
        ref, collection, section_token, variant_token, ordinal, state, mode = row
        need(ref not in seen, 'CSV duplicate block')
        seen.add(ref)
        section, variant = load_json(section_token), load_json(variant_token)
        scopes = {scope: unflatten(values.pop((ref, scope))) for scope in SCOPES}
        need(all(isinstance(v, dict) for v in scopes.values()) and '_meta' not in scopes['content'] and not set(scopes['block-extra']) & {'annotation', 'content', 'prose'}, 'CSV scope root/overlap')
        block = dict(scopes['block-extra'], annotation=scopes['annotation'], content=dict(_meta=scopes['meta'], **scopes['content']))
        if ref in prose:
            block['prose'] = prose.pop(ref)
        path = parts(ref)
        need(not any(path[:len(parts(item['path']))] == parts(item['path']) for item in empty), 'CSV empty/nonempty overlap')
        need(state == ('superseded' if collection == 'superseded' else 'current') and (collection == 'extensions' or mode == ''), 'CSV state/mode')
        if collection == 'sections':
            need(ordinal == '' and len(path) in (2, 3) and path[:2] == [collection, section], 'CSV section descriptor')
            if len(path) == 2:
                need(section not in model['sections'], 'CSV section overlap')
                model['sections'][section] = block
            else:
                need(path[2] == variant, 'CSV section variant')
                parent = model['sections'].setdefault(section, {})
                need('annotation' not in parent and variant not in parent, 'CSV section collision')
                parent[variant] = block
        elif collection in ARRAYS or collection == 'superseded':
            need(variant is None, 'CSV append/history variant')
            parent = model[collection] if collection in ARRAYS else model[collection].setdefault(section, [])
            need(path == [collection, ordinal] if collection in ARRAYS else path == [collection, section, ordinal], 'CSV append/history ref')
            need(ordinal == str(len(parent)) and (collection != 'superseded' or not any(item['path'] == '/superseded/' + esc(section) for item in empty)), 'CSV ordinal/empty overlap')
            parent.append(block)
        else:
            need(collection == 'extensions' and path[:2] == [collection, section], 'CSV extension ref')
            if mode == 'single':
                need(path == [collection, section, 'block'] and ordinal == '' and section not in model[collection] and variant == block['annotation'].get('variant'), 'CSV single descriptor')
                model[collection][section] = dict(mode=mode, block=block)
            else:
                need(mode == 'variants' and path == [collection, section, 'blocks', ordinal, 'block'], 'CSV variants descriptor')
                parent = model[collection].setdefault(section, dict(mode=mode, blocks=[]))
                need(parent['mode'] == mode and ordinal == str(len(parent['blocks'])), 'CSV variants ordinal')
                parent['blocks'].append(dict(variant=variant, block=block))
        received.append([ref, collection, dump(section), dump(variant), ordinal, state, mode])
    need(not values and not prose, 'CSV unused rows')
    validate(model)
    expected = [[ref, collection, dump(section), dump(variant), ordinal, state, mode] for ref, collection, section, variant, ordinal, state, mode, _ in blocks(model)]
    need(sorted(received, key=lambda row: row[0]) == sorted(expected, key=lambda row: row[0]), 'CSV descriptor canonical agreement')
    need(manifest['semantic_digest'] == model['semantic_digest'] and manifest['format_version'] == model['format_version'], 'CSV manifest/model agreement')
    return model


def encode_zip(model, method=zipfile.ZIP_DEFLATED):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=method) as archive:
        for name, value in sorted(encode_csv(model).items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 2, 0, 0, 0))
            info.compress_type = method
            archive.writestr(info, value.encode('utf-8'), compresslevel=6 if method == zipfile.ZIP_DEFLATED else None)
    return output.getvalue()


def decode_zip(data, options=None):
    options = options or {}
    max_bytes = options.get('maxUncompressedBytes', 200 * 1024 * 1024)
    need(len(data) <= options.get('maxCompressedBytes', 50 * 1024 * 1024), 'ZIP compressed limit')
    end = data.rfind(b'PK\x05\x06', max(0, len(data) - 65557))
    need(end >= 0 and end + 22 <= len(data), 'ZIP end record')
    disk, central_disk, disk_count, count, central_size, central_start, comment = struct.unpack_from('<HHHHIIH', data, end + 4)
    need(end + 22 + comment == len(data) and disk == central_disk == 0 and disk_count == count and central_start + central_size <= end, 'ZIP end structure/multidisk')
    files, total, ranges = {}, 0, []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        need(len(archive.infolist()) == count and count <= options.get('maxFiles', 100), 'ZIP file count/limit')
        for item in archive.infolist():
            at = item.header_offset
            need(data[at:at+4] == b'PK\x03\x04', 'ZIP local header')
            flags, method = struct.unpack_from('<HH', data, at + 6)
            crc, compressed, expanded = struct.unpack_from('<III', data, at + 14)
            name_len, extra_len = struct.unpack_from('<HH', data, at + 26)
            raw_name = data[at+30:at+30+name_len]
            name = raw_name.decode('utf-8')
            need(method in (0, 8) and method == item.compress_type and flags == item.flag_bits, 'ZIP local/central method/flags')
            # zipfile independently compares each local name with its central spelling.
            expected_name = item.orig_filename.encode('utf-8' if item.flag_bits & 0x800 else 'cp437')
            need(raw_name == expected_name, 'ZIP local/central name')
            need(safe_path(name) and name not in files and not flags & 1 and (item.external_attr >> 16) & 0xf000 != 0xa000, 'ZIP path/duplicate/encryption/symlink')
            expected = (item.CRC, item.compress_size, item.file_size)
            need(all(a == b or flags & 8 and a == 0 for a, b in zip((crc, compressed, expanded), expected)), 'ZIP local/central CRC/size')
            need(max(expected) < 0xffffffff and item.volume == 0 and item.file_size <= item.compress_size * options.get('maxCompressionRatio', 100) + 1048576, 'ZIP64/multidisk/ratio limit')
            start = at + 30 + name_len + extra_len
            need(start + item.compress_size <= central_start, 'ZIP local payload/central overlap')
            payload = data[start:start+item.compress_size]
            need(len(payload) == item.compress_size, 'ZIP payload bounds')
            if flags & 8:
                offset = start + item.compress_size
                if data[offset:offset+4] == b'PK\x07\x08':
                    offset += 4
                need(struct.unpack_from('<III', data, offset) == expected, 'ZIP data descriptor')
                range_end = offset + 12
            else:
                range_end = start + item.compress_size
            need(range_end <= central_start, 'ZIP descriptor bounds')
            ranges.append((at, range_end))
            output, count, actual_crc = [], 0, 0
            inflater = zlib.decompressobj(-15) if method == 8 else None
            for offset in range(0, len(payload), 1024):
                chunk = inflater.decompress(payload[offset:offset+1024], max_bytes - total + 1) if inflater else payload[offset:offset+1024]
                count += len(chunk)
                total += len(chunk)
                need(total <= max_bytes and count <= item.file_size, 'ZIP actual output limit/size')
                actual_crc = zlib.crc32(chunk, actual_crc)
                output.append(chunk)
            need(inflater is None or inflater.eof, 'ZIP incomplete DEFLATE')
            need(count == item.file_size and actual_crc == item.CRC, 'ZIP actual CRC/size')
            files[name] = b''.join(output)
    ranges.sort()
    need(all(ranges[i][0] >= ranges[i - 1][1] for i in range(1, len(ranges))), 'ZIP overlapping local members')
    return decode_csv(files)


class EnvelopeError(ValueError):
    pass


def project_source(raw, *, generated_at="2000-01-01T00:00:00Z", generator="@uwmd/python"):
    model = semantic_envelope(parse(raw, require_structured=True))
    return dict(model, generated_at=generated_at, generator=generator)


def semantic_envelope(document):
    """Complete source commitment; deliberately separate from carrier admission."""
    raw = document.source.raw
    source = document.source
    closing = re.match(rb'---(?:\r\n|\r|\n|$)', raw[source.frontmatter_span.end:])
    need(closing is not None, 'frontmatter boundary')
    cursor = source.frontmatter_span.end + closing.end()
    physical = []
    for block in source.blocks:
        annotation = {}
        for key, value in block.attributes:
            key = 'section' if key == 'uw:section' else key
            if key == 'v':
                if re.fullmatch(r'[0-9]+', value) is None:
                    raise EnvelopeError('invalid annotation revision')
                value = float(value)
            elif key == 'superseded':
                if value not in ('true', 'false'):
                    raise EnvelopeError('invalid annotation lifecycle')
                value = value == 'true'
            if key in annotation:
                raise EnvelopeError('annotation mapping collision')
            annotation[key] = value
        projected = dict(annotation=annotation, content=block.parsed.value)
        prose = trim(raw[cursor:block.fence_span.start].decode('utf-8').replace('\r\n', '\n').replace('\r', '\n'))
        if prose:
            projected['prose'] = prose
        cursor = block.fence_span.end
        physical.append((block.section, source_superseded(block), projected))
    model = dict(envelope_version=VERSION, format_version='3.0', frontmatter=document.frontmatter.value, sections={}, pipeline_log=[], custom_calculations=[], custom_scenarios=[], extensions={}, superseded={})
    active = [(id, block) for id, history, block in physical if not history]
    role_sections = {id for id, block in active if '_role' in block['content']}
    variant_sections = {id for id, block in active if 'variant' in block['annotation']}
    parallel = set(PARALLEL) | (role_sections & variant_sections)
    selected, histories = {}, {}
    for section, history, block in physical:
        if section in APPEND:
            model[section].append(block)
            continue
        if history:
            histories.setdefault(section, []).append(block)
            continue
        key = block['annotation'].get('variant') if section in parallel else None
        # Builtins retain their current default-key collision; extensions do not.
        if not section.startswith('x_') and section in parallel:
            key = key if key is not None else 'default'
        peers = selected.setdefault(section, {})
        if key in peers:
            histories.setdefault(section, []).append(peers[key])
        peers[key] = block
    for section, peers in selected.items():
        if section.startswith('x_'):
            model['extensions'][section] = dict(mode='variants', blocks=[dict(variant=key, block=peers[key]) for key in sorted(peers, key=sortkey)]) if section in parallel else dict(mode='single', block=peers[None])
        else:
            model['sections'][section] = peers if section in parallel else peers[None]
    model['superseded'] = histories
    # Source accounting is distinct from full carrier/model admission.
    admit_json(model)
    dump(model)
    # Enumerate accounted source occurrences without entering carrier/schema admission.
    accounted = []
    for entry in model['sections'].values():
        accounted.extend([entry] if is_envelope_block(entry) else entry.values())
    for entry in model['extensions'].values():
        accounted.extend([entry['block']] if entry['mode'] == 'single' else [item['block'] for item in entry['blocks']])
    for collection in ARRAYS:
        accounted.extend(model[collection])
    for history in model['superseded'].values():
        accounted.extend(history)
    need(len(accounted) == len(physical), 'physical accounting count')
    need(all(sum(item is block for item in accounted) == 1 for _, _, block in physical), 'physical occurrence accounting')
    return model


def envelope_digest(envelope):
    return digest(envelope)


def source_digest(document):
    try:
        return envelope_digest(semantic_envelope(document))
    except (ValueError, TypeError, KeyError, OverflowError) as error:
        raise EnvelopeError(str(error)) from error


if __name__ == '__main__':
    command, path = sys.argv[1:3]
    data = Path(path).read_bytes()
    value = project_source(data) if command == 'source' else decode_zip(data) if command == 'zip' else decode_xml(data.decode('utf-8-sig')) if command == 'xml' else validate(load_json(data.decode('utf-8-sig')))
    print(json.dumps({'model': value, 'preimage': preimage(value), 'digest': digest(value)}, ensure_ascii=True, allow_nan=False))
