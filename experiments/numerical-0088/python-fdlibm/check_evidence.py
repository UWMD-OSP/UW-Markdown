"""Compare independent Python computation with READ-ONLY frozen evidence.

No JS process, compiler, host pow/log/exp/sqrt or expected-output generation.
"""
import argparse
import hashlib
import json
import platform
import sys
import subprocess
import zipfile
from pathlib import Path
from kernel import evaluate_record, require_binary64

HERE = Path(__file__).resolve().parent
LAB = HERE.parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_inputs():
    manifest = json.loads((HERE / 'evidence-inputs.json').read_bytes())
    for path, expected in manifest['files'].items():
        actual = sha((LAB / path).read_bytes())
        if actual != expected:
            raise ValueError('frozen evidence identity changed: ' + path)
    return manifest['files']


def measure():
    require_binary64()
    identities = verify_inputs()
    operands = json.loads((LAB / 'native-reference/inputs.json').read_bytes())['cases']
    actual = [evaluate_record(case) for case in operands]
    native_results = []
    for name in identities:
        if not name.endswith('.zip'):
            continue
        with zipfile.ZipFile(LAB / name) as archive:
            reference = json.loads(archive.read('results.json'))
        if len(reference) != len(actual):
            raise AssertionError('incomplete frozen reference stream')
        for row, expected in zip(actual, reference):
            if (row['id'], row['op']) != (expected['id'], expected['op']):
                raise AssertionError('reference identity/order mismatch')
            if expected['native_class'] == 'nan':
                equal = row['kind'] == 'nan'
            else:
                equal = row['kind'] != 'nan' and row['bits'] == expected['native_bits']
            if not equal:
                raise AssertionError({'archive': name, 'actual': row, 'frozen_native': expected})
        native_results.append({'archive': name, 'cases': len(actual), 'exact_non_nan_words': sum(r['kind'] != 'nan' for r in actual), 'nan_classes': sum(r['kind'] == 'nan' for r in actual)})
    math_inputs = json.loads((LAB / 'pinned-fdlibm/math-inputs.json').read_bytes())['cases']
    mathematics = json.loads((LAB / 'pinned-fdlibm/math-evidence.json').read_bytes())['cases']
    accuracy = []
    for operand, expected in zip(math_inputs, mathematics):
        if operand['id'] != expected['id']:
            raise AssertionError('mathematical reference identity/order mismatch')
        row = evaluate_record(operand)
        reference_word = expected['reference']['bits']
        accuracy.append({'id': row['id'], 'candidate_word': row['bits'], 'mathematical_word': reference_word, 'distance': str(int(row['bits'], 16) - int(reference_word, 16))})
    if len(math_inputs) != len(mathematics):
        raise AssertionError('incomplete mathematics stream')
    # Existing discrepancies are retained, not converted into accuracy passes.
    differences = [row for row in accuracy if row['candidate_word'] != row['mathematical_word']]
    result = {'status': 'UNACCEPTED independent Python source-reproduction and bounded accuracy observations',
              'python': sys.version, 'platform': platform.platform(), 'machine': platform.machine(),
              'checkout_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=HERE, text=True).strip(),
              'checkout_tree': subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=HERE, text=True).strip(),
              'input_hashes': identities, 'implementation_hashes': {p.name: sha(p.read_bytes()) for p in sorted(HERE.glob('*.py'))},
              'native_comparisons': native_results, 'math_cases': len(accuracy),
              'mathematical_word_agreements': len(accuracy) - len(differences), 'mathematical_disagreements': differences,
              'raw_results_sha256': sha((json.dumps(actual, sort_keys=True) + '\n').encode()),
              'accuracy': accuracy}
    verify_inputs()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = measure()
    if args.output:
        # New observations only: never overwrite any existing frozen answer.
        with args.output.open('x', encoding='utf-8', newline='\n') as stream:
            json.dump(result, stream, indent=2)
            stream.write('\n')
    print(json.dumps({key: result[key] for key in ('native_comparisons', 'math_cases', 'mathematical_word_agreements', 'mathematical_disagreements')}))


if __name__ == '__main__':
    main()
