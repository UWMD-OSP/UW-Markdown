"""Explicit synthetic oracles; never read output from the candidate implementation.

Builder-authored additions extend the independent red-team's source examples.
Preimages use the existing independent Python JCS. A fresh independent review of
these additions remains a separate gate; generating a fixture is not that review.
Run deliberately to author fixtures, never automatically in CI.
"""
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'implementations/python'))
from uwmd_jcs import canonicalize

HERE = Path(__file__).resolve().parent
FM = {'uw_version': '3.0', 'deal_id': 'synthetic-complete-record', 'deal_name': 'Synthetic complete record'}


def block(section, marker=1, variant=None, role=False, revision=1, history=False):
    annotation = {'section': section}
    if variant is not None:
        annotation['variant'] = variant
    content = {'_meta': {'section': section,
                        'provenance': {'source': 'manual', 'actor': 'synthetic', 'timestamp': '2026-10-23T00:00:00Z'},
                        'quality': {'confidence': 'high', 'human_review_required': False},
                        'lifecycle': {'revision': revision, 'superseded': history}}, 'marker': marker}
    if role:
        content['_role'] = 'primary'
    if revision != 1:
        annotation['v'] = revision
    if history:
        annotation['superseded'] = True
    return {'annotation': annotation, 'content': content}


def empty():
    return {'envelope_version': '2.0', 'format_version': '3.0', 'frontmatter': copy.deepcopy(FM),
            'sections': {}, 'pipeline_log': [], 'custom_calculations': [], 'custom_scenarios': [],
            'extensions': {}, 'superseded': {}}


def source(blocks):
    value = '---\n' + '\n'.join(key + ': ' + json.dumps(item) for key, item in FM.items()) + '\n---\n\n'
    for item in blocks:
        a = item['annotation']
        attrs = ''.join(' ' + key + '=' + (str(value).lower() if isinstance(value, bool) else str(value)) for key, value in a.items() if key != 'section')
        value += '```json uw:section=' + a['section'] + attrs + '\n' + json.dumps(item['content'], ensure_ascii=True, separators=(',', ':')) + '\n```\n\n'
    return value


cases = []


def add(name, blocks, model):
    model = copy.deepcopy(model)
    model.update(generated_at='2000-01-01T00:00:00Z', generator='candidate')
    cases.append({'name': name, 'source': source(blocks), 'physical_count': len(blocks), 'expected_model': model})


add('empty', [], empty())
single = block('x_probe', variant='default')
m = empty(); m['extensions']['x_probe'] = {'mode': 'single', 'block': single}
add('named-default-single', [single], m)
peer = block('x_probe', variant='default', role=True)
m = empty(); m['extensions']['x_probe'] = {'mode': 'variants', 'blocks': [{'variant': 'default', 'block': peer}]}
add('named-default-role-one-peer', [peer], m)
base, detail = block('x_probe', 1, 'base', True), block('x_probe', 2, 'detail')
m = empty(); m['extensions']['x_probe'] = {'mode': 'variants', 'blocks': [{'variant': 'base', 'block': base}, {'variant': 'detail', 'block': detail}]}
add('peers-base-detail', [base, detail], m)
add('peers-detail-base', [detail, base], m)
null, default = block('x_probe', 1, role=True), block('x_probe', 2, 'default')
m = empty(); m['extensions']['x_probe'] = {'mode': 'variants', 'blocks': [{'variant': None, 'block': null}, {'variant': 'default', 'block': default}]}
add('null-then-default', [null, default], m)
add('default-then-null', [default, null], m)
historical = block('x_probe', 0, history=True)
m = empty(); m['superseded']['x_probe'] = [historical]
add('history-only', [historical], m)
historical_role = block('x_probe', 0, 'base', True, history=True)
m = empty(); m['extensions']['x_probe'] = {'mode': 'single', 'block': single}; m['superseded']['x_probe'] = [historical_role]
add('role-only-in-history', [historical_role, single], m)
high, low = block('x_probe', 1, 'base', True, 9), block('x_probe', 2, 'base', True, 1)
m = empty(); m['extensions']['x_probe'] = {'mode': 'variants', 'blocks': [{'variant': 'base', 'block': low}]}; m['superseded']['x_probe'] = [high]
add('revision-nine-then-one', [high, low], m)
one, two, three = block('x_probe', 1), block('x_probe', 2, history=True), block('x_probe', 3)
m = empty(); m['extensions']['x_probe'] = {'mode': 'single', 'block': three}; m['superseded']['x_probe'] = [two, one]
add('explicit-before-implicit-prior', [one, two, three], m)
m = empty(); m['extensions']['x_probe'] = {'mode': 'single', 'block': three}; m['superseded']['x_probe'] = [one, two]
add('implicit-prior-before-explicit', [one, three, two], m)
equal1, equal2 = block('x_probe'), block('x_probe')
m = empty(); m['extensions']['x_probe'] = {'mode': 'single', 'block': equal2}; m['superseded']['x_probe'] = [equal1]
add('equal-physical-extensions', [equal1, equal2], m)
one, two, three = block('property', 1), block('property', 2, history=True), block('property', 3)
m = empty(); m['sections']['property'] = three; m['superseded']['property'] = [two, one]
add('builtin-mixed-history', [one, two, three], m)
m = empty(); m['sections']['property'] = three; m['superseded']['property'] = [one, two]
add('builtin-reverse-history', [one, three, two], m)
one, two = block('property'), block('property')
m = empty(); m['sections']['property'] = two; m['superseded']['property'] = [one]
add('equal-physical-builtins', [one, two], m)
high, low = block('property', 1, revision=9), block('property', 2)
m = empty(); m['sections']['property'] = low; m['superseded']['property'] = [high]
add('builtin-revision-nine-then-one', [high, low], m)
m = empty()
p = block('property'); a = block('operating_statement', 1, 't12'); b = block('operating_statement', 2, 'uw')
m['sections'] = {'property': p, 'operating_statement': {'t12': a, 'uw': b}}
append = [block(key) for key in ('pipeline_log', 'custom_calculations', 'custom_scenarios')]
for key, item in zip(('pipeline_log', 'custom_calculations', 'custom_scenarios'), append):
    m[key] = [item]
