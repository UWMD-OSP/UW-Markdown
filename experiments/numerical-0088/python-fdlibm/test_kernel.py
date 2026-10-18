"""Focused independent-kernel boundary and read-only evidence controls."""
import ast
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import kernel as k
from check_evidence import measure, verify_inputs
from wrappers import current_policy

HERE = Path(__file__).resolve().parent


class Binary64AndWords(unittest.TestCase):
    def test_runtime_binary64_nearest_even_gradual_underflow(self):
        self.assertEqual((sys.float_info.radix, sys.float_info.mant_dig, sys.float_info.max_exp), (2, 53, 1024))
        one = k.from_bits('3ff0000000000000')
        half_ulp = k.from_bits('3ca0000000000000')
        self.assertEqual(k.to_bits(one + half_ulp), '3ff0000000000000')
        self.assertEqual(k.to_bits(one + 3.0 * half_ulp), '3ff0000000000002')
        minimum_normal = k.from_bits('0010000000000000')
        self.assertEqual(k.to_bits(minimum_normal * k.from_bits('3cb0000000000000')), '0000000000000001')

    def test_word_roundtrip_signed_zero_nan_and_wrapping(self):
        for bits in ('8000000000000000', '0000000000000001', '7fefffffffffffff', 'fff8000000000001'):
            value = k.from_bits(bits)
            self.assertEqual(k.to_bits(k.assemble(k.high(value), k.low(value))), bits)
        self.assertEqual(k.s32(0x80000000), -(1 << 31))
        self.assertEqual(k.u32(-1), 0xffffffff)
        self.assertEqual(k.s32(0x7fffffff + 1), -(1 << 31))
        self.assertEqual(k.u32(0 - 1), 0xffffffff)
        for count, unsigned, signed, left in ((0, 0x80000001, -2147483647, -2147483647), (32, 0, -1, 0)):
            self.assertEqual(k.shift(0x80000001, count, 'unsigned'), unsigned)
            self.assertEqual(k.shift(0x80000001, count, 'signed'), signed)
            self.assertEqual(k.shift(0x80000001, count, 'left'), left)
        for count in (-1, 33, True):
            with self.assertRaises(ValueError):
                k.shift(1, count, 'left')

    def test_ieee_division_adapts_zero_without_losing_sign(self):
        for numerator, denominator, expected in ((1.0, -0.0, 'fff0000000000000'), (-1.0, -0.0, '7ff0000000000000'), (1.0, k.INF, '0000000000000000'), (-1.0, k.INF, '8000000000000000')):
            self.assertEqual(k.to_bits(k.divide(numerator, denominator)), expected)
        for numerator, denominator in ((0.0, 0.0), (k.NAN, 0.0), (k.INF, k.INF)):
            result = k.divide(numerator, denominator)
            self.assertNotEqual(result, result)


