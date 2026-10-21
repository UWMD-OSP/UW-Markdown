"""Format 5.2 financial-validity homes (RFC 0105) reported as deal flags (RFC 0109)."""
from collections import Counter
import json
from pathlib import Path
import unittest

from test_reader import HEADER
from test_validation import ROOT, validate, well_formed
from uwmd_reader import parse

FLAG_MEMBERS = {"code", "section", "field", "message", "value", "threshold", "band"}


def fv(result):
    """Deal flags as (code, band, section, field); a flag has no severity."""
    for flag in result["deal_flags"]:
        assert set(flag) == FLAG_MEMBERS, flag
    return [(f["code"], f["band"], f["section"], f["field"]) for f in result["deal_flags"]]


def fv_issues(result):
    return [i for i in result["issues"] if i["code"].startswith("FV-")]


def with_quick_metrics(lines):
    # HEADER ends with its closing "---" line; insert the mapping before it.
    assert HEADER.endswith(b"---\n")
    return HEADER[:-4] + b"quick_metrics:\n" + lines + b"---\n"


def weak_deal():
    """Frontmatter DSCR and LTV error bands plus a section DSCR warning band."""
    return (with_quick_metrics(b"  dscr: 0.95\n  ltv: 0.9\n")
            + well_formed("property", total_units=12)
            + well_formed("debt_structure", sizing_metrics={"dscr_underwritten": 1.1}))