e = block('x_all'); h = block('property', 0, history=True)
m['extensions']['x_all'] = {'mode': 'single', 'block': e}; m['superseded']['property'] = [h]
add('all-source-collections', [p, a, b, *append, e, h], m)

direct = []
m = empty(); p = block('property')
p['content'].update({'': None, '__proto__': {'safe': True}, 'content': {'literal': True}, '_notes': 'retained notes',
                     'strings': ['\0', '\n', '\r', '\t', '\x7f', '\ufffe', '\uffff', '\U00010000', '"\\<&>', ''],
                     'numbers': [0, -0.0, 1.7976931348623157e308, 5e-324, 1e-7, 1e21, 9007199254740992.0],
                     'empty_object': {}, 'empty_array': [], 'scalar_types': [False, True, None, '', 0]})
p['prose'] = 'CR\rLF\nTAB\tNUL\0\ufffe'
p['x_extra'] = {'a/~b': [{'': None}], 'empty': {}, 'nested': {'\U00010000': '\ue000'}}
p['x_null'] = None
m['sections']['property'] = p
m['superseded']['x_empty'] = []
m['x_outer'] = {'': None, 'a/~b': [], 'unicode': '\uffff'}
ids = [None, '', '/', 'annotation', 'content', 'default', '~', '\U00010000', '\ue000']
records = [{'variant': label, 'block': block('x_labels', index, label)} for index, label in enumerate(ids)]
m['extensions']['x_labels'] = {'mode': 'variants', 'blocks': records}
m['pipeline_log'] = [block('pipeline_log')]; m['custom_calculations'] = [block('custom_calculations')]; m['custom_scenarios'] = [block('custom_scenarios')]
direct.append({'name': 'all-values-and-collections', 'expected_model': m})
m = empty(); m['extensions']['x_probe'] = {'mode': 'variants', 'blocks': [{'variant': 'default', 'block': block('x_probe', variant='default')}]}
direct.append({'name': 'direct-one-peer-no-role', 'expected_model': m})

for item in cases + direct:
    model = item['expected_model']
    semantic = {key: value for key, value in model.items() if key not in ('generated_at', 'generator', 'semantic_digest')}
    text = canonicalize(semantic)
    item['expected_preimage'] = text
    item['expected_digest'] = 'sha256:' + hashlib.sha256(text.encode('utf-8')).hexdigest()
packet = {'status': 'unaccepted candidate oracles; independent review not claimed',
          'authorship': 'Builder-authored additions; source expectations extend independent red-team cases; preimages use independent Python JCS',
          'source_cases': cases, 'direct_models': direct}
(HERE / 'cases.json').write_text(json.dumps(packet, ensure_ascii=True, allow_nan=False, indent=2) + '\n', encoding='utf-8')
print(f'Frozen {len(cases)} source cases and {len(direct)} complete direct models; no candidate implementation invoked')
