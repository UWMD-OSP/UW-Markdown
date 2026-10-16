"""Independent adversarial controls for the Reader/period slice of #354."""
import copy
import json
from pathlib import Path
import unittest

from uwmd_calendar import calendar_date
from uwmd_periods import resolve_period, selector, select_section
from uwmd_reader import ProtocolError, decode_json, frontmatter, parse, scalar
from uwmd_validation import validate

ROOT = Path(__file__).resolve().parents[2]
HEADER = '---\nuw_version: "3.0"\nfuture_key: retained\n---\n'


def block(section, payload=None, variant=None, role=None, superseded=False):
    data = {'_meta': {'section': section, 'provenance': {'source': 'manual', 'timestamp': '2026-01-01T00:00:00Z'},
                     'quality': {'confidence': 'high', 'human_review_required': False},
                     'lifecycle': {'revision': 1, 'superseded': superseded}}}
    if role is not None:
        data['_role'] = role
    data.update(payload or {})
    return '\n```json uw:section=' + section + (' variant=' + variant if variant else '') + '\n' + json.dumps(data) + '\n```\n'


class ReaderTests(unittest.TestCase):
    def test_yaml_scalars_and_comments(self):
        self.assertEqual(scalar('"a\\n\\t\\x41\\u0042\\U00000043" # comment'), 'a\n\tABC')
        self.assertEqual(scalar("'O''Brien # &a *b !c'"), "O'Brien # &a *b !c")
        self.assertEqual(scalar('abc#def # comment'), 'abc#def')
        self.assertEqual(frontmatter('x:\n  - one\n  - "two"\ny:\n  a: 1.200e-2\n')['y']['a'].token, '1.200e-2')

    def test_yaml_refusals(self):
        for source in ['x: &anchor', 'x: *alias', 'x: !!str 3', 'x: [1]', 'x: {}', 'x: |',
                       'x: "unterminated', 'x: "a" garbage', 'x: "\\q"', 'x: 1\nx: 2',
                       'x:\n  a: 1\n  a: 2', 'x:\n  y:\n    z: 1', '%YAML 1.2', '? x: y']:
            with self.subTest(source=source), self.assertRaises(ProtocolError) as caught:
                frontmatter(source)
            self.assertEqual(caught.exception.code, 'UNSUPPORTED_YAML_FEATURE')

    def test_version_and_filename_refusals(self):
        for source in ['', HEADER.replace('"3.0"', '"2.0"'), HEADER.replace('"3.0"', '3.0')]:
            with self.assertRaises(ProtocolError) as caught:
                parse(source)
            self.assertEqual(caught.exception.code, 'UNSUPPORTED_FORMAT_VERSION')
        with self.assertRaises(ProtocolError) as caught:
            parse(HEADER + block('property'), 'deal.uw.md')
        self.assertEqual(caught.exception.code, 'SOURCE_CONTENT_MISMATCH')

    def test_source_tokens_and_unknown_fields(self):
        source = (HEADER + block('x_future', {'content': {'literal': True}, 'n': 1})).replace('"n": 1', '"n": 1.200e-2').replace('\n', '\r\n')
        document = parse(source)
        self.assertEqual(document.source, source)
        self.assertEqual(document.blocks[0].body['n'].token, '1.200e-2')
        self.assertEqual(document.projection()['frontmatter']['future_key'], 'retained')
        self.assertEqual(document.projection()['extensions']['x_future']['content']['content'], {'literal': True})
        snapshot = copy.deepcopy(document.blocks[0].body)
        document.projection()
        self.assertEqual(document.blocks[0].body, snapshot)

    def test_duplicate_json_decoded_names_and_nonfinite(self):
        for value in ['{"a":1,"\\u0061":2}', 'NaN', 'Infinity', '1e309', '[1,]', '{"a":01}']:
            with self.subTest(value=value), self.assertRaises(ProtocolError):
                decode_json(value)

    def test_unclosed_and_nested_example_fences(self):
        with self.assertRaises(ProtocolError):
            parse(HEADER + '```json uw:section=property\n{}')
        document = parse(HEADER + '````markdown\n```json uw:section=fake\n{}\n```\n````\n' + block('unknown'))
        self.assertEqual([b.annotation['section'] for b in document.blocks], ['unknown'])

    def test_history_and_role_opt_in_are_order_independent(self):
        old = block('debt_structure', {'loan_amount': 10}, superseded=True)
        senior = block('debt_structure', {'loan_amount': 20}, variant='loan', role='senior')
        peer = block('debt_structure', {'loan_amount': 3}, variant='peer')
        for body in (peer + old + senior, senior + peer + old):
            document = parse(HEADER + body)
            projection = document.projection()
            self.assertEqual(set(projection['sections']['debt_structure']), {'loan', 'peer'})
            self.assertEqual(projection['superseded']['debt_structure'][0]['content']['loan_amount'], 10)
            self.assertEqual(select_section(document, 'debt_structure', role='senior').body['loan_amount'], 20)

    def test_all_portable_reader_projections(self):
        # Only the test oracle reads expected data. Runtime modules never do.
        import importlib.util
        spec = importlib.util.spec_from_file_location('portable_runner', ROOT / 'conformance/runner/runner.py')
        runner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(runner)
        for path in sorted((ROOT / 'conformance/runner/cases').glob('reader__*__parse.case.json')):
            case = json.loads(path.read_text())
            fixture = ROOT / case['fixture_dir'] / case['args'][0]
            expected = json.loads((ROOT / case['expect']['file']).read_text())
            with self.subTest(case=case['id']):
                document = parse(fixture.read_bytes().decode('utf-8'), fixture)
                self.assertEqual(runner.json_subset(expected, document.projection()), [])


