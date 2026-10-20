"""Accepted RFC0055 termination admission, exact diagnostic fields and transport."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate, well_formed
from test_validation_cli import property_source
from uwmd_reader import parse
from uwmd_validation import _validate_source

BASE = "tenants[0].termination_option"
COMPONENTS = ["unamortized_ti", "unamortized_lc", "free_rent", "fee"]


def option(**extra):
    return dict(earliest_date="2026-06-01", notice_months=0, **extra)


def raw(termination, **tenant):
    return property_source() + well_formed("rent_roll", as_of_date="2026-01-01",
        tenants=[dict(termination_option=termination, **tenant)])


def findings(result):
    return [(i["code"], i["field"]) for i in result["issues"] if i["code"] in ("LSE-04", "LSE-05")]


class TerminationAdmissionTests(unittest.TestCase):
    def assess(self, authored, **tenant):
        original = raw(authored, **tenant); document = parse(original); before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, original)
        self.assertEqual(result["errors"], [i for i in result["issues"] if i["severity"] == "error"])
        return findings(result)

    def test_optional_absence_null_and_all_admitted_declared_values(self):
        self.assertEqual(findings(validate(parse(property_source() + well_formed("rent_roll", tenants=[{}])))), [])
        self.assertEqual(self.assess(None), [])
        for extra in ({}, {"penalty": None}, {"penalty": 0}, {"penalty": 1.5},
                      {"penalty_includes": None}, {"penalty_includes": COMPONENTS},
                      {"conditions": None}, {"conditions": "literal narrative"}):
            with self.subTest(extra=extra):
                self.assertEqual(self.assess(option(**extra)), [])
        for months in (0, 1, 1.0, 9007199254740991):
            value = option(); value["notice_months"] = months
            self.assertEqual(self.assess(value), [])  # RFC0055 LSE-04 safe-integer boundary.
        for date in ("2026-01-01", "2026-12-31"):
            value = option(); value["earliest_date"] = date
            self.assertEqual(self.assess(value, lease_commencement="2026-01-01", lease_expiration="2026-12-31"), [])

    def test_parent_container_and_date_stop_only_this_clause(self):
        for value in (False, 0, "option", [], [option()]):
            self.assertEqual(self.assess(value), [("LSE-04", BASE)])
        for date in (None, False, 0, [], {}, "2026-02-29", "2026-01-01T00:00:00Z"):
            value = dict(earliest_date=date, notice_months=False, penalty=-1, penalty_includes=["unknown"])
            self.assertEqual(self.assess(value), [("LSE-04", BASE + ".earliest_date")])
        self.assertEqual(self.assess({}), [("LSE-04", BASE + ".earliest_date")])
        result = validate(parse(raw({}, co_tenancy_clause=True)))
        self.assertEqual([i["code"] for i in result["issues"] if i["code"].startswith("LSE-")], ["LSE-04", "LSE-06"])

    def test_notice_and_penalty_predicates_keep_exact_independent_fields(self):
        for notice in (None, False, True, -1, .5, "1", [], {}, 9007199254740992, 1e100):
            value = option(); value["notice_months"] = notice
            self.assertEqual(self.assess(value), [("LSE-04", BASE + ".notice_months")])
        value = option(); del value["notice_months"]
        self.assertEqual(self.assess(value), [("LSE-04", BASE + ".notice_months")])
        for penalty in (False, True, -1, "1", [], {}):
            self.assertEqual(self.assess(option(penalty=penalty)), [("LSE-04", BASE + ".penalty")])

    def test_term_bound_and_issue_order_precede_first_bad_component(self):
        value = dict(earliest_date="2027-01-01", notice_months=False, penalty=-1,
                     penalty_includes=["fee", "fee", "unknown"])
        self.assertEqual(self.assess(value, lease_commencement="2026-01-01", lease_expiration="2026-12-31"),
            [("LSE-04", BASE + ".notice_months"), ("LSE-04", BASE + ".penalty"),
             ("LSE-04", BASE + ".earliest_date"), ("LSE-05", BASE + ".penalty_includes[1]")])
        for companion in (dict(lease_commencement="bad", lease_expiration="2026-12-31"),
                          dict(lease_commencement="2026-01-01"), {}):
            self.assertEqual(self.assess(option(), **companion), [])

    def test_component_container_closed_domain_uniqueness_and_first_failure(self):
        for parts in (False, 0, "fee", {}, []):
            self.assertEqual(self.assess(option(penalty_includes=parts)), [("LSE-05", BASE + ".penalty_includes")])
        for parts, index in (([None], 0), ([True], 0), ([0], 0), ([{}], 0), ([[]], 0),
                             (["FEE"], 0), (["fee", "unknown", "fee"], 1),
                             (["fee", "fee", "unknown"], 1), (["fee", "free_rent", "fee"], 2)):
            self.assertEqual(self.assess(option(penalty_includes=parts)),
                             [("LSE-05", BASE + ".penalty_includes[" + str(index) + "]")])

    def test_current_model_not_stale_source_and_source_stays_unchanged(self):
        original = raw(option(penalty_includes=["fee", "fee"]))
        document = parse(original)
        document.source.blocks[1].parsed.value["tenants"][0]["termination_option"]["penalty_includes"] = ["fee"]
        before = copy.deepcopy(document)
        self.assertEqual(findings(validate(document)), [])
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, original)
        self.assertEqual(findings(validate(parse(original))), [("LSE-05", BASE + ".penalty_includes[1]")])

    def test_current_variant_applicability_history_overwritten_and_unknown_are_separate(self):
        invalid = parse(HEADER + well_formed("rent_roll", tenants=[dict(termination_option={})])).source.blocks[0].parsed.value
        valid = parse(HEADER + well_formed("rent_roll", tenants=[dict(termination_option=option())])).source.blocks[0].parsed.value
        historical = copy.deepcopy(invalid); historical["_meta"]["lifecycle"]["superseded"] = True
        source = property_source() + block("rent_roll", invalid) + block("rent_roll", valid)
        source += block("rent_roll", historical, superseded=True)
        self.assertEqual(findings(validate(parse(source))), [])
        source += block("rent_roll", invalid, variant="peer", role="component")
        self.assertEqual(findings(validate(parse(source))), [("LSE-04", BASE + ".earliest_date")])
        self.assertEqual(findings(validate(parse(property_source() + well_formed("x_lawful", tenants=[dict(termination_option={})])))), [])

    def test_safe_integer_boundary_is_field_specific_and_current_model_authoritative(self):
        admitted = option(); admitted["notice_months"] = 9007199254740991
        original = raw(admitted); document = parse(original)
        document.source.blocks[1].parsed.value["_meta"]["lifecycle"]["revision"] = 9007199254740992
        current = document.source.blocks[1].parsed.value["tenants"][0]["termination_option"]
        current["notice_months"] = 9007199254740992
        before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(findings(result), [("LSE-04", BASE + ".notice_months")])
        self.assertFalse(any(i["code"] == "META-04" for i in result["issues"]))
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, original)
        self.assertEqual(findings(asyncio.run(_validate_source(original))), [])
        current["earliest_date"] = "bad"
        self.assertEqual(findings(validate(document)), [("LSE-04", BASE + ".earliest_date")])

    def test_actual_cli_exact_fields_partitions_exits_and_unchanged_sources(self):
        max_notice = {**option(), "notice_months": 9007199254740991}
        above = {**option(), "notice_months": 9007199254740992}
        cases = [(option(), [], 0), (max_notice, [], 0),
                 (above, [("LSE-04", BASE + ".notice_months")], 1), ({}, [("LSE-04", BASE + ".earliest_date")], 1),
                 (option(penalty_includes=["fee", "fee"]), [("LSE-05", BASE + ".penalty_includes[1]")], 1)]
        with tempfile.TemporaryDirectory(prefix="uwmd-termination-cli-") as folder:
            path = Path(folder) / "source.uwx.md"
            for authored, expected, exit_code in cases:
                original = raw(authored); path.write_bytes(original)
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "validate", str(path), "--json"], capture_output=True, encoding="utf8", timeout=30)
                response = json.loads(process.stdout)
                self.assertEqual((process.returncode, process.stderr), (exit_code, ""))
                self.assertNotIn("error", response)
                self.assertEqual(findings(response), expected)
                self.assertEqual(response["errors"], [i for i in response["issues"] if i["severity"] == "error"])
                self.assertEqual(path.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
