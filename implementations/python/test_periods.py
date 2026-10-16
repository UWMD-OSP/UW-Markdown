"""Independent VIII.2a payload controls, without claiming calc conformance."""
import copy
import json
import re
from pathlib import Path
import unittest

from uwmd_periods import (PERIOD_SERIES, PeriodError, canonical_period,
                          inspect_period_series, parse_period_selector, select_period_row)
from uwmd_reader import parse


class PeriodTests(unittest.TestCase):
    def refusal(self, code, function, *args):
        with self.assertRaises(PeriodError) as caught:
            function(*args)
        self.assertEqual(caught.exception.code, code)

    def test_registry_is_closed_and_immutable(self):
        self.assertEqual(set(PERIOD_SERIES), {
            ("dcf", "annual_cash_flows"), ("noi_model", "projections"),
            ("lease_up_schedule", "schedule"), ("cash_flow_series", "series"),
            ("distribution_waterfall", "stated_schedule")})
        with self.assertRaises(TypeError):
            PERIOD_SERIES["x_new", "series"] = None
        self.refusal("CALC-PERIOD-001", select_period_row, {}, "x_new", "series", "Y1")

    def test_selector_kinds_year_zero_and_safe_integer_boundary(self):
        for spelling, key in [
            ("Y1", ("year", 1)), ("Y9007199254740991", ("year", 9007199254740991)),
            ("0000-Q1", ("quarter", 0, 1)), ("2026-12", ("month", 2026, 12)),
            ("0000-02-29", ("date", "0000-02-29")), ("2000-02-29", ("date", "2000-02-29"))]:
            self.assertEqual(parse_period_selector(spelling), key)
        for bad in [None, 1, True, "Y0", "Y01", "Y9007199254740992", "Y" + "1" * 5000,
                    "2026-Q0", "2026-Q5", "2026-00", "2026-13", "1900-02-29",
                    "2026-1-01", "2026-01-01Z", "Y\u0661", "2026-01\n", " Y1", "Q1", "*"]:
            with self.subTest(bad=repr(bad)[:100]):
                self.refusal("CALC-PERIOD-001", parse_period_selector, bad)

    def test_year_identity_null_and_invalid_numbers(self):
        entry = PERIOD_SERIES["dcf", "annual_cash_flows"]
        self.assertIsNone(canonical_period(entry, None))
        self.assertEqual(canonical_period(entry, 2.0), ("year", 2))
        for value in [True, False, 0, -1, 1.5, float("inf"), float("nan"), "1", 9007199254740992, 10 ** 500]:
            self.refusal("CALC-PERIOD-001", canonical_period, entry, value)

    def test_year_key_aliases_collide_without_sorting(self):
        payload = {"projections": {"year_03": {"n": 3}, "year_1": {"n": 1}}}
        rows = inspect_period_series(payload, "noi_model", "projections").rows
        self.assertEqual([row.identity for row in rows], [("year", 3), ("year", 1)])
        self.assertIs(select_period_row(payload, "noi_model", "projections", "Y3"), payload["projections"]["year_03"])
        payload["projections"]["year_3"] = {"n": 33}
        issues = inspect_period_series(payload, "noi_model", "projections").issues
        self.assertEqual([(i.code, i.pointer) for i in issues], [("PS-02", "/projections/year_3")])
        self.refusal("CALC-PERIOD-002", select_period_row, payload, "noi_model", "projections", "Y1")
        entry = PERIOD_SERIES["noi_model", "projections"]
        for bad in ["year_0", "year_1.0", "year_-1", "other", "year_9007199254740992"]:
            self.refusal("CALC-PERIOD-001", canonical_period, entry, bad)
        self.assertEqual(canonical_period(entry, "year_" + "0" * 5000 + "1"), ("year", 1))

    def test_absent_series_and_unmatched_periods_differ_from_malformed_present_rows(self):
        for payload in [None, {}, {"annual_cash_flows": None}, {"annual_cash_flows": []}]:
            self.assertIsNone(select_period_row(payload, "dcf", "annual_cash_flows", "Y1"))
            checked = inspect_period_series(payload, "dcf", "annual_cash_flows")
            self.assertFalse(checked.malformed)
            self.assertEqual(checked.issues, ())
        payload = {"annual_cash_flows": [{"year": 3}]}
        self.assertIsNone(select_period_row(payload, "dcf", "annual_cash_flows", "Y1"))
        self.assertIsNone(select_period_row(payload, "dcf", "annual_cash_flows", "2026-01-01"))
        for section, series, valid, invalid_rows, selectors in [
                ("dcf", "annual_cash_flows", {"year": 3}, [{}, {"year": None}], ("Y1", "Y3")),
                ("cash_flow_series", "series", {"date": "2026-01-01"}, [{}, {"date": None}],
                 ("2026-01-01", "2027-01-01")),
                ("distribution_waterfall", "stated_schedule", {"date": "2026-01-01"}, [{}, {"date": None}],
                 ("2026-01-01", "2027-01-01"))]:
            with self.subTest(section=section):
                payload = {series: [valid, *invalid_rows]}
                checked = inspect_period_series(payload, section, series)
                self.assertTrue(checked.malformed)
                field = "year" if section == "dcf" else "date"
                self.assertEqual([i.pointer for i in checked.issues],
                                 ["/" + series + "/1/" + field, "/" + series + "/2/" + field])
                self.assertTrue(all(i.code == "PS-01" and i.severity == "warning" for i in checked.issues))
                self.assertEqual(len(checked.rows), 3)
                for selector in selectors:
                    self.refusal("CALC-PERIOD-001", select_period_row, payload, section, series, selector)
        for missing in ({}, {"period": None}):
            payload = {"period_granularity": "monthly", "schedule": [{"period": "2026-01"}, missing]}
            self.refusal("CALC-PERIOD-001", select_period_row, payload, "lease_up_schedule", "schedule", "2026-01")

    def test_all_rows_are_checked_before_returning_a_valid_match(self):
        payload = {"annual_cash_flows": [{"year": 1, "n": 100}, {"year": "bad"}, 12, {"year": -3}]}
        inspected = inspect_period_series(payload, "dcf", "annual_cash_flows")
        self.assertEqual([i.pointer for i in inspected.issues],
                         ["/annual_cash_flows/1/year", "/annual_cash_flows/2", "/annual_cash_flows/3/year"])
        self.refusal("CALC-PERIOD-001", select_period_row, payload, "dcf", "annual_cash_flows", "Y1")

    def test_duplicate_diagnostics_are_per_identity_and_precede_malformed(self):
        payload = {"annual_cash_flows": [{"year": 1}, {"year": 2}, {"year": 1}, {"year": 1}]}
        issues = inspect_period_series(payload, "dcf", "annual_cash_flows").issues
        self.assertEqual([(i.code, i.severity, i.pointer) for i in issues], [
            ("PS-02", "error", "/annual_cash_flows/2/year")])
        self.refusal("CALC-PERIOD-002", select_period_row, payload, "dcf", "annual_cash_flows", "Y2")
        payload["annual_cash_flows"].append({"year": "malformed"})
        checked = inspect_period_series(payload, "dcf", "annual_cash_flows")
        self.assertTrue(checked.malformed)
        self.assertEqual([i.code for i in checked.issues], ["PS-02", "PS-01"])
        self.assertEqual(len(checked.rows), 5)
        self.refusal("CALC-PERIOD-002", select_period_row, payload, "dcf", "annual_cash_flows", "Y2")

    def test_calendar_cadence_is_stated_even_for_empty_series(self):
        for cadence, period in [("monthly", "2026-02"), ("quarterly", "2026-Q2")]:
            payload = {"period_granularity": cadence, "schedule": [{"period": period}]}
            self.assertIs(select_period_row(payload, "lease_up_schedule", "schedule", period), payload["schedule"][0])
        for payload in [{"schedule": []}, {"period_granularity": "daily", "schedule": []},
                        {"period_granularity": "monthly", "schedule": [{"period": "2026-Q1"}]},
                        {"period_granularity": "quarterly", "schedule": [{"period": "2026-01-01"}]}]:
            self.refusal("CALC-PERIOD-001", select_period_row, payload, "lease_up_schedule", "schedule", "2026-Q1")

    def test_same_day_cash_rows_preserve_identity_and_only_requested_duplicates_refuse(self):
        payload = {"series": [{"date": "2026-01-01", "amount": -10},
                              {"date": "2026-01-01", "amount": -2},
                              {"date": "2027-01-01", "amount": 20}]}
        before = copy.deepcopy(payload)
        inspected = inspect_period_series(payload, "cash_flow_series", "series")
        self.assertEqual(inspected.issues, ())
        self.assertEqual(len(inspected.rows), 3)
        self.assertIs(inspected.rows[1].value, payload["series"][1])
        self.assertIs(select_period_row(payload, "cash_flow_series", "series", "2027-01-01"), payload["series"][2])
        self.assertIsNone(select_period_row(payload, "cash_flow_series", "series", "2028-01-01"))
        self.refusal("CALC-PERIOD-002", select_period_row, payload, "cash_flow_series", "series", "2026-01-01")
        self.assertEqual(payload, before)
        payload["series"].append({"date": "2028-02-30"})
        self.refusal("CALC-PERIOD-002", select_period_row, payload, "cash_flow_series", "series", "2026-01-01")
        self.refusal("CALC-PERIOD-001", select_period_row, payload, "cash_flow_series", "series", "2027-01-01")

    def test_waterfall_duplicates_have_no_cash_flow_exception(self):
        payload = {"stated_schedule": [{"date": "2026-01-01"}, {"date": "2026-01-01"}, {"date": "2027-01-01"}]}
        self.assertEqual([i.code for i in inspect_period_series(payload, "distribution_waterfall", "stated_schedule").issues], ["PS-02"])
        self.refusal("CALC-PERIOD-002", select_period_row, payload, "distribution_waterfall", "stated_schedule", "2027-01-01")

    def test_wrong_series_shapes_and_types_do_not_become_empty_success(self):
        for section, series, value in [("dcf", "annual_cash_flows", {}), ("noi_model", "projections", []),
                                        ("cash_flow_series", "series", "missing")]:
            checked = inspect_period_series({series: value}, section, series)
            self.assertTrue(checked.malformed)
            self.assertEqual(checked.issues[0].code, "PS-01")
            self.refusal("CALC-PERIOD-001", select_period_row, {series: value}, section, series, "Y1")
        self.refusal("CALC-PERIOD-001", inspect_period_series, [], "dcf", "annual_cash_flows")

    def test_existing_period_document_inspection_is_distinct_from_full_validation(self):
        root = Path(__file__).resolve().parents[2]
        source = (root / "conformance/documents/fixtures/13-period-identities.uwx.md").read_bytes()
        document = parse(source)
        payload = document.projection()["sections"]["dcf"]["content"]
        checked = inspect_period_series(payload, "dcf", "annual_cash_flows")
        baseline = json.loads((root / "conformance/documents/expected/13-period-identities.validation.json").read_text(encoding="utf-8"))
        expected = {(issue["code"], issue["severity"]) for issue in baseline["issues"]
                    if issue["code"] in ("PS-01", "PS-02")}
        self.assertEqual({(i.code, i.severity) for i in checked.issues}, expected)
        self.assertEqual(len(checked.rows), 3)
        self.assertEqual(document.source.raw, source)
        # The fixture also requires PS-03 and unrelated validation; neither is
        # claimed by this payload-only structural foundation.


    def test_frozen_duplicate_year_structure_and_selector_refusals(self):
        root = Path(__file__).resolve().parents[2] / "conformance/cash-flow/reject-duplicate-year-selection"
        document = parse((root / "deal.uwx.md").read_bytes())
        payload = document.projection()["sections"]["dcf"]["content"]
        baseline = json.loads((root / "expected.json").read_text(encoding="utf-8"))
        checked = inspect_period_series(payload, "dcf", "annual_cash_flows")
        self.assertEqual({i.code for i in checked.issues}, set(baseline["expected_codes"]))
        for selector, expected in zip(("Y1", "Y2"), baseline["selectors"], strict=True):
            self.assertEqual(expected["formula"], "dcf.annual_cash_flows@" + selector + ".noi")
            self.refusal(expected["error_code"], select_period_row, payload, "dcf", "annual_cash_flows", selector)

    def test_frozen_same_day_source_and_absent_ps_diagnostics(self):
        root = Path(__file__).resolve().parents[2] / "conformance/cash-flow/valid-same-day-selection"
        source = (root / "deal.uwx.md").read_bytes()
        document = parse(source)
        payload = document.projection()["sections"]["cash_flow_series"]["base"]["content"]
        baseline = json.loads((root / "expected.json").read_text(encoding="utf-8"))
        self.assertIn("PS-", baseline["absent_code_prefixes"])
        checked = inspect_period_series(payload, "cash_flow_series", "series")
        self.assertEqual(checked.issues, ())
        self.assertEqual([row.value for row in checked.rows], baseline["expected_series"])
        for selector, expected in zip(("2027-06-30", "2028-06-30", "2029-06-30"), baseline["selectors"], strict=True):
            self.assertEqual(expected["formula"], "cash_flow_series.series@" + selector + ".amount")
            if not expected["ok"]:
                self.refusal(expected["error_code"], select_period_row, payload, "cash_flow_series", "series", selector)
            else:
                row = select_period_row(payload, "cash_flow_series", "series", selector)
                self.assertEqual(None if row is None else row.get("amount"), expected["value"])
        self.assertEqual(document.source.raw, source)

    def test_frozen_single_reference_period_fixtures_without_calc_claim(self):
        # This test-only extraction is deliberately not an expression parser.
        # The two arithmetic formulas (01 and 04) are outside this API's scope.
        root = Path(__file__).resolve().parents[2] / "conformance/calc/fixtures"
        names = ("period-02-keyed-year", "period-03-calendar-quarter", "period-05-missing",
                 "period-06-kind-mismatch", "period-07-duplicate", "period-08-unregistered",
                 "period-09-same-day-unique", "period-10-same-day-repeated",
                 "period-11-same-day-absent", "period-12-other-series-duplicate")
        for name in names:
            with self.subTest(fixture=name):
                directory = root / name
                declaration = json.loads((directory / "calc.json").read_text(encoding="utf-8"))
                expected = json.loads((directory / "expected-result.json").read_text(encoding="utf-8"))
                match = re.fullmatch(r"([a-z_]+)\.([a-z_]+)@([A-Za-z0-9-]+)\.([a-z_]+)", declaration["formula"])
                self.assertIsNotNone(match, "test fixture changed beyond a single reference")
                section, series, selector, field = match.groups()
                document = parse((directory / "deal.uwx.md").read_bytes())
                blocks = [block for block in document.source.blocks if block.section == section]
                self.assertEqual(len(blocks), 1, "test must not silently choose a variant or history")
                payload = blocks[0].parsed.value
                if not expected["ok"]:
                    self.refusal(expected["error"]["code"], select_period_row, payload, section, series, selector)
                else:
                    row = select_period_row(payload, section, series, selector)
                    self.assertEqual(None if row is None else row.get(field), expected["value"])


if __name__ == "__main__":
    unittest.main()
