"""Whole-source, exact-copy and current-example dictionary controls beyond portable projections."""
import copy
import json
from pathlib import Path
import unittest
from uwmd_reader import parse
from uwmd_metrics import verify_stated_metrics
from uwmd_property_cash_flows import assemble_property_cash_flows,_bounds,AssemblyError

ROOT=Path(__file__).resolve().parents[2]

class NonportableVerifierTests(unittest.TestCase):
    def test_all_current_example_statements_match_the_existing_contract(self):
        expected=json.loads((ROOT/'conformance/metrics/expected.json').read_text(encoding='utf8'))
        for item in expected:
            with self.subTest(example=item['example']):
                source=next((ROOT/'examples').rglob(item['example'])).read_bytes()
                report=verify_stated_metrics(parse(source))
                self.assertEqual(report['counts'],item['counts'])
                actual={(e['id'],e['path']):e for e in report['evidence']}
                self.assertEqual(set(actual),{(e['id'],e['path']) for e in item['evidence']})
                for evidence in item['evidence']:
                    got=actual[(evidence['id'],evidence['path'])]
                    for field in ('state','computed','comparison','comparison_decimals','stated_decimals'):
                        if field in evidence:self.assertEqual(got.get(field),evidence[field])
    def assembly_fixture(self):
        root=ROOT/'conformance/property-cash-flow-assembly/valid-quarterly'
        return parse((root/'deal.uwx.md').read_bytes()),json.loads((root/'plan.json').read_text(encoding='utf8'))
    def test_assembly_snapshot_binding_cells_and_no_inferred_rows(self):
        document,plan=self.assembly_fixture();before=copy.deepcopy((document,plan))
        result=assemble_property_cash_flows(document,plan)
        self.assertEqual(document,before[0]);self.assertEqual(plan,before[1])
        self.assertIsNot(result['plan'],plan)
        self.assertEqual([b['output_row_index'] for b in result['bindings']],list(range(len(result['bindings']))))
        for row,binding in zip(result['series']['series'],result['bindings']):
            self.assertEqual((row['date'],row['amount']),(binding['date'],binding['amount']))
            self.assertEqual(len(binding['cells']),3 if binding['source_section']=='lease_up_schedule' else 1)
        for cell in result['cells']:
            if 'output_rows' in cell:self.assertEqual(cell['output_rows'],sorted(cell['output_rows']))
        result['plan']['assertions']['cash_amounts_only']=False
        self.assertTrue(plan['assertions']['cash_amounts_only'])
    def test_year_10000_is_only_an_unrepresentable_boundary(self):
        self.assertEqual(_bounds('9999-12'),('9999-12-01','10000-01-01'))
        self.assertEqual(_bounds('0099-Q4'),('0099-10-01','0100-01-01'))
