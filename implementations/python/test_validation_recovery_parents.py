"""Accepted REC-02 container ownership in the developing validate operation."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_validation import ROOT, validate, well_formed
from test_validation_cli import property_source
from uwmd import main, _validation_response
from uwmd_reader import parse
from uwmd_validation_core import Ledger
from uwmd_validation_lease import lease_rules
from uwmd_validation_optional_shapes import optional_shape_assessments


def source(terms, *, variant=None):
    raw = well_formed("rent_roll", tenants=[dict(recovery_terms=terms)])
    if variant is not None:
        raw = raw.replace(b"uw:section=rent_roll", ("uw:section=rent_roll variant=" + variant).encode(), 1)
        raw = raw.replace(b'{"_meta":', b'{"_role": "detail", "_meta":', 1)
    return property_source() + raw


class RecoveryParentAdmissionTests(unittest.TestCase):
    def assess(self, raw):
        document = parse(raw); before = copy.deepcopy(document)
        report = validate(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        return document, report

    def test_nonobject_terms_uses_existing_rec02_without_duplicate_local_refusal(self):
        for value in (False, True, 0, 1, "", "net", [], [dict(method="net")]):
            with self.subTest(value=value):
                _, report = self.assess(source(value))
                self.assertEqual([(i["code"], i["field"]) for i in report["errors"]],
                                 [("REC-02", "tenants[0].recovery_terms")])
                assessment = report["section_assessment"]["lease_recoveries"]
                self.assertEqual(assessment["shape_findings"], [])
                self.assertEqual([(f["field"], f["registered_code"]) for f in assessment["handled_shape_findings"]],
                                 [("tenants[0].recovery_terms", "REC-02")])
                response, status = _validation_response(report)
                self.assertEqual((status, response["overall_status"]), (1, "errors"))
                self.assertNotIn("error", response)

    def test_nonobject_nonnull_cap_gets_its_own_error_without_method_inference(self):
        for value in (False, True, 0, 1, "", "cumulative", [], [{}]):
            for method in (False, True):
                with self.subTest(value=value, method=method):
                    terms = dict(cap=value)
                    if method: terms["method"] = "net"
                    _, report = self.assess(source(terms))
                    self.assertEqual([(i["code"], i["field"]) for i in report["errors"]],
                                     [("REC-02", "tenants[0].recovery_terms.cap")])
                    self.assertEqual(report["section_assessment"]["lease_recoveries"]["shape_findings"], [])

    def test_absence_null_empty_and_lone_cap_keep_accepted_g1_boundaries(self):
        for value in (None, {}, dict(cap=None), dict(cap={}), dict(cap=dict(pct=.03)),
                      dict(method="net", cap=None)):
            with self.subTest(value=value):
                _, report = self.assess(source(value))
                self.assertEqual(report["errors"], [])
                self.assertEqual(report["section_assessment"]["lease_recoveries"]["shape_findings"], [])
                self.assertEqual(_validation_response(report)[1], 0)

    def test_0096_siblings_are_owned_independently_from_parent_errors(self):
        for terms, expected in (
                (dict(method="net", cap=[], admin_fee_pct="bad"),
                 ["tenants[0].recovery_terms.admin_fee_pct"]),
                (dict(method="net", cap=dict(unknown=0)),
                 ["tenants[0].recovery_terms.cap.unknown"]),
                (dict(method="unknown", cap=dict(over="other")),
                 ["tenants[0].recovery_terms.method", "tenants[0].recovery_terms.cap.over"])):
            with self.subTest(terms=terms):
                _, report = self.assess(source(terms))
                assessment=report["section_assessment"]["lease_recoveries"]
                self.assertEqual(assessment["shape_findings"], [])
                handled={f["field"]:f["registered_code"] for f in assessment["handled_shape_findings"]}
                for field in expected:
                    self.assertEqual(handled[field], "REC-02" if field.endswith(".method") else "REC-11")
                response, status = _validation_response(report)
                self.assertEqual(status, 1)
                self.assertNotIn("error", response)
                self.assertNotIn("partial_validation_result", response)

    def test_consumption_requires_actual_error_code_severity_field_section_and_physical_owner(self):
        for terms, field in ((3, "tenants[0].recovery_terms"),
                             (dict(method="net", cap=[]), "tenants[0].recovery_terms.cap")):
            document = parse(source(terms))
            ledger = Ledger(document); represented = lease_rules(ledger)
            before = copy.deepcopy(document)
            for kind in ("none", "code", "severity", "field", "section", "index", "bool_index", "mapping"):
                with self.subTest(field=field, kind=kind):
                    issues = copy.deepcopy(ledger.issues); owners = dict(represented)
                    owner = issues[0]
                    if kind == "none": issues.clear()
                    if kind == "code": owner["code"] = "REC-01"
                    if kind == "severity": owner["severity"] = "warning"
                    if kind == "field": owner["field"] += ".other"
                    if kind == "section": owner["section"] = "x_other"
                    if kind == "index": owner["context"]["block_index"] = 2
                    if kind == "bool_index": owner["context"]["block_index"] = True
                    if kind == "mapping": owners.clear()
                    assessment = optional_shape_assessments(document,
                        registered_recovery_shapes=owners,
                        registered_recovery_issues=issues)["lease_recoveries"]
                    self.assertEqual([f["field"] for f in assessment["shape_findings"]], [field])
            self.assertEqual(document, before)

    def test_same_field_on_another_current_peer_cannot_supply_parent_ownership(self):
        alpha = source(dict(cap=[]), variant="alpha")
        beta = source(dict(cap=[]), variant="beta")[len(property_source()):]
        document = parse(alpha + beta)
        ledger = Ledger(document); represented = lease_rules(ledger)
        self.assertEqual([i["context"]["block_index"] for i in ledger.issues], [1, 2])
        assessment = optional_shape_assessments(document,
            registered_recovery_shapes=represented,
            registered_recovery_issues=ledger.issues[1:])["lease_recoveries"]
        self.assertEqual([(f["context"]["block_index"], f["field"]) for f in assessment["shape_findings"]],
                         [(1, "tenants[0].recovery_terms.cap")])
        self.assertEqual([f["context"]["block_index"] for f in assessment["handled_shape_findings"]], [2])
        report = validate(document)
        self.assertEqual(report["section_assessment"]["lease_recoveries"]["shape_findings"], [])
        report["errors"][0]["context"]["block_index"] = 999
        self.assertEqual(document.source.blocks[1].parsed.value["tenants"][0]["recovery_terms"], dict(cap=[]))

    def test_real_validate_cli_reports_parent_and_0096_sibling_normal_errors_and_exact_exit(self):
        cases = [(None, [], False), (dict(cap={}), [], False),
                 (3, ["tenants[0].recovery_terms"], False),
                 (dict(cap=[]), ["tenants[0].recovery_terms.cap"], False),
                 (dict(method="net", cap=[], admin_fee_pct="bad"),
                  ["tenants[0].recovery_terms.cap","tenants[0].recovery_terms.admin_fee_pct"], False)]
        with tempfile.TemporaryDirectory(prefix="uwmd-python-rec-parent-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for terms, expected, partial in cases:
                with self.subTest(terms=terms):
                    raw = source(terms); path.write_bytes(raw)
                    process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                        "validate", str(path), "--json"], capture_output=True, encoding="utf-8", timeout=60)
                    value = json.loads(process.stdout)
                    self.assertEqual(process.stderr, "")
                    self.assertEqual(process.returncode, int(bool(expected)))
                    self.assertEqual(path.read_bytes(), raw)
                    self.assertEqual("partial_validation_result" in value, partial)
                    result = value["partial_validation_result"] if partial else value
                    self.assertEqual([(i["code"],i["field"]) for i in result["errors"]],
                                     [("REC-11" if field.endswith(".admin_fee_pct") else "REC-02", field) for field in expected])
                    for key, severity in (("errors", "error"), ("warnings", "warning"), ("info", "info")):
                        self.assertEqual(result[key], [i for i in result["issues"] if i["severity"] == severity])
                    if partial: self.assertNotIn("code", value["error"])
                    else: self.assertNotIn("error", value)
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse", "validate", "calc-evaluate"])


if __name__ == "__main__":
    unittest.main()
