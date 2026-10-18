"""Independent Python composition of accepted graphs; NOT a financial verifier."""
import datetime
import importlib.util
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'python-fdlibm'))
import kernel as raw
spec = importlib.util.spec_from_file_location('trajectory_reporting_reference', HERE.parent / 'cash-graphs/cash_reference.py')
REPORT = importlib.util.module_from_spec(spec)
spec.loader.exec_module(REPORT)


def encoded(value):
    magnitude = raw.word(value) & 0x7fffffffffffffff
    return {'kind': 'nan' if magnitude > 0x7ff0000000000000 else 'infinity' if magnitude == 0x7ff0000000000000 else 'finite', 'bits': raw.to_bits(value)}


class Trace:
    def __init__(self):
        self.rows = []
    def emit(self, kind, **fields):
        self.rows.append({'sequence': len(self.rows), 'kind': kind, **fields})
    def operation(self, context, op, *args):
        if op == 'add': result = args[0] + args[1]
        elif op == 'subtract': result = args[0] - args[1]
        elif op == 'multiply': result = args[0] * args[1]
        elif op == 'divide': result = raw.divide(args[0], args[1])
        elif op == 'negate': result = -args[0]
        elif op == 'abs': result = raw.fabs(args[0])
        elif op == 'pow': result = raw.pow(*args)
        else: raise ValueError(op)
        self.emit('operation', context=context, op=op, args=[encoded(a) for a in args], result=encoded(result))
        return result


def finite(value):
    return raw.word(value) & 0x7fffffffffffffff < 0x7ff0000000000000


def exponents(case, trace):
    if 'dates' not in case:
        return None
    assert case['day_count'] == 'actual/365f'
    dates = [datetime.date.fromisoformat(s) for s in case['dates']]
    assert dates == sorted(dates) and len(dates) == len(case['flows'])
    values = []
    for i, date in enumerate(dates):
        days = (date - dates[0]).days
        trace.emit('calendar', row=i, anchor=case['dates'][0], date=case['dates'][i], actual_days=days, convention='actual/365f')
        values.append(trace.operation(f'calendar/{i}', 'divide', float(days), 365.0))
    return values


def cash_value(rate, flows, times, trace, evaluation):
    trace.emit('evaluation', evaluation=evaluation, rate=encoded(rate), association='periodic_divide' if times is None else 'dated_multiply_negative_power')
    total = 0.0
    for i, amount in enumerate(flows):
        context = f'{evaluation}/row/{i}'
        base = trace.operation(context, 'add', 1.0, rate)
        exponent = float(i) if times is None else trace.operation(context, 'negate', times[i])
        factor = trace.operation(context, 'pow', base, exponent)
        term = trace.operation(context, 'divide' if times is None else 'multiply', amount, factor)
        total = trace.operation(context, 'add', total, term)
    trace.emit('evaluation_result', evaluation=evaluation, value=encoded(total))
    return total


