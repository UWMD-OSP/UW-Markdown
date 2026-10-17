"""Independent Python candidate NPER composition, not mathematical expected answers."""
import importlib.util
import json
import platform
import sys
from pathlib import Path
from reference import P, encoded, report, reference
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('nper_candidate_raw', HERE.parent / 'python-fdlibm/kernel.py')
raw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(raw)


def evaluate(case):
    rows = []
    def emit(kind, **fields): rows.append({'kind': kind, **fields})
    def call(op, *args):
        if op == 'multiply': value = args[0] * args[1]
        elif op == 'subtract': value = args[0] - args[1]
        elif op == 'add': value = args[0] + args[1]
        elif op == 'divide': value = raw.divide(*args)
        elif op == 'log': value = raw.log(args[0])
        else: raise ValueError(op)
        emit('operation', op=op, args=[encoded(raw.word(arg)) for arg in args], result=encoded(raw.word(value)))
        return value
    r, payment, pv, fv = [raw.from_bits(word) for word in case['args']]
    emit('guard', name='zero_rate', value=r == 0)
    result = None
    if r == 0:
        emit('guard', name='zero_payment', value=payment == 0)
        if payment == 0: result = {'status': 'refused', 'code': 'CALC-TYPE-001', 'reason': 'zero_payment'}
        else: value = call('divide', call('subtract', pv, fv), payment)
    else:
        num = call('subtract', payment, call('multiply', fv, r))
        den = call('subtract', payment, call('multiply', pv, r))
        emit('guard', name='zero_denominator', value=den == 0)
        if den == 0: result = {'status': 'refused', 'code': 'CALC-TYPE-001', 'reason': 'zero_denominator'}
        else:
            ratio = call('divide', num, den)
            emit('guard', name='nonpositive_ratio', value=ratio <= 0)
            if ratio <= 0: result = {'status': 'refused', 'code': 'CALC-TYPE-001', 'reason': 'nonpositive_ratio'}
            else:
                numerator_log = call('log', call('divide', num, den))
                denominator_log = call('log', call('add', 1.0, r))
                value = call('divide', numerator_log, denominator_log)
    if result is None:
        bits = raw.word(value)
        result = {'status': 'returned', 'raw': encoded(bits), 'reporting': report(bits, case['places'])}
    return {'id': case['id'], 'result': result, 'trace': rows}


if __name__ == '__main__':
    destination = Path(sys.argv[1])
    if destination.exists(): raise FileExistsError(destination)
    raw.require_binary64()
    cases = json.loads((HERE / 'inputs.json').read_bytes())['cases']
    result = {'python': sys.version, 'platform': platform.platform(), 'architecture': platform.machine(),
        'references': [reference(case) for case in cases], 'candidate': [evaluate(case) for case in cases]}
    destination.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
