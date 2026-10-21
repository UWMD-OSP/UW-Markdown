"""Format 5.2 financial-validity homes (RFC 0105): every home, worst band only."""
import json
from pathlib import Path
import unittest

from test_reader import HEADER
from test_validation import ROOT, validate, well_formed
from uwmd_reader import parse


def fv(result):
    return [(i["code"], i["severity"], i["section"], i["field"])
            for i in result["issues"] if i["code"].startswith("FV-")]


def with_quick_metrics(lines):
    # HEADER ends with its closing "---" line; insert the mapping before it.
    assert HEADER.endswith(b"---\n")
    return HEADER[:-4] + b"quick_metrics:\n" + lines + b"---\n"


class FinancialValidityTests(unittest.TestCase):
    def test_each_home_is_checked_at_its_most_severe_band(self):
        raw = (with_quick_metrics(b"  dscr: 0.95\n")
               + well_formed("property", total_units=12)
               + well_formed("debt_structure", sizing_metrics={"dscr_underwritten": 1.1}))
        self.assertEqual(fv(validate(parse(raw))), [
            ("FV-04", "error", "frontmatter", "quick_metrics.dscr"),
            ("FV-04", "warning", "debt_structure", "sizing_metrics.dscr_underwritten")])

    def test_ltv_error_band_draws_one_issue(self):
        raw = with_quick_metrics(b"  ltv: 0.9\n") + well_formed("property", total_units=12)
        self.assertEqual(fv(validate(parse(raw))), [("FV-09", "error", "frontmatter", "quick_metrics.ltv")])

    def test_portable_case_rows_match_the_reference(self):
        case = ROOT / "conformance/documents/malformed/67-financial-validity-homes"
        expected = json.loads(Path(str(case) + ".expected.json").read_text(encoding="utf-8"))
        seen = [(code, section, field) for code, _severity, section, field
                in fv(validate(parse(Path(str(case) + ".uwx.md").read_bytes())))]
        for row in expected["field_issues"]:
            with self.subTest(row=row):
                self.assertIn((row["code"], row["section"], row["field"]), seen)

    def test_fields_the_format_does_not_define_are_not_read(self):
        raw = (HEADER + well_formed("property", total_units=12)
               + well_formed("noi_model", vacancy_rate=0.5)
               + well_formed("dcf", levered_equity_multiple=9, assumptions={"annual_rent_growth": 0.5}))
        self.assertEqual(fv(validate(parse(raw))), [])


if __name__ == "__main__":
    unittest.main()