class PeriodTests(unittest.TestCase):
    def test_calendar_is_character_only_and_year_zero_is_valid(self):
        for value in ['0000-02-29', '2000-02-29', '9999-12-31']:
            self.assertTrue(calendar_date(value))
        for value in ['1900-02-29', '2026-04-31', '2024-2-29', '２０２４-01-01', '2024-01-01\n', None, 20240101]:
            self.assertFalse(calendar_date(value))

    def test_selectors_kind_and_bounds(self):
        self.assertNotEqual(selector('Y2026'), selector('2026-01'))
        self.assertEqual(selector('0000-Q1'), ('quarter', 0, 1))
        for value in ['Y0', 'Y01', 'Y9007199254740992', 'Q1', '2026-00', '2026-Q5', '2026-02-29']:
            with self.subTest(value=value), self.assertRaises(ProtocolError):
                selector(value)

    def test_exact_year_not_position_and_no_mutation(self):
        document = parse(HEADER + block('dcf', {'annual_cash_flows': [{'year': 7, 'n': 70}, {'year': 3, 'n': 30}]}))
        before = document.source
        self.assertEqual(resolve_period(document, 'dcf', 'annual_cash_flows', 'Y3', ('n',)), 30)
        self.assertIsNone(resolve_period(document, 'dcf', 'annual_cash_flows', 'Y1', ('n',)))
        self.assertIsNone(resolve_period(document, 'dcf', 'annual_cash_flows', '2026-01-01', ('n',)))
        self.assertEqual(document.source, before)

    def test_same_day_rows_only_refuse_ambiguous_requested_date(self):
        rows = [{'date': '2026-01-01', 'n': -100}, {'date': '2026-01-01', 'n': 10}, {'date': '2026-02-01', 'n': 20}]
        document = parse(HEADER + block('cash_flow_series', {'series': rows}))
        self.assertEqual(resolve_period(document, 'cash_flow_series', 'series', '2026-02-01', ('n',)), 20)
        with self.assertRaises(ProtocolError) as caught:
            resolve_period(document, 'cash_flow_series', 'series', '2026-01-01', ('n',))
        self.assertEqual(caught.exception.code, 'CALC-PERIOD-002')
        self.assertNotIn('PS-02', [i['code'] for i in validate(document)['issues']])
        self.assertEqual(len(document.blocks[0].body['series']), 3)

    def test_duplicate_keyed_years_and_malformed_unselected_rows(self):
        for payload, code in [({'projections': {'year_01': {}, 'year_1': {}}}, 'CALC-PERIOD-002'),
                              ({'projections': {'year_1': {}, 'bad': {}}}, 'CALC-PERIOD-001')]:
            document = parse(HEADER + block('noi_model', payload))
            with self.assertRaises(ProtocolError) as caught:
                resolve_period(document, 'noi_model', 'projections', 'Y2')
            self.assertEqual(caught.exception.code, code)

    def test_missing_null_cadence_and_invalid_roles(self):
        document = parse(HEADER + block('dcf', {'annual_cash_flows': [{'year': None}]}))
        self.assertIsNone(resolve_period(document, 'dcf', 'annual_cash_flows', 'Y3'))
        for role in [[], {}, False, 'unknown']:
            body = json.loads(block('dcf', {'annual_cash_flows': []}, variant='v').split('\n')[2])
            body['_role'] = role
            source = HEADER + '\n```json uw:section=dcf variant=v\n' + json.dumps(body) + '\n```\n'
            with self.subTest(role=role), self.assertRaises(ProtocolError):
                resolve_period(parse(source), 'dcf', 'annual_cash_flows', 'Y1')
        document = parse(HEADER + block('lease_up_schedule', {'schedule': [{'period': '2026-01'}], 'period_granularity': 'quarterly'}))
        with self.assertRaises(ProtocolError):
            resolve_period(document, 'lease_up_schedule', 'schedule', '2026-Q1')

    def test_explicit_variant_no_fallback_component_allowed(self):
        document = parse(HEADER + block('dcf', {'annual_cash_flows': [{'year': 2, 'n': 8}]}, variant='a', role='component'))
        self.assertEqual(resolve_period(document, 'dcf', 'annual_cash_flows', 'Y2', ('n',), variant='a'), 8)
        with self.assertRaises(ProtocolError):
            resolve_period(document, 'dcf', 'annual_cash_flows', 'Y2', variant='base')

    def test_validation_is_explicitly_partial_and_preserves_roles(self):
        document = parse(HEADER + block('dcf', {'annual_cash_flows': [{'year': 1}, {'year': 1}]}, role='invalid'))
        result = validate(document)
        self.assertFalse(result['complete'])
        self.assertEqual(result['verification_state'], 'unverifiable')
        self.assertEqual({i['code'] for i in result['issues']}, {'ROLE-01', 'PS-02'})
        self.assertEqual(document.blocks[0].body['_role'], 'invalid')


if __name__ == '__main__':
    unittest.main()
