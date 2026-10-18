"""Exact ownership of accepted LU-01/LU-03 admission findings."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_validation import ROOT, validate, well_formed
from test_validation_cli import property_source
from uwmd import _validation_response, main
from uwmd_reader import parse
from uwmd_validation_core import Ledger
from uwmd_validation_lease_up import lease_up_rules, _lease_up_assessment


def payload(**changes):
    return dict(model_type="absorption_curve", period_granularity="monthly",
                schedule=[dict(period="2026-01")]) | changes


def source(value):
    return property_source() + well_formed("lease_up_schedule", **value)


def local(report):
    return report["section_assessment"]["lease_up_schedule"]


class LeaseUpOwnershipTests(unittest.TestCase):
    def assess(self, value):
        raw = source(value); document = parse(raw); before = copy.deepcopy(document)
        report = validate(document)
        self.assertEqual(document, before); self.assertEqual(document.source.raw, raw)
        return document, report

    def test_registered_nonempty_schedule_conditions_have_normal_invalid_transport(self):
        for rows in (None, False, {}, "", []):
            _, report = self.assess(payload(schedule=rows))
            self.assertEqual(local(report)["shape_findings"], [])
            self.assertEqual([(i["code"], i["field"]) for i in report["errors"]], [("LU-03", "schedule")])
            response, status = _validation_response(report)
            self.assertEqual((status, response["overall_status"]), (1, "errors"))
            self.assertNotIn("error", response)
        value = payload(); del value["schedule"]
        self.assertEqual(local(self.assess(value)[1])["shape_findings"], [])

    def test_registered_cadence_period_and_target_grammar_owns_only_its_local_predicate(self):
        cases = [(payload(period_granularity="yearly"), "period_granularity"),
                 (payload(schedule=[{}]), "schedule[0].period"),
                 (payload(schedule=[dict(period=False)]), "schedule[0].period"),
                 (payload(schedule=[dict(period="2026-99")]), "schedule[0].period"),
                 (payload(stabilization_target=[]), "stabilization_target")]
        for value, field in cases:
            with self.subTest(field=field, value=value):
                _, report = self.assess(value)
                self.assertEqual(local(report)["shape_findings"], [])
                self.assertIn(("LU-01", field), [(i["code"], i["field"]) for i in report["errors"]])
                self.assertEqual([f["registered_code"] for f in local(report)["handled_shape_findings"]], ["LU-01"])
        _, report = self.assess(payload(stabilization_target=None))
        self.assertEqual(report["errors"], [])

    def test_unallocated_model_numeric_container_and_unknown_data_remain_local(self):
        cases = [(payload(model_type="unknown"), "model_type"),
                 (payload(schedule=[None]), "schedule[0]"),
                 (payload(assumptions=dict(monthly_turnover_rate="bad")), "assumptions.monthly_turnover_rate"),
                 (payload(stabilized_summary=[]), "stabilized_summary"),
                 (payload(unknown=1), "unknown")]
        for value, field in cases:
            value["stabilization_target"] = False  # An independent allocated LU-01 is insufficient.
            _, report = self.assess(value)
            self.assertIn(field, [f["field"] for f in local(report)["shape_findings"]])
            response, status = _validation_response(report)
            self.assertEqual(status, 1)
            self.assertIn("partial_validation_result", response)
            self.assertNotIn("code", response["error"])

    def test_actual_owner_requires_code_severity_section_field_current_physical_reference(self):
        document = parse(source(payload(schedule=[])))
        ledger = Ledger(document); lease_up_rules(ledger)
        for kind in ("missing", "code", "severity", "section", "field", "index", "bool_index"):
            issues = copy.deepcopy(ledger.issues)
            owner = next(i for i in issues if i["code"] == "LU-03")
            if kind == "missing": issues.remove(owner)
            if kind == "code": owner["code"] = "LU-01"
            if kind == "severity": owner["severity"] = "warning"
            if kind == "section": owner["section"] = "x_elsewhere"
            if kind == "field": owner["field"] = "model_type"
            if kind == "index": owner["context"]["block_index"] = 2
            if kind == "bool_index": owner["context"]["block_index"] = True
            self.assertEqual([f["field"] for f in _lease_up_assessment(document, issues)["shape_findings"]], ["schedule"])
        # Same field/current predicate cannot consume a newly unallocated condition.
        with patch("uwmd_validation_lease_up._payload_shape",
                   return_value=[dict(field="schedule", message="different requirement", _owner_predicate=None)]):
            self.assertEqual([f["field"] for f in _lease_up_assessment(document, ledger.issues)["shape_findings"]],
                             ["schedule"])

    def test_wrong_current_peer_or_stale_predicate_never_supplies_an_owner(self):
        first = well_formed("lease_up_schedule", **payload(schedule=[])).replace(
            b"uw:section=lease_up_schedule", b"uw:section=lease_up_schedule variant=a", 1)
        second = first.replace(b"variant=a", b"variant=b", 1)
        document = parse(property_source() + first + second)
        ledger = Ledger(document); lease_up_rules(ledger)
        assessment = _lease_up_assessment(document, ledger.issues[1:])
        self.assertEqual([f["context"]["block_index"] for f in assessment["shape_findings"]], [1])
        self.assertEqual([f["context"]["block_index"] for f in assessment["handled_shape_findings"]], [2])
        # The same retained error cannot cover a current different predicate.
        changed = copy.deepcopy(document)
        changed.source.blocks[1].parsed.value["schedule"] = [dict(period="2026-01", rent_revenue="bad")]
        assessment = _lease_up_assessment(changed, ledger.issues)
        self.assertEqual([f["field"] for f in assessment["shape_findings"]], ["schedule[0].rent_revenue"])

    def test_native_empty_schedule_is_normal_invalid_with_source_and_expectations_unchanged(self):
        folder = ROOT / "conformance/lease-up/reject-empty-schedule"
        raw = (folder / "deal.uwx.md").read_bytes()
        baseline = (folder / "expected.json").read_bytes()
        document = parse(raw); before = copy.deepcopy(document)
        report = validate(document)
        self.assertEqual(local(report)["shape_findings"], [])
        response, status = _validation_response(report)
        self.assertEqual(status, 1)
        self.assertNotIn("error", response)
        self.assertIn(("LU-03", "schedule"), [(i["code"], i["field"]) for i in response["errors"]])
        self.assertEqual(document, before)
        self.assertEqual((folder / "deal.uwx.md").read_bytes(), raw)
        self.assertEqual((folder / "expected.json").read_bytes(), baseline)

    def test_real_cli_source_errors_success_and_partial_refusals_preserve_wire_and_bytes(self):
        invalid = payload(schedule=[])
        cases = [(payload(), 0, False), (invalid, 1, False),
                 (payload(schedule=[dict(period="bad")]), 1, False),
                 (payload(stabilization_target=False), 1, False),
                 (payload(schedule=[], model_type="unknown"), 1, True)]
        with tempfile.TemporaryDirectory(prefix="uwmd-python-lu-owner-") as folder:
            path = Path(folder) / "input.uwx.md"
            for value, exit_code, partial in cases:
                raw = source(value); path.write_bytes(raw)
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "validate", str(path), "--json"], capture_output=True, encoding="utf-8", timeout=60)
                report = json.loads(process.stdout)
                self.assertEqual(process.stderr, "")
                self.assertEqual(process.returncode, exit_code)
                self.assertEqual(path.read_bytes(), raw)
                self.assertEqual("partial_validation_result" in report, partial)
                result = report["partial_validation_result"] if partial else report
                for key, severity in (("errors", "error"), ("warnings", "warning"), ("info", "info")):
                    self.assertEqual(result[key], [i for i in result["issues"] if i["severity"] == severity])
                if partial: self.assertNotIn("code", report["error"])
                else: self.assertNotIn("error", report)
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse"])


if __name__ == "__main__":
    unittest.main()
