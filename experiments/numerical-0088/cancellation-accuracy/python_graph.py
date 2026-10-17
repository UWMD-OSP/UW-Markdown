"""Candidate composition using independent pinned Python kernel, not an oracle."""
import importlib.util
import json
import platform
import sys
from pathlib import Path
from reference import P, encoded, ordered, report, reference, fraction, real_value
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cancellation_python_candidate', HERE.parent / 'python-fdlibm/kernel.py')
raw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(raw)


class Graph:
    def __init__(self):
        self.rows = []

    def operation(self, op, *args):
        values = [raw.from_bits(P.hexword(a)) for a in args]
        a, b = values
        if op == 'pow': value = raw.pow(a, b)
        elif op == 'add': value = a + b
        elif op == 'subtract': value = a - b
        elif op == 'multiply': value = a * b
        elif op == 'divide': value = raw.divide(a, b)
        else: raise ValueError(op)
        bits = raw.word(value)
        self.rows.append({'op': op, 'args': [encoded(a) for a in args], 'result': encoded(bits)})
        return bits


def observe(case):
    graph = Graph()
    bits = ordered(case, graph)
    real = real_value(case)
    return {'id': case['id'], 'raw': encoded(bits), 'reporting': report(bits, case['places']),
            'absolute_real_error': fraction(abs(P.rational(bits) - real)) if P.finite(bits) else None,
            'relative_real_error': fraction(abs(P.rational(bits) - real) / abs(real)) if P.finite(bits) and real else None,
            'trace': graph.rows}


if __name__ == '__main__':
    destination = Path(sys.argv[1])
    if destination.exists(): raise FileExistsError(destination)
    raw.require_binary64()
    inputs = json.loads((HERE / 'inputs.json').read_bytes())
    result = {'python': sys.version, 'platform': platform.platform(), 'architecture': platform.machine(),
              'references': [reference(case) for case in inputs['cases']], 'candidate': [observe(case) for case in inputs['cases']]}
    destination.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
