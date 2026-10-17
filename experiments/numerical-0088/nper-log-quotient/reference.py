"""Independent rational log-interval/quotient certificates, not an NPER implementation.

No float/Decimal/host transcendental/candidate import. Undefined real formulas
are classified independently from actual builtin return/refusal semantics.
"""
from fractions import Fraction
from functools import lru_cache
import importlib.util
from pathlib import Path
HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, HERE.parent / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


M = load('nper_exact_log_bounds', 'pinned-fdlibm/math_reference.py')
P = M.P
REPORT = load('nper_decimal_reporting', 'cash-graphs/cash_reference.py')
NAN = 0x7ff8000000000000


def encoded(bits):
    magnitude = bits & (P.SIGN - 1)
    return {'kind': 'nan' if magnitude > P.INF else 'infinity' if magnitude == P.INF else 'finite', 'bits': P.hexword(bits)}


def exact(value):
    return {'numerator_hex': hex(value.numerator), 'denominator_hex': hex(value.denominator)}


def interval_divide(a, b):
    assert not b[0] <= 0 <= b[1], 'Denominator interval must exclude zero'
    values = [x / y for x in a for y in b]
    return min(values), max(values)


def report(bits, places):
    if not P.finite(bits): return {'status': 'refused_nonfinite'}
    result = REPORT.quantize(bits, places)
    return {'status': 'reported', 'bits': result['bits'], 'token': result['number_token']}


@lru_cache(maxsize=128)
def rounded_log(value):
    assert value > 0
    for terms in (80, 128, 256):
        lower, upper, normalization = M.log_interval(value, terms)
        low, high = P.nearest(lower), P.nearest(upper)
        if low == high:
            return low, {'method': 'atanh-series-geometric-tail', 'terms': terms, 'normalization_exponent': normalization,
                         'input': exact(value), 'lower': exact(lower), 'upper': exact(upper), 'rounded_bits': P.hexword(low)}
    raise ArithmeticError('Fixed research log budget cannot certify a unique word')


def mathematical(case):
    r, payment, pv, fv = [P.rational(P.word(word)) for word in case['args']]
    if r == 0:
        if payment == 0: return {'status': 'undefined_zero_rate_zero_payment'}
        value = (pv - fv) / payment
        bits = P.nearest(value)
        return {'status': 'certified', 'raw': encoded(bits), 'reporting': report(bits, case['places']), 'proof': {'method': 'exact-zero-rate-rational', 'value': exact(value)}}
    base = 1 + r
    num, den = payment - fv * r, payment - pv * r
    if base <= 0: return {'status': 'undefined_real_log_base', 'base': exact(base)}
    if den == 0: return {'status': 'undefined_real_ratio', 'denominator': exact(den)}
    ratio = num / den
    if ratio <= 0: return {'status': 'undefined_real_log_ratio', 'ratio': exact(ratio)}
    for terms in (80, 128, 256):
        a, b, _ = M.log_interval(ratio, terms)
        c, d, _ = M.log_interval(base, terms)
        if c <= 0 <= d: continue
        lower, upper = interval_divide((a, b), (c, d))
        low, high = P.nearest(lower), P.nearest(upper)
        if low == high:
            return {'status': 'certified', 'raw': encoded(low), 'reporting': report(low, case['places']),
                    'proof': {'method': 'exact-input-rational-log-interval-quotient', 'terms': terms,
                        'ratio': exact(ratio), 'base': exact(base), 'log_ratio_bounds': [exact(a), exact(b)],
                        'log_base_bounds': [exact(c), exact(d)], 'quotient_bounds': [exact(lower), exact(upper)]}}
    raise ArithmeticError('Fixed research quotient budget cannot certify a unique word')


class Ideal:
    """Ideal correctly rounded log on already-rounded operands; not MPFR execution."""
    def __init__(self): self.trace = []
    def emit(self, kind, **fields): self.trace.append({'kind': kind, **fields})
    def operation(self, op, *args):
        proof = None
        if op == 'log':
            bits = args[0]
            magnitude = bits & (P.SIGN - 1)
            if magnitude > P.INF or bits & P.SIGN and magnitude != 0: result = NAN
            elif magnitude == P.INF: result = P.INF
            elif magnitude == 0: result = P.INF | P.SIGN
            else: result, proof = rounded_log(P.rational(bits))
        elif op == 'divide' and any(not P.finite(bits) for bits in args):
            a, b = [bits & (P.SIGN - 1) for bits in args]
            sign = (args[0] ^ args[1]) & P.SIGN
            result = NAN if a > P.INF or b > P.INF or a == b == P.INF else sign if b == P.INF else P.INF | sign
        else:
            a, b = [P.rational(bits) for bits in args]
            sign = (args[0] ^ args[1]) & P.SIGN
            if op == 'subtract': result = P.nearest(a - b)
            elif op == 'add': result = P.nearest(a + b)
            elif op == 'multiply': result = P.nearest(a * b, negative_zero=bool(sign) and (a == 0 or b == 0))
            elif op == 'divide': result = NAN if a == b == 0 else P.INF | sign if b == 0 else P.nearest(a / b, negative_zero=bool(sign) and a == 0)
            else: raise ValueError(op)
        self.emit('operation', op=op, args=[encoded(bits) for bits in args], result=encoded(result), **({'proof': proof} if proof else {}))
        return result


def ordered(case, graph):
    r, payment, pv, fv = [P.word(word) for word in case['args']]
    op = graph.operation
    zero_rate = r & (P.SIGN - 1) == 0
    graph.emit('guard', name='zero_rate', value=zero_rate)
    if zero_rate:
        zero_payment = payment & (P.SIGN - 1) == 0
        graph.emit('guard', name='zero_payment', value=zero_payment)
        if zero_payment: return {'status': 'refused', 'code': 'CALC-TYPE-001', 'reason': 'zero_payment'}
        return {'status': 'returned', 'raw': encoded(op('divide', op('subtract', pv, fv), payment))}
    num = op('subtract', payment, op('multiply', fv, r))
    den = op('subtract', payment, op('multiply', pv, r))
    zero_den = den & (P.SIGN - 1) == 0
    graph.emit('guard', name='zero_denominator', value=zero_den)
    if zero_den: return {'status': 'refused', 'code': 'CALC-TYPE-001', 'reason': 'zero_denominator'}
    ratio_guard = op('divide', num, den)
    # Every fixed guard ratio is finite. No approximate sign test is introduced.
    failed = P.rational(ratio_guard) <= 0
    graph.emit('guard', name='nonpositive_ratio', value=failed)
    if failed: return {'status': 'refused', 'code': 'CALC-TYPE-001', 'reason': 'nonpositive_ratio'}
    ratio = op('divide', num, den)  # Source repeats this division after its guard.
    numerator_log = op('log', ratio)  # JS evaluates numerator before denominator.
    denominator_log = op('log', op('add', P.ONE, r))
    return {'status': 'returned', 'raw': encoded(op('divide', numerator_log, denominator_log))}


def reference(case):
    graph = Ideal()
    result = ordered(case, graph)
    if result['status'] == 'returned': result['reporting'] = report(P.word(result['raw']['bits']), case['places'])
    return {'id': case['id'], 'mathematical': mathematical(case), 'ideal_log_graph': {'result': result, 'trace': graph.trace}}