class FinancialValidityTests(unittest.TestCase):
    def test_each_home_is_checked_at_its_most_severe_band(self):
        raw = (with_quick_metrics(b"  dscr: 0.95\n")
               + well_formed("property", total_units=12)
               + well_formed("debt_structure", sizing_metrics={"dscr_underwritten": 1.1}))
        result = validate(parse(raw))
        self.assertEqual(fv(result), [
            ("FV-04", "error", "frontmatter", "quick_metrics.dscr"),
            ("FV-04", "warning", "debt_structure", "sizing_metrics.dscr_underwritten")])
        self.assertEqual(fv_issues(result), [])
        self.assertEqual(result["deal_flags"][0], dict(
            code="FV-04", section="frontmatter", field="quick_metrics.dscr",
            message="Stated value is below its registered threshold", value=0.95,
            threshold={"min": 1.0}, band="error"))
        self.assertEqual(result["deal_flags"][1]["threshold"], {"min": 1.2})

    def test_ltv_error_band_draws_one_flag(self):
        raw = with_quick_metrics(b"  ltv: 0.9\n") + well_formed("property", total_units=12)
        result = validate(parse(raw))
        self.assertEqual(fv(result), [("FV-09", "error", "frontmatter", "quick_metrics.ltv")])
        self.assertEqual(result["deal_flags"][0]["threshold"], {"max": 0.85})

    def test_deal_flags_are_always_present(self):
        result = validate(parse(HEADER + well_formed("property", total_units=12)))
        self.assertEqual(result["deal_flags"], [])

    def test_weak_deal_error_band_is_not_a_record_error(self):
        raw = with_quick_metrics(b"  dscr: 0.95\n") + well_formed("property", total_units=12)
        result = validate(parse(raw))
        self.assertEqual(fv(result), [("FV-04", "error", "frontmatter", "quick_metrics.dscr")])
        self.assertEqual(result["overall_status"], "clean")
        for key in ("issues", "errors", "warnings", "info"):
            self.assertFalse(any(i["code"].startswith("FV-") for i in result[key]), key)

    def test_escalation_per_code_error_band_only(self):
        result = validate(parse(weak_deal()), financial_validity_errors=("FV-04",))
        self.assertEqual(result["overall_status"], "errors")
        # The listed code's error band is an ordinary error issue.
        self.assertEqual(fv_issues(result), [dict(
            code="FV-04", severity="error", section="frontmatter", field="quick_metrics.dscr",
            message="Stated value is below its registered threshold", value=0.95,
            threshold={"min": 1.0})])
        self.assertEqual(fv_issues(result), [i for i in result["errors"] if i["code"].startswith("FV-")])
        # Its warning band stays a flag (D4); an unlisted error band stays a flag.
        self.assertEqual(fv(result), [
            ("FV-09", "error", "frontmatter", "quick_metrics.ltv"),
            ("FV-04", "warning", "debt_structure", "sizing_metrics.dscr_underwritten")])

    def test_listing_codes_without_an_error_band_changes_nothing(self):
        baseline = validate(parse(weak_deal()))
        self.assertEqual(baseline["overall_status"], "clean")
        for codes in ((), ("FV-01", "FV-03"), ("FV-14",)):
            with self.subTest(codes=codes):
                self.assertEqual(validate(parse(weak_deal()), financial_validity_errors=codes), baseline)
        both = validate(parse(weak_deal()), financial_validity_errors=("FV-09", "FV-04", "FV-09"))
        self.assertEqual([(i["code"], i["field"]) for i in fv_issues(both)],
                         [("FV-04", "quick_metrics.dscr"), ("FV-09", "quick_metrics.ltv")])
        self.assertEqual(fv(both), [("FV-04", "warning", "debt_structure", "sizing_metrics.dscr_underwritten")])

    def test_escalated_issue_keeps_the_former_fv_position(self):
        # FV runs after the cross-section checks, so an escalated issue sits
        # between their findings and the later rules' findings.
        raw = weak_deal() + well_formed("noi_model", expenses={"expense_ratio": 0.1})
        plain = validate(parse(raw))
        escalated = validate(parse(raw), financial_validity_errors=("FV-04",))
        others = [i for i in escalated["issues"] if not i["code"].startswith("FV-")]
        self.assertEqual(others, plain["issues"])
        index = next(n for n, i in enumerate(escalated["issues"]) if i["code"] == "FV-04")
        self.assertFalse(any(i["code"].startswith("CC-") and i["code"] != "CC-16"
                             for i in escalated["issues"][index + 1:]))

    def test_portable_case_rows_match_the_reference(self):
        # RFC 0109: the cases' FV rows live in a `deal_flags` expectation of
        # {code, band, section, field}, compared as a multiset. 68 and 69 are
        # the RFC 0107 LTC homes and band edges.
        for stem in ("67-financial-validity-homes", "68-ltc-homes", "69-ltc-boundaries"):
            with self.subTest(case=stem):
                case = ROOT / "conformance/documents/malformed" / stem
                expected = json.loads(Path(str(case) + ".expected.json").read_text(encoding="utf-8"))
                result = validate(parse(Path(str(case) + ".uwx.md").read_bytes()))
                rows = Counter((r["code"], r["band"], r["section"], r["field"]) for r in expected["deal_flags"])
                self.assertEqual(Counter(fv(result)), rows)
                self.assertFalse(any(r["code"].startswith("FV-") for r in expected.get("field_issues", [])))
                self.assertEqual(fv_issues(result), [])

    def test_ltc_is_read_at_both_homes(self):
        # RFC 0107: quick_metrics.ltc and sources_uses.equity_metrics.loan_to_cost,
        # every stated value whatever the loan purpose.
        raw = (with_quick_metrics(b"  ltc: 0.95\n")
               + well_formed("property", total_units=12)
               + well_formed("sources_uses", equity_metrics={"loan_to_cost": 0.85}))
        result = validate(parse(raw))
        self.assertEqual(fv(result), [
            ("FV-15", "error", "frontmatter", "quick_metrics.ltc"),
            ("FV-15", "warning", "sources_uses", "equity_metrics.loan_to_cost")])
        self.assertEqual(result["deal_flags"][0]["threshold"], {"max": 0.9})
        self.assertEqual(result["deal_flags"][1]["threshold"], {"max": 0.8})

    def test_fields_the_format_does_not_define_are_not_read(self):
        raw = (HEADER + well_formed("property", total_units=12)
               + well_formed("noi_model", vacancy_rate=0.5)
               + well_formed("dcf", levered_equity_multiple=9, assumptions={"annual_rent_growth": 0.5}))
        self.assertEqual(fv(validate(parse(raw))), [])


if __name__ == "__main__":
    unittest.main()
