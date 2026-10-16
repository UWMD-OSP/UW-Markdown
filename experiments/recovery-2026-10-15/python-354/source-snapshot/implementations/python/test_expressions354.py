"""Settled grammar/arithmetic controls, independent of the TS implementation."""
import unittest

from uwmd_expressions import (IncompleteImplementation, NumericalContractBlocked,
                              calculate, evaluate, parse_expression)
from uwmd_reader import ProtocolError, decode_json, parse
from test_reader354 import HEADER, block


class ExpressionTests(unittest.TestCase):
    def setUp(self):
        self.document = parse(HEADER + block('property', {'units': 5}))

    def expression(self, text):
        return evaluate(parse_expression(text), self.document)

    def test_order_and_null(self):
        self.assertEqual(self.expression('1 + 2 * 3 - 8 / 4'), 5)
        self.assertIsNone(self.expression('absent * 10 + 2'))
        self.assertEqual(self.expression('property.units / 2'), 2.5)
        self.assertEqual(self.expression("coalesce(absent, property.units, 0)"), 5)
        self.assertEqual(self.expression('sum(10000000000000000, -10000000000000000, 1)'), 1)

    def test_boolean_short_circuit_but_parse_whole_formula(self):
        self.assertFalse(self.expression('false && (1 / 0 > 0)'))
        self.assertTrue(self.expression('true || (1 / 0 > 0)'))
        self.assertEqual(self.expression('true ? 2 : 1 / 0'), 2)
        self.assertIsNone(self.expression('null && true'))
        with self.assertRaises(ProtocolError):
            self.expression('true || (x = 1)')
        with self.assertRaises(ProtocolError):
            self.expression('1 && true')

    def test_safe_grammar_refuses_host_language(self):
        for text in ['x = 1', 'lambda x: x', 'x => x', 'for(;;)', 'a[0]', '(a).b',
                     'f()()', '1e3', '.5', '1.', '--2', '!!true', '1 < 2 < 3',
                     "'unterminated", 'a.constructor', "a['__proto__']", '1; 2',
                     'true ? 2 : (x = 3)']:
            with self.subTest(text=text), self.assertRaises(ProtocolError):
                parse_expression(text)

    def test_numerical_dependencies_are_blocked(self):
        for name, arguments in [('pow', '1.2, 31'), ('log', '2'), ('exp', '1'),
                                ('irr', '-100, 110'), ('pmt', '0.01, 12, 100')]:
            with self.subTest(name=name), self.assertRaises(NumericalContractBlocked):
                self.expression(name + '(' + arguments + ')')
        self.assertFalse(self.expression('false && (pow(1.2, 31) > 1)'))

    def test_settled_builtins_arity_and_types(self):
        self.assertEqual(self.expression('round(-1.005, 2)'), -1.01)
        self.assertEqual(self.expression('floor(-1.2) + ceil(1.2)'), 0)
        self.assertEqual(self.expression('sqrt(9)'), 3)
        self.assertEqual(self.expression('avg(1, null, 3)'), 2)
        self.assertIsNone(self.expression('avg(null)'))
        self.assertEqual(self.expression('sum(null)'), 0)
        self.assertTrue(self.expression("is_calendar_date('0000-02-29')"))
        self.assertFalse(self.expression('is_calendar_date(property)'))
        self.assertFalse(self.expression('is_calendar_date(absent)'))
        for text in ['abs(true)', 'sqrt(-1)', 'is_calendar_date()', 'is_calendar_date(1, 2)', '1 / 0']:
            with self.subTest(text=text), self.assertRaises(ProtocolError):
                self.expression(text)

    def test_period_arithmetic_and_ordinary_bracket_keys(self):
        document = parse(HEADER + block('dcf', {'annual_cash_flows': [{'year': 3, 'x.y': 40}, {'year': 1, 'x.y': 10}]}))
        self.assertEqual(evaluate(parse_expression("dcf.annual_cash_flows@Y3['x.y'] / 2"), document), 20)
        self.assertEqual(evaluate(parse_expression("dcf.annual_cash_flows['0']['x.y']"), document), 40)
        self.assertEqual(evaluate(parse_expression("dcf.annual_cash_flows@Y3['x.y']-1"), document), 39)
        for text in ['dcf.annual_cash_flows@Y3@Y1', 'property.units@Y1', 'dcf.annual_cash_flows@Y01']:
            with self.subTest(text=text), self.assertRaises(ProtocolError):
                parse_expression(text)

    def test_quantize_once_and_source_precision(self):
        result = calculate(self.document, decode_json('{"id":"r","formula":"1.005","round_to":2}'))
        self.assertEqual(result['value'], 1.01)
        self.assertTrue(result['ok'])
        self.assertEqual(decode_json('1.200e-2').decimal_places, 5)
        self.assertEqual(decode_json('100e2').decimal_places, 0)
        self.assertEqual(decode_json('0.0550').decimal_places, 4)
        for places in [-1, 13, True, None, 1.5]:
            result = calculate(self.document, {'id': 'bad', 'formula': '1', 'round_to': places})
            self.assertFalse(result['ok'])
            self.assertEqual(result['error']['code'], 'CALC-TYPE-001')

    def test_unsettled_operator_semantics_remain_explicit(self):
        for text in ['null ? 1 : 2', '-5 % 3', 'unimplemented(1)']:
            with self.subTest(text=text), self.assertRaises(IncompleteImplementation):
                self.expression(text)


if __name__ == '__main__':
    unittest.main()
