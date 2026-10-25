"""Known-answer precision controls and unchanged portable commands, not a tier claim."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from uwmd_metrics import _precision,verify_stated_metrics
from uwmd_calc_errors import CalcError
from uwmd_reader import parse

ROOT=Path(__file__).resolve().parents[2]

class MetricTests(unittest.TestCase):
    def test_original_token_precision(self):
        for token,value,places in [('1.20',1.2,2),('1.200e-2',.012,5),('1e3',1000,0)]:
            self.assertEqual(_precision(token,value),places)
        for token,value in [(None,1),('1.20',1.3),('NaN',1)]:
            with self.assertRaises(CalcError): _precision(token,value)
    def test_every_home_and_unbound_lookalike(self):
        source=b'''---
uw_version: "3.0"
asset_class: multifamily
quick_metrics:
  cap_rate: 0.05
---
```json uw:section=noi_model
{"net_operating_income":50}
```
```json uw:section=valuation
{"purchase_price":1000,"going_in_cap_rate":0.06,"cap_rate_trailing":0.07}
```
'''
        doc=parse(source)
        report=verify_stated_metrics(doc)
        self.assertEqual(report['counts'],dict(verified=1,failed=1,unverifiable=0))
        self.assertEqual({e['path'] for e in report['evidence']},{'quick_metrics.cap_rate','valuation.going_in_cap_rate'})
        self.assertEqual(doc.source.raw,source)
    def test_actual_unchanged_portable_cases_without_manifest_override(self):
        spec=importlib.util.spec_from_file_location('python_verifier_case_driver',ROOT/'conformance/runner/runner.py')
        driver=importlib.util.module_from_spec(spec); spec.loader.exec_module(driver)
        impl=[sys.executable,'-B',str(ROOT/'implementations/python/uwmd.py')]
        total=0
        for path in sorted((ROOT/'conformance/runner/cases').glob('*.case.json')):
            case=json.loads(path.read_text(encoding='utf8'))
            if case['command'] not in ('verify-metrics','verify-cash-flows','verify-capital-stack','verify-lease-up','verify-waterfall'): continue
            total+=1
            with self.subTest(case=case['id']):
                _,problems=driver.run_case(impl,case,60)
                self.assertEqual(problems,[])
        self.assertGreater(total,0)
