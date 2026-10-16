"""Independent VIII.2a payload controls, without claiming calc conformance."""
import copy
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

    def test_missing_null_empty_and_kind_mismatch_never_infer_periods(self):
        for payload in [None, {}, {"annual_cash_flows": None}, {"annual_cash_flows": []}]:
            self.assertIsNone(select_period_row(payload, "dcf", "annual_cash_flows", "Y1"))
        payload = {"annual_cash_flows": [{"year": 3}, {}, {"year": None}]}
        self.assertIsNone(select_period_row(payload, "dcf", "annual_cash_flows", "Y1"))
        self.assertIsNone(select_period_row(payload, "dcf", "annual_cash_flows", "2026-01-01"))
        checked = inspect_period_series(payload, "dcf", "annual_cash_flows")
        self.assertFalse(checked.malformed)
        self.assertEqual([i.pointer for i in checked.issues], ["/annual_cash_flows/1/year", "/annual_cash_flows/2/year"])
        self.assertTrue(all(i.code == "PS-01" and i.severity == "warning" for i in checked.issues))

    def test_all_rows_are_checked_before_returning_a_valid_match(self):
        payload = {"annual_cash_flows": [{"year": 1, "n": 100}, {"year": "bad"}, 12, {"year": -3}]}
        inspected = inspect_period_series(payload, "dcf", "annual_cash_flows")
        self.assertEqual([i.pointer for i in inspected.issues],
                         ["/annual_cash_flows/1/year", "/annual_cash_flows/2", "/annual_cash_flows/3/year"])
        self.refusal("CALC-PERIOD-001", select_period_row, payload, "dcf", "annual_cash_flows", "Y1")

    def test_duplicate_diagnostics_are_per_collision(self):
        payload = {"annual_cash_flows": [{"year": 1}, {"year": 2}, {"year": 1}, {"year": 1}]}
        issues = inspect_period_series(payload, "dcf", "annual_cash_flows").issues
        self.assertEqual([(i.code, i.severity, i.pointer) for i in issues], [
            ("PS-02", "error", "/annual_cash_flows/2/year"), ("PS-02", "error", "/annual_cash_flows/3/year")])
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
        self.assertEqual({i.code for i in checked.issues}, {"PS-01", "PS-02"})
        self.assertEqual(len(checked.rows), 3)
        self.assertEqual(document.source.raw, source)
        # The fixture also requires PS-03 and unrelated validation; neither is
        # claimed by this payload-only structural foundation.


if __name__ == "__main__":
    unittest.main()