class CompleteKernel(unittest.TestCase):
    def test_raw_specials_and_negative_exponent_range(self):
        self.assertEqual(k.pow(k.NAN, 0.0), 1.0)
        self.assertNotEqual(k.pow(-2.0, 0.5), k.pow(-2.0, 0.5))
        self.assertEqual(k.to_bits(k.pow(-0.0, -3.0)), 'fff0000000000000')
        self.assertEqual(k.to_bits(k.pow(2.0, -1074.0)), '0000000000000001')
        self.assertEqual(k.to_bits(k.pow(-2.0, -1075.0)), '8000000000000000')
        self.assertEqual(k.to_bits(k.sqrt(-0.0)), '8000000000000000')
        self.assertEqual(k.log(0.0), -k.INF)
        self.assertEqual(k.exp(-k.INF), 0.0)
        self.assertEqual(k.scalbn(1.0, (1 << 31) - 1), k.INF)
        self.assertEqual(k.scalbn(-1.0, -(1 << 31)), -0.0)
        for bad in (1 << 31, -(1 << 31) - 1, True, 1.5):
            with self.assertRaises(ValueError):
                k.scalbn(1.0, bad)

    def test_negative_unit_parity_uses_exact_input_not_integer_cast(self):
        # Independent rational integer-ness/parity oracle at exponent/word edges.
        for exponent in (0, 1, 1022, 1023, 1042, 1043, 1044, 1074, 1075, 1076, 2046):
            for sign in (0, 1):
                for trailing in (0, 1, 0x80000001, 0xffffffff):
                    y = k.assemble((sign << 31) | (exponent << 20), trailing)
                    numerator, denominator = y.as_integer_ratio()
                    actual = k.pow(-1.0, y)
                    if denominator != 1:
                        self.assertNotEqual(actual, actual)
                    else:
                        self.assertEqual(actual, -1.0 if numerator & 1 else 1.0)

    def test_sqrt_subnormal_count32_and_scalar_loop_bound(self):
        # Trace actual line-body executions, including normalization loops.
        lines = (HERE / 'kernel.py').read_text(encoding='utf-8').splitlines()
        markers = ('exponent -= 21', 'ix0 = s32(ix0 << 1)', 'moving = 1 << bit')
        tracked = {i + 1 for i, line in enumerate(lines) if any(line.strip() == marker for marker in markers)}
        for bits in (1, 1 << 31, 1 << 32, (1 << 52) - 1, 0x3ff0000000000000, 0x7fefffffffffffff):
            bodies = []
            def trace(frame, event, arg):
                if event == 'line' and frame.f_code.co_filename == k.__file__ and frame.f_lineno in tracked:
                    bodies.append(frame.f_lineno)
                return trace
            try:
                sys.settrace(trace)
                k.sqrt(k.number(bits))
            finally:
                sys.settrace(None)
            self.assertLessEqual(len(bodies), 76)
        self.assertEqual(k.to_bits(k.sqrt(k.number(1 << 32))), '1f60000000000000')

    def test_public_wrapper_is_separate_from_raw_exceptional_values(self):
        self.assertEqual(k.pow(1e155, 2.0), k.INF)
        self.assertEqual(k.divide(1.0, k.pow(1e155, 2.0)), 0.0)
        self.assertEqual(current_policy('pow', [1e155, 2.0])['reason'], 'nonfinite_result')
        self.assertEqual(current_policy('pow', [k.INF, 0.0]), {'status': 'returned', 'value': 1.0})
        self.assertEqual(current_policy('exp', [-k.INF]), {'status': 'returned', 'value': 0.0})
        self.assertEqual(current_policy('sqrt', [k.INF]), {'status': 'returned', 'value': k.INF})
        self.assertEqual(current_policy('log', [0.0])['reason'], 'domain')
        self.assertEqual(current_policy('pow', [None, 1.0]), {'status': 'returned', 'value': None})
        self.assertEqual(current_policy('pow', [None, True])['reason'], 'type')
        result = current_policy('log', [k.NAN])['value']
        self.assertNotEqual(result, result)

    def test_no_host_transcendental_or_float_power_escape(self):
        tree = ast.parse((HERE / 'kernel.py').read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            self.assertFalse(isinstance(node, ast.Pow))
            if isinstance(node, ast.Import):
                self.assertFalse(any(alias.name in ('math', 'cmath', 'decimal', 'numpy') for alias in node.names))
            if isinstance(node, ast.ImportFrom):
                self.assertNotIn(node.module, ('math', 'cmath', 'decimal', 'numpy'))
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                self.assertNotIn(node.func.attr, ('pow', 'sqrt', 'log', 'exp', 'scalbn', 'ldexp', 'copysign', 'fabs'))
        with patch.object(k, 'log', side_effect=AssertionError('pow called standalone log')), patch.object(k, 'exp', side_effect=AssertionError('pow called standalone exp')):
            self.assertEqual(k.to_bits(k.pow(2.0, 1.5)), '4006a09e667f3bcc')


class FrozenEvidence(unittest.TestCase):
    def test_all_native_frozen_words_and_mathematical_counterexamples(self):
        report = measure()
        self.assertEqual(len(report['native_comparisons']), 3)
        for row in report['native_comparisons']:
            self.assertEqual((row['cases'], row['exact_non_nan_words'], row['nan_classes']), (4204, 3435, 769))
        self.assertEqual((report['math_cases'], report['mathematical_word_agreements']), (178, 173))
        self.assertEqual([(r['id'], r['candidate_word'], r['mathematical_word']) for r in report['mathematical_disagreements']], [
            ('exp-word-3fd62e41ffffffff', '3ff6a09e0c594ff2', '3ff6a09e0c594ff3'),
            ('exp-word-3ff0000000000000', '4005bf0a8b14576a', '4005bf0a8b145769'),
            ('bounded-math-power-2', '3fe6a09e667f3bcc', '3fe6a09e667f3bcd'),
            ('bounded-math-power-4', '4071cda00ebe20d6', '4071cda00ebe20d7'),
            ('bounded-math-power-7', '4006a09e667f3bcc', '4006a09e667f3bcd'),
        ])

    def test_evidence_identity_guard_refuses_tampered_bytes(self):
        original = Path.read_bytes
        def changed(path):
            value = original(path)
            return value + b' ' if path.name == 'constants.json' else value
        with patch.object(Path, 'read_bytes', changed):
            with self.assertRaisesRegex(ValueError, 'frozen evidence identity changed'):
                verify_inputs()

    def test_raw_jsonl_runner_rejects_malformed_words(self):
        runner = HERE / 'run.py'
        result = subprocess.run([sys.executable, '-B', str(runner)], input=json.dumps({'id': 'raw', 'op': 'pow', 'x': '7ff0000000000000', 'y': '0000000000000000'}) + '\n', capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(result.stdout)['bits'], '3ff0000000000000')
        invalid = subprocess.run([sys.executable, '-B', str(runner)], input='{"id":"bad","op":"sqrt","x":"1"}\n', capture_output=True, text=True)
        self.assertNotEqual(invalid.returncode, 0)
        self.assertEqual(invalid.stdout, '')


if __name__ == '__main__':
    unittest.main()
