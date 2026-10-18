"""Bounded exact real formulas and ideal-power ordered-graph counterfactual.

Fractions only: no float, Decimal, production or candidate import. The ideal
primitive means one mathematically correctly rounded power of the ALREADY
ROUNDED base, not an executed MPFR adapter or a replacement financial graph.
"""
from fractions import Fraction
import importlib.util
from pathlib import Path
HERE = Path(__file__).resolve().parent


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, HERE.parent / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


P = load('cancellation_rational_words', 'power-procedures/reference.py')
REPORT = load('cancellation_decimal_reporting', 'cash-graphs/cash_reference.py')
ONE, ZERO = P.ONE, 0


def encoded(bits):
    magnitude = bits & (P.SIGN - 1)
    return {'kind': 'nan' if magnitude > P.INF else 'infinity' if magnitude == P.INF else 'finite', 'bits': P.hexword(bits)}


def fraction(value):
    return {'numerator_hex': hex(value.numerator), 'denominator_hex': hex(value.denominator)}


def report(bits, places):
    if not P.finite(bits):
        return {'status': 'refused_nonfinite'}
    result = REPORT.quantize(bits, places)
    return {'status': 'reported', 'bits': result['bits'], 'token': result['number_token']}


def domain(case):
    assert case['op'] in ('pmt', 'pv', 'fv')
    assert type(case['n']) is int and case['n'] in (1, 360)
    assert case['amount'] == '3ff0000000000000' and case['other'] == '0000000000000000'
    r = P.rational(P.word(case['rate']))
    assert -1 < r < 1 and case['places'] == 12
    return r, case['n']


def real_value(case):
    r, n = domain(case)
    amount, other = P.rational(P.word(case['amount'])), P.rational(P.word(case['other']))
    if r == 0:
        return amount / n if case['op'] == 'pmt' else amount * n + other
    # Exact real base and rational integer power: no binary64 rounding here.
    growth = (1 + r) ** n
    if case['op'] == 'pmt':
        return amount * r / (1 - 1 / growth)
    if case['op'] == 'pv':
        return amount * (1 - 1 / growth) / r + other / growth
    return other * growth + amount * (growth - 1) / r


class IdealGraph:
    def __init__(self):
        self.rows = []

    def operation(self, op, *args):
        if op == 'pow':
            base, exponent = P.rational(args[0]), P.rational(args[1])
            assert exponent.denominator == 1 and abs(exponent) <= 360
            result = P.nearest(base ** exponent.numerator)
        else:
            a, b = map(P.rational, args)
            sign = bool((args[0] ^ args[1]) & P.SIGN)
            if op == 'add': result = P.nearest(a + b, negative_zero=a == b == 0 and bool(args[0] & args[1] & P.SIGN))
            elif op == 'subtract': result = P.nearest(a - b)
            elif op == 'multiply': result = P.nearest(a * b, negative_zero=sign and (a == 0 or b == 0))
            elif op == 'divide':
                result = (P.INF | (P.SIGN if sign else 0)) if b == 0 and a != 0 else (P.INF | 1) if b == a == 0 else P.nearest(a / b, negative_zero=sign and a == 0)
            else: raise ValueError(op)
        self.rows.append({'op': op, 'args': [encoded(value) for value in args], 'result': encoded(result)})
        return result


def ordered(case, graph):
    domain(case)
    r, n, amount, other = P.word(case['rate']), P.nearest(Fraction(case['n'])), P.word(case['amount']), P.word(case['other'])
    op = graph.operation
    if P.rational(r) == 0:
        return op('divide', amount, n) if case['op'] == 'pmt' else op('add', other, op('multiply', amount, n)) if case['op'] == 'fv' else op('add', op('multiply', amount, n), other)
    if case['op'] == 'pmt':
        numerator = op('multiply', amount, r)
        base = op('add', ONE, r)
        factor = op('pow', base, n ^ P.SIGN)
        return op('divide', numerator, op('subtract', ONE, factor))
    base = op('add', ONE, r)
    factor = op('pow', base, n ^ P.SIGN if case['op'] == 'pv' else n)
    if case['op'] == 'pv':
        first = op('divide', op('multiply', amount, op('subtract', ONE, factor)), r)
        return op('add', first, op('multiply', other, factor))
    first = op('multiply', other, factor)
    second = op('divide', op('multiply', amount, op('subtract', factor, ONE)), r)
    return op('add', first, second)


def reference(case):
    exact = real_value(case)
    rounded = P.nearest(exact)
    ideal = IdealGraph()
    value = ordered(case, ideal)
    return {'id': case['id'], 'exact_real': fraction(exact), 'whole_formula_rn': encoded(rounded),
            'whole_formula_reporting': report(rounded, case['places']),
            'ideal_power_ordered_graph': {'raw': encoded(value), 'reporting': report(value, case['places']), 'trace': ideal.rows}}