def solve(flows, times, trace):
    lo, hi = raw.from_bits('bfeff7ced916872b'), 10.0
    evaluate = lambda rate, label: cash_value(rate, flows, times, trace, label)
    flo, fhi = evaluate(lo, 'lo'), evaluate(hi, 'hi')
    # Preserve source short circuit: no product if either endpoint is nonfinite.
    product = trace.operation('bracket', 'multiply', flo, fhi) if finite(flo) and finite(fhi) else None
    failed = not finite(flo) or not finite(fhi) or product > 0.0
    trace.emit('bracket', lo=encoded(lo), hi=encoded(hi), flo=encoded(flo), fhi=encoded(fhi), product=None if product is None else encoded(product), refused=failed)
    if failed:
        trace.emit('exit', reason='no_bracket')
        return {'status': 'refused', 'code': 'CALC-IRR-DIVERGE' if times is None else 'CALC-XIRR-DIVERGE'}
    if flo == 0.0 or fhi == 0.0:
        result = lo if flo == 0.0 else hi
        trace.emit('exit', reason='lower_endpoint' if flo == 0.0 else 'upper_endpoint', value=encoded(result))
        return {'status': 'returned', 'raw': encoded(result)}
    for iteration in range(200):
        context = f'iteration/{iteration}'
        midpoint = trace.operation(context, 'divide', trace.operation(context, 'add', lo, hi), 2.0)
        residual = evaluate(midpoint, context)
        absolute = trace.operation(context, 'abs', residual)
        value_stop = absolute < 1e-9
        half_interval = None if value_stop else trace.operation(context, 'divide', trace.operation(context, 'subtract', hi, lo), 2.0)
        interval_stop = half_interval is not None and half_interval < 1e-12
        trace.emit('iteration', iteration=iteration, lo=encoded(lo), hi=encoded(hi), flo=encoded(flo), mid=encoded(midpoint), fmid=encoded(residual), value_tolerance=encoded(1e-9), interval_tolerance=encoded(1e-12), value_stop=value_stop, half_interval=None if half_interval is None else encoded(half_interval), interval_stop=interval_stop)
        if value_stop or interval_stop:
            trace.emit('exit', reason='value_tolerance' if value_stop else 'interval_tolerance', value=encoded(midpoint))
            return {'status': 'returned', 'raw': encoded(midpoint)}
        sign_product = trace.operation(context, 'multiply', flo, residual)
        retain_left = sign_product < 0.0
        if retain_left: hi = midpoint
        else: lo, flo = midpoint, residual
        trace.emit('update', iteration=iteration, product=encoded(sign_product), retain_left=retain_left, lo=encoded(lo), hi=encoded(hi), flo=encoded(flo))
    trace.emit('exit', reason='iteration_cap')
    return {'status': 'refused', 'code': 'CALC-IRR-DIVERGE' if times is None else 'CALC-XIRR-DIVERGE'}


def reporting(bits, places):
    value = raw.from_bits(bits)
    if not finite(value):
        return {'status': 'refused_nonfinite'}
    boundary = REPORT.quantize(int(bits, 16), places)
    return {'status': 'reported', 'bits': boundary['bits'], 'token': boundary['number_token'], 'coefficient': boundary['coefficient'], 'exponent': boundary['exponent'], 'shifted': boundary['shifted'], 'rounded_integer': boundary['rounded_integer']}


def evaluate(case):
    trace = Trace()
    times = exponents(case, trace)
    op = case['op']
    if op in ('irr', 'xirr'):
        result = solve([raw.from_bits(s) for s in case['flows']], times, trace)
    elif op in ('npv', 'xnpv'):
        rate = raw.from_bits(case['rate'])
        if op == 'xnpv' and (not finite(rate) or rate <= -1):
            result = {'status': 'refused', 'code': 'CALC-TYPE-001'}
        else:
            value = cash_value(rate, [raw.from_bits(s) for s in case['flows']], times, trace, 'direct')
            result = {'status': 'returned', 'raw': encoded(value)}
    elif op == 'pmt':
        rate, n, pv = [raw.from_bits(s) for s in case['args']]
        if n == 0:
            result = {'status': 'refused', 'code': 'CALC-TYPE-001'}
        else:
            if rate == 0:
                trace.emit('branch', name='pmt_zero_rate')
                value = trace.operation('pmt', 'divide', pv, n)
            else:
                numerator = trace.operation('pmt', 'multiply', pv, rate)
                base = trace.operation('pmt', 'add', 1.0, rate)
                negative_n = trace.operation('pmt', 'negate', n)
                factor = trace.operation('pmt', 'pow', base, negative_n)
                denominator = trace.operation('pmt', 'subtract', 1.0, factor)
                value = trace.operation('pmt', 'divide', numerator, denominator)
            result = {'status': 'returned', 'raw': encoded(value)}
    else: raise ValueError(op)
    if result['status'] == 'returned': result['reporting'] = reporting(result['raw']['bits'], case['places'])
    return {'id': case['id'], 'op': op, 'result': result, 'trace': trace.rows}
