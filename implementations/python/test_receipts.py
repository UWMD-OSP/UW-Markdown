"""Nonportable Receipt5 ordering, supplied backend and immutable-input controls."""
import copy
import json
from pathlib import Path
from unittest.mock import patch
import unittest
from uwmd_receipts import verify_receipt,_hash,ReceiptError

ROOT=Path(__file__).resolve().parents[2]

class ReceiptTests(unittest.TestCase):
    def test_cli_indeterminate_receipt_is_nonzero_and_preserves_json(self):
        import subprocess
        import sys
        directory = ROOT / 'conformance/receipts/verify/14-dictionary-packless-clean'
        run = subprocess.run([sys.executable, str(ROOT / 'implementations/python/uwmd.py'),
            'verify-receipt', str(directory / 'receipt.json'), str(directory / 'deal.uwx.md'), '--json'],
            capture_output=True, text=True, encoding='utf8', check=False)
        self.assertEqual(run.returncode, 3, run.stderr)
        report = json.loads(run.stdout)
        self.assertEqual(report['verdict'], 'unverifiable')
        self.assertIn('RCP-05', [issue['code'] for issue in report['issues']])

    def fixture(self,name='14-dictionary-packless-clean'):
        root=ROOT/'conformance/receipts/verify'/name
        return json.loads((root/'receipt.json').read_text(encoding='utf8')),(root/'deal.uwx.md').read_bytes()
    def test_authentication_before_financial_refusal_and_exactly_once(self):
        receipt,source=self.fixture('21-dictionary-packless-refusal')
        receipt['signature']=dict(algorithm='test-only',key_id='synthetic-key',value='synthetic-signature')
        calls=[]
        def backend(signature,payload):calls.append((signature,payload));return False
        with patch('uwmd_receipts.evaluate_expression',side_effect=AssertionError('Finance ran before authentication')):
            result=verify_receipt(receipt,source,filename='deal.uwx.md',signature_verifier=backend)
        self.assertEqual([i['code'] for i in result['issues']],['RCP-01'])
        self.assertNotIn('recomputed',result);self.assertEqual(len(calls),1)
        result=verify_receipt(receipt,source,filename='deal.uwx.md',signature_verifier=lambda *args:True)
        self.assertEqual(result['verdict'],'failed');self.assertEqual(result['recomputed'],[])
    def test_actual_engine_identity_pair_controls_finite_blame(self):
        receipt,source=self.fixture('15-dictionary-packless-wrong-value')
        other=verify_receipt(receipt,source,filename='deal.uwx.md')
        same=verify_receipt(receipt,source,filename='deal.uwx.md',engine=receipt['computation']['engine'],engine_version=receipt['computation']['engine_version'])
        self.assertEqual(other['verdict'],'unverifiable');self.assertEqual(other['issues'][0]['code'],'RCP-07')
        self.assertEqual(same['verdict'],'failed');self.assertNotIn('RCP-07',[i['code'] for i in same['issues']])
    def test_snapshot_and_backend_exceptions_are_not_authentication_failures(self):
        receipt,source=self.fixture();receipt['signature']=dict(algorithm='test-only',key_id='synthetic-key',value='synthetic-signature')
        original=copy.deepcopy(receipt)
        def backend(*args):receipt['computation']['results'][0]['value']=999;return True
        result=verify_receipt(receipt,source,filename='deal.uwx.md',signature_verifier=backend)
        self.assertEqual(result['recomputed'][0]['value'],original['computation']['results'][0]['value'])
        def broken(*args):raise RuntimeError('synthetic backend failure')
        with self.assertRaises(RuntimeError):verify_receipt(original,source,filename='deal.uwx.md',signature_verifier=broken)
    def test_unknown_referenced_input_is_never_ignored_and_digest_is_independent(self):
        receipt,source=self.fixture();receipt['inputs_provenance']=[dict(source='unknown',document_id='synthetic-input',digest='sha256:'+'0'*64)]
        result=verify_receipt(receipt,source,filename='deal.uwx.md',inputs={'synthetic-input':'sha256:'+'0'*64})
        self.assertEqual([i['code'] for i in result['issues']],['RCP-11','RCP-05'])
        receipt.pop('inputs_provenance');receipt['computation']['results_digest']='sha256:'+'0'*64
        result=verify_receipt(receipt,source,filename='deal.uwx.md')
        self.assertEqual([i['code'] for i in result['issues']],['RCP-04'])

    def test_raw_size_selector_is_not_a_receipt_calculation_id(self):
        receipt,source=self.fixture()
        receipt['computation']['results']=[dict(calc_id='total_units',value=77,unit='units',computed=True)]
        receipt['computation']['results_digest']=_hash(receipt['computation']['results'])
        report=verify_receipt(receipt,source,filename='deal.uwx.md')
        self.assertEqual([i['code'] for i in report['issues']],['RCP-05'])
        self.assertEqual(report['recomputed'],[])
