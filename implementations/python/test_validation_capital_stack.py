"""Independent CS field/multiplicity evidence in the developing validate API.

Format 4.24 and RFC0050 allocate these existing predicates. Sizing execution,
unallocated shape conditions and full validation capability remain separate.
"""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_validation import ROOT, validate, well_formed
from test_validation_cli import property_source
from uwmd import main
from uwmd_reader import parse


def tranche(**changes):
    return dict(id="senior", position=1, **{"class": "senior_debt"},
                amount=100, rate=0) | changes


def findings(report):
    return [(i["code"], i["section"], i["field"]) for i in report["issues"]
            if i["code"].startswith("CS-")]


def source(rows):
    return property_source() + well_formed("capital_stack", point_in_time="stabilization", tranches=rows)


class CapitalStackAdmissionTests(unittest.TestCase):
    def assess(self, raw):
        document = parse(raw)
        before = copy.deepcopy(document)
        report = validate(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        return document, report

    def test_each_required_member_reports_independently_in_reference_order(self):
        for body in ({}, dict(id="", position=False, **{"class": []}, amount=None),
                     dict(id=None, position=1.5, **{"class": "unknown"}, amount="100")):
            with self.subTest(body=body):
                _, report = self.assess(source([body]))
                self.assertEqual(findings(report), [
                    ("CS-01", "capital_stack", "tranches[0]." + field)
                    for field in ("id", "class", "position", "amount")])
        _, report = self.assess(source([tranche(position=True, amount=False)]))
        self.assertEqual(findings(report), [
            ("CS-01", "capital_stack", "tranches[0].position"),
            ("CS-01", "capital_stack", "tranches[0].amount")])

    def test_duplicate_id_and_position_are_independent_and_stack_local(self):
        rows = [tranche(), tranche(amount=0), tranche(id="third", position=1)]
        _, report = self.assess(source(rows))
        self.assertEqual(findings(report), [
            ("CS-01", "capital_stack", "tranches[1].id"),
            ("CS-01", "capital_stack", "tranches[1].position"),
            ("CS-01", "capital_stack", "tranches[2].position")])
        # The independent component stack may reuse the top-level identities.
        raw = source([tranche()]) + well_formed("components",
            retail=dict(component_class="retail", net_operating_income=1,
                        capital_stack=dict(point_in_time="stabilization", tranches=[tranche()])),
            office=dict(component_class="office", net_operating_income=1))
        self.assertEqual(findings(self.assess(raw)[1]), [])

    def test_component_field_prefix_and_independent_error_order(self):
        raw = property_source() + well_formed("components",
            retail=dict(component_class="retail", net_operating_income=1,
                        capital_stack=dict(point_in_time="stabilization", tranches=[tranche(position="1", amount=-1)])),
            office=dict(component_class="office", net_operating_income=1))
        self.assertEqual(findings(self.assess(raw)[1]), [
            ("CS-01", "components", "retail.capital_stack.tranches[0].position"),
            ("CS-01", "components", "retail.capital_stack.tranches[0].amount")])

    def test_split_component_findings_are_typed_independent_and_ordered(self):
        body = tranche(accrual="split", cash_rate=None, accrued_rate=False)
        self.assertEqual(findings(self.assess(source([body]))[1]), [
            ("CS-02b", "capital_stack", "tranches[0].accrual"),
            ("CS-02b", "capital_stack", "tranches[0].cash_rate"),
            ("CS-02b", "capital_stack", "tranches[0].accrued_rate")])
        body = tranche(**{"class": "preferred_equity"}, accrual="split")
        del body["rate"]
        self.assertEqual(findings(self.assess(source([body]))[1]), [
            ("CS-02", "capital_stack", "tranches[0].rate"),
            ("CS-02b", "capital_stack", "tranches[0].cash_rate"),
            ("CS-02b", "capital_stack", "tranches[0].accrued_rate")])
        body.update(cash_rate=0, accrued_rate=0)
        self.assertEqual(findings(self.assess(source([body]))[1]),
                         [("CS-02", "capital_stack", "tranches[0].rate")])
        body.update(rate=0.1)
        self.assertEqual(findings(self.assess(source([body]))[1]),
                         [("CS-02b", "capital_stack", "tranches[0].rate")])
        body = tranche(cash_rate=0)
        self.assertEqual(findings(self.assess(source([body]))[1]),
                         [("CS-02b", "capital_stack", "tranches[0].accrual")])

    def test_valid_boundary_terms_do_not_gain_financial_conventions(self):
        for kind in ("senior_debt", "mezzanine_debt", "preferred_equity",
                     "bridge", "seller_financing", "other_debt"):
            body = tranche(**{"class": kind}, rate=-0.01, position=1.0,
                           amount=0, term_months=None, io_months=0)
            self.assertEqual(findings(self.assess(source([body]))[1]), [])
        common = tranche(**{"class": "common_equity"}); del common["rate"]
        self.assertEqual(findings(self.assess(source([common]))[1]), [])
        pref = tranche(**{"class": "preferred_equity"}, accrual="split",
                       cash_rate=-0.01, accrued_rate=0.01)
        self.assertEqual(findings(self.assess(source([pref]))[1]), [])

    def test_current_physical_history_and_exact_peer_selection_are_unchanged(self):
        bad = well_formed("capital_stack", point_in_time="stabilization", tranches=[{}])
        good = well_formed("capital_stack", point_in_time="stabilization", tranches=[tranche()])
        # Ordinary singleton validation owns the latest current stack.
        self.assertEqual(findings(self.assess(property_source() + bad + good)[1]), [])
        historical = bad.replace(b"uw:section=capital_stack",
                                 b"uw:section=capital_stack superseded=true", 1)
        document, report = self.assess(property_source() + good + historical)
        self.assertEqual(findings(report), [])
        self.assertEqual(len(document.source.blocks), 3)
        def peer(raw, name):
            return raw.replace(b"uw:section=capital_stack",
                               ("uw:section=capital_stack variant=" + name).encode(), 1
                               ).replace(b'{"_meta":', b'{"_role": "detail", "_meta":', 1)
        # Both exact identity peers remain independently selected; latest alpha
        # supersedes its malformed predecessor without erasing its physical bytes.
        raw = property_source() + peer(bad, "alpha") + peer(good, "alpha") + peer(bad, "beta")
        document, report = self.assess(raw)
        self.assertEqual(findings(report), [
            ("CS-01", "capital_stack", "tranches[0]." + field)
            for field in ("id", "class", "position", "amount")])
        self.assertEqual(len(document.source.blocks), 4)

    def test_mutable_canonical_model_and_detached_results_preserve_source(self):
        raw = source([tranche()])
        document = parse(raw)
        document.source.blocks[-1].parsed.value["tranches"][0]["amount"] = "bad"
        before = copy.deepcopy(document)
        report = validate(document)
        self.assertEqual(findings(report), [("CS-01", "capital_stack", "tranches[0].amount")])
        report["errors"][-1]["field"] = "caller-change"
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        self.assertEqual(findings(validate(document)),
                         [("CS-01", "capital_stack", "tranches[0].amount")])

    def test_real_cli_reports_all_fields_partitions_exit_and_parse_only_discovery(self):
        cases = [
            (source([tranche()]), [], 0),
            (source([dict(id="", position=False, **{"class": "unknown"}, amount=None)]),
             [("CS-01", "capital_stack", "tranches[0]." + f)
              for f in ("id", "class", "position", "amount")], 1),
            (source([tranche(accrual="split")]),
             [("CS-02b", "capital_stack", "tranches[0]." + f)
              for f in ("accrual", "cash_rate", "accrued_rate")], 1),
        ]
        with tempfile.TemporaryDirectory(prefix="uwmd-python-cs-fields-") as folder:
            path = Path(folder) / "input.uwx.md"
            for raw, expected, status in cases:
                with self.subTest(expected=expected):
                    path.write_bytes(raw)
                    completed = subprocess.run(
                        [sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                         "validate", str(path), "--json"], capture_output=True,
                        encoding="utf-8", timeout=60)
                    report = json.loads(completed.stdout)
                    self.assertEqual(completed.stderr, "")
                    self.assertEqual(completed.returncode, status)
                    self.assertEqual(findings(report), expected)
                    self.assertNotIn("error", report)
                    for severity, member in (("error", "errors"), ("warning", "warnings"), ("info", "info")):
                        self.assertEqual(report[member], [i for i in report["issues"] if i["severity"] == severity])
                    self.assertEqual(set(report["stage_readiness"].values()), {True, False})
                    self.assertEqual(path.read_bytes(), raw)
        manifest, status = main(["manifest"])
        self.assertEqual((status, manifest["capabilities"], manifest["profiles"]), (0, ["parse", "calc-evaluate"], []))


if __name__ == "__main__":
    unittest.main()
