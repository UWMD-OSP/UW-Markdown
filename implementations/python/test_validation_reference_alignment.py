"""Issue #354 / #425: the dispositioned `validate` differences, case by case.

Each synthetic record pins the reference implementation's projection, ordered
as the reference reports it within the named code families: (code, severity,
section, field). The expected rows were produced by running the reference
`uwmd validate --json` on the same bytes (see `write_cases`); Python must
equal them exactly in codes, severities, fields and counts. Where the Format
specification decides a case the reference reads differently, the case pins
the specification and says so (`SPEC_OVER_REFERENCE`).
"""
import asyncio
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER, block
from test_validation import well_formed
from uwmd_reader import parse
from uwmd_validation import validate_document

ROOT = Path(__file__).resolve().parents[2]
NOW = "2026-10-16T00:00:00Z"
DIGEST = "sha256:" + "0" * 64


def _doc(*blocks, asset="office"):
    return HEADER.replace(b"asset_class: multifamily", b"asset_class: " + asset.encode()) + b"".join(blocks)


def _cash(variant="cap-cash", **payload):
    body = dict(series=[{"date": "2026-01-01", "amount": -100.0}, {"date": "2027-06-30", "amount": -5.0},
                        {"date": "2029-01-01", "amount": 250.0}])
    body.update(payload)
    return block("cash_flow_series", body, variant=variant)


def _hedge(**changes):
    hedge = dict(instrument="rate_cap", strike_rate=.035, notional=1000000.0, index="sofr",
                 effective_date="2026-01-01", expiration_date="2028-01-01",
                 post_expiration_assumption="replace",
                 replacement_funding=dict(mode="outright", cash_flow_ref=dict(
                     variant="cap-cash", row_index=1, binding_digest=DIGEST)))
    hedge.update(changes)
    return {key: value for key, value in hedge.items() if value is not ...}


def _debt(hedge, rate_type="floating"):
    return well_formed("debt_structure", loan_amount=1000000.0, rate_type=rate_type, rate_hedge=hedge)


def _stack(*tranches, **extra):
    return well_formed("capital_stack", point_in_time="closing", tranches=list(tranches), **extra)


def _tranche(**changes):
    tranche = {"id": "senior", "class": "senior_debt", "position": 1, "amount": 100.0, "rate": .05}
    tranche.update(changes)
    return {key: value for key, value in tranche.items() if value is not ...}


def _tax(abatement, value=900.0):
    return well_formed("noi_model", net_operating_income=10000.0, expenses=dict(
        real_estate_taxes=dict(value=value, abatement=abatement)))


_SCHEDULE = [dict(period="Y1", full_tax=1000.0, abated_tax=500.0), dict(period="Y2", full_tax=1000.0, abated_tax=900.0)]


def _gaps(*stamps):
    return well_formed("gaps", items=[dict(section="valuation", reason="pending", last_checked=s) for s in stamps])


# name -> (source bytes, code prefixes compared, expected reference rows)
def _priced(price, *blocks, asset="office"):
    """RFC 0086: a record whose frontmatter states quick_metrics.purchase_price."""
    raw = _doc(asset=asset)
    if price is not None:
        raw = raw.replace(b"unknown_key: retained\n",
                          b"unknown_key: retained\nquick_metrics:\n  purchase_price: " + str(price).encode() + b"\n")
    return raw + b"".join(blocks)


def _valuation_variant(variant, price):
    """Two such blocks collide on `primary`, so the valuation does not resolve (§5.3)."""
    meta = dict(section="valuation", provenance=dict(source="manual", actor="tester", timestamp="2026-01-01T00:00:00Z"),
                quality=dict(confidence="high", human_review_required=False), lifecycle=dict(revision=1, superseded=False))
    return block("valuation", {"_meta": meta, "purchase_price": price}, variant=variant, role="primary")


CASES = {
    # CF-01 is the §4.26 row grammar only: schema shape beyond it is not CF-01.
    "cf-schema-shape-is-not-cf01": (
        _doc(_cash(label=5, unknown=1, series=[{"date": "2026-01-01", "amount": -1.0, "note": "x", "label": 7},
                                                {"date": "2026-02-01", "amount": 2.0}])),
        ("CF-",), []),
    "cf-row-grammar-and-order": (
        _doc(_cash(day_count="actual/actual", series=[
            {"date": "2026-02-30", "amount": -1.0}, {"date": "2026-03-01", "amount": "1"},
            {"date": "2026-03-02", "amount": 1.0, "kind": "fee"}, {"date": "2026-03-01", "amount": 1.0}])),
        ("CF-",), [("CF-01", "error", "cash_flow_series", "day_count"),
                   ("CF-01", "error", "cash_flow_series", "series[0].date"),
                   ("CF-01", "error", "cash_flow_series", "series[1].amount"),
                   ("CF-01", "error", "cash_flow_series", "series[2].kind"),
                   ("CF-02", "error", "cash_flow_series", "series[3].date")]),
    "cf-non-array-series": (
        _doc(_cash(series="none", stated_metrics=dict(xirr=.1))),
        ("CF-",), [("CF-02", "error", "cash_flow_series", "series")]),
    "cf-xirr-without-sign-change": (
        _doc(_cash(series=[{"date": "2026-01-01", "amount": 1.0}], stated_metrics=dict(xirr=.1))),
        ("CF-",), [("CF-03", "error", "cash_flow_series", "stated_metrics.xirr")]),
    # HDG-08 inherits only the binding's row contract, at the failing member.
    "hdg08-section-shape-binds": (
        _doc(_debt(_hedge()), _cash(label=5, unknown=1)),
        ("HDG-", "CF-"), []),
    "hdg08-row-member": (
        _doc(_debt(_hedge()), _cash(series=[{"date": "2026-01-01", "amount": -100.0},
                                              {"date": "2027-06-30", "amount": -5.0, "note": "x"}])),
        ("HDG-", "CF-"), [("HDG-08", "error", "debt_structure", "rate_hedge.replacement_funding.cash_flow_ref.row_index")]),
    "hdg08-missing-variant": (
        _doc(_debt(_hedge()), _cash(variant="other")),
        ("HDG-",), [("HDG-08", "error", "debt_structure", "rate_hedge.replacement_funding.cash_flow_ref.variant")]),
    "hdg08-bad-digest": (
        _doc(_debt(_hedge(replacement_funding=dict(mode="outright", cash_flow_ref=dict(
            variant="missing", row_index=1, binding_digest="sha256:ABC"))))),
        ("HDG-",), [("HDG-08", "error", "debt_structure", "rate_hedge.replacement_funding.cash_flow_ref")]),
    # HDG-01 is per stated member (Format §4.7); a partial group also names the group.
    "hdg01-partial-terms-group": (
        (ROOT / "conformance/hedge/0081-reject-partial-terms-group/deal.uwx.md").read_bytes(),
        ("HDG-",), [("HDG-01", "error", "debt_structure", "rate_hedge"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.effective_date"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.expiration_date"),
                    ("HDG-06", "error", "debt_structure", "rate_hedge.post_expiration_assumption")]),
    "hdg01-members": (
        _doc(_debt(dict(instrument="rate_floor", strike_rate=3.5, notional=-1.0, index="libor",
                        effective_date="2027-01-01", expiration_date="2026-01-01",
                        post_expiration_assumption="extend", premium=-1.0, counterparty=5, extra=1),
                   rate_type="fixed")),
        ("HDG-",), [("HDG-01", "error", "debt_structure", "rate_hedge.instrument"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.notional"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.strike_rate"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.index"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.expiration_date"),
                    ("HDG-01", "error", "debt_structure", "rate_hedge.premium"),
                    ("HDG-03", "error", "debt_structure", "rate_type"),
                    ("HDG-06", "error", "debt_structure", "rate_hedge.post_expiration_assumption")]),
    # Capital stack (Format §4.24).
    "cs-null-common-equity-rate": (
        _doc(_stack(_tranche(), _tranche(id="equity", position=2, rate=None, **{"class": "common_equity"}))),
        ("CS-",), []),
    "cs-rate-presence": (
        _doc(_stack(_tranche(rate=None), _tranche(id="equity", position=2, rate=.1, **{"class": "common_equity"}))),
        ("CS-",), [("CS-02", "error", "capital_stack", "tranches[0].rate"),
                   ("CS-02", "error", "capital_stack", "tranches[1].rate")]),
    "cs-waterfall-markers-per-key": (
        _doc(_stack(_tranche(promote=.2, hurdles=[.1], carried_interest=1), distributions=[], hurdle=.08,
                    catch_up=1)),
        ("CS-",), [("CS-WATERFALL-UNSUPPORTED", "error", "capital_stack", "distributions"),
                   ("CS-WATERFALL-UNSUPPORTED", "error", "capital_stack", "hurdle"),
                   ("CS-WATERFALL-UNSUPPORTED", "error", "capital_stack", "catch_up"),
                   ("CS-WATERFALL-UNSUPPORTED", "error", "capital_stack", "tranches[0].promote"),
                   ("CS-WATERFALL-UNSUPPORTED", "error", "capital_stack", "tranches[0].hurdles"),
                   ("CS-WATERFALL-UNSUPPORTED", "error", "capital_stack", "tranches[0].carried_interest")]),
    "cs01-required-members-only": (
        _doc(_stack(_tranche(amount=-5.0, accrual="unknown", term_months=True, io_months=1.5), False)),
        ("CS-",), [("CS-01", "error", "capital_stack", "tranches[1].id"),
                   ("CS-01", "error", "capital_stack", "tranches[1].class"),
                   ("CS-01", "error", "capital_stack", "tranches[1].position"),
                   ("CS-01", "error", "capital_stack", "tranches[1].amount")]),
    "cs01-absent-tranches": (
        _doc(well_formed("capital_stack", point_in_time="closing")),
        ("CS-",), []),
    # Cross-section checks (Format §5.3).
    "cc05-noi-used-for-dscr": (
        _doc(well_formed("noi_model", net_operating_income=1000000.0),
             well_formed("debt_structure", loan_amount=1.0, noi_used_for_dscr=900000.0)),
        ("CC-05",), [("CC-05", "warning", "debt_structure", "underwritten_noi")]),
    "cc05-cc06-nonpositive-noi": (
        _doc(well_formed("noi_model", net_operating_income=-5.0),
             well_formed("debt_structure", loan_amount=1.0, underwritten_noi=100.0),
             well_formed("dcf", annual_cash_flows=[{"noi": 100.0}])),
        ("CC-05", "CC-06"), []),
    "cc06-first-year-noi": (
        _doc(well_formed("noi_model", net_operating_income=1000.0),
             well_formed("dcf", annual_cash_flows=[{"net_operating_income": 500.0}])),
        ("CC-06",), [("CC-06", "warning", "dcf", "annual_cash_flows[0].noi")]),
    "cc07-dcf-exit-cap-rate": (
        _doc(well_formed("dcf", exit_cap_rate=.06), well_formed("stress_tests", base_case=dict(exit_cap_rate=.07))),
        ("CC-07",), [("CC-07", "warning", "stress_tests", "base_case.exit_cap_rate")]),
    "cc01-carriers": (
        _doc(well_formed("rent_roll", totals=dict(gross_potential_rent=1100.0)),
             well_formed("operating_statement", income=dict(gross_potential_rent=1000.0))),
        ("CC-01",), [("CC-01", "warning", "rent_roll", "gross_potential_rent")]),
    "cc01-annual-is-not-a-carrier": (
        _doc(well_formed("rent_roll", gross_potential_rent_annual=1100.0),
             well_formed("operating_statement", gross_potential_rent=1000.0)),
        ("CC-01",), []),
    "cc15-ineligible-base": (
        _doc(well_formed("noi_model", net_operating_income=1000.0),
             block("lease_up_schedule", dict(model_type="absorption_curve", period_granularity="monthly",
                   schedule=[dict(period="2026-01")], stabilized_summary=dict(annualized_noi=1000.0)),
                   variant="base", role="component"),
             block("lease_up_schedule", dict(model_type="absorption_curve", period_granularity="monthly",
                   schedule=[dict(period="2026-01")], stabilized_summary=dict(annualized_noi=500.0)),
                   variant="downside")),
        ("CC-15",), []),
    # CC-17 (RFC 0086): the frontmatter price against valuation, CC-10's $100 / error rule, every class.
    "cc17-agrees": (
        _priced(10000000, well_formed("valuation", purchase_price=10000000.0)),
        ("CC-17",), []),
    "cc17-101-off": (
        _priced(10000101, well_formed("valuation", purchase_price=10000000.0)),
        ("CC-17",), [("CC-17", "error", "frontmatter", "quick_metrics.purchase_price")]),
    "cc17-100-off-boundary": (
        _priced(10000100, well_formed("valuation", purchase_price=10000000.0)),
        ("CC-17",), []),
    "cc17-multifamily": (
        _priced(12000000, well_formed("valuation", purchase_price=10000000.0), asset="multifamily"),
        ("CC-17",), [("CC-17", "error", "frontmatter", "quick_metrics.purchase_price")]),
    "cc17-unresolved-valuation": (
        _priced(12000000, _valuation_variant("bank", 10000000.0), _valuation_variant("sponsor", 12000000.0)),
        ("CC-17",), []),
    # Waterfall reference (Format §4.27).
    "wf-non-array-series": (
        _doc(_cash(variant="lp", series="none"),
             well_formed("distribution_waterfall", cash_flow_ref=dict(variant="lp"),
                         equity_split=dict(lp=.9, gp=.1), tiers=[dict(type="split", lp_share=.8, gp_share=.2)],
                         clawback=dict(basis="lp_preferred_shortfall", cap="promote_received"))),
        ("WF-02", "WF-03", "WF-15"), []),
    "wf-references": (
        _doc(_cash(variant="lp", series=[{"date": "2026-01-01", "amount": 5.0}]),
             well_formed("distribution_waterfall", cash_flow_ref=dict(variant="lp"),
                         equity_split=dict(lp=.9, gp=.1), tiers=[dict(type="split", lp_share=.8, gp_share=.2)]),
             block("distribution_waterfall", dict(cash_flow_ref=dict(variant="gone"),
                   equity_split=dict(lp=.9, gp=.1), tiers=[dict(type="split", lp_share=.8, gp_share=.2)]),
                   variant="alt"),
             block("distribution_waterfall", dict(cash_flow_ref=dict(),
                   equity_split=dict(lp=.9, gp=.1), tiers=[dict(type="split", lp_share=.8, gp_share=.2)]),
                   variant="none")),
        ("WF-02", "WF-03"), [("WF-03", "error", "distribution_waterfall", "cash_flow_ref.variant"),
                             ("WF-02", "error", "distribution_waterfall", "cash_flow_ref.variant"),
                             ("WF-02", "error", "distribution_waterfall", "cash_flow_ref")]),
    # TAX-07 (Format §4.5).
    "tax07-stated-value": (
        _doc(_tax(dict(kind="pilot", schedule=_SCHEDULE, stabilized_period="Y2"), value=500.0)),
        ("TAX-07",), [("TAX-07", "error", "noi_model", "expenses.real_estate_taxes.value")]),
    "tax07-unnamed-period": (
        _doc(_tax(dict(kind="pilot", schedule=_SCHEDULE, stabilized_period="Y3"))),
        ("TAX-07",), [("TAX-07", "error", "noi_model", "expenses.real_estate_taxes.abatement.stabilized_period")]),
    "tax07-waits-for-admitted-schedule": (
        _doc(_tax(dict(kind="pilot", schedule=[*_SCHEDULE, dict(period="Y3", full_tax="x", abated_tax=1.0)],
                       stabilized_period="Y9"))),
        ("TAX-07",), []),
    "tax07-unstated-value": (
        _doc(_tax(dict(kind="pilot", schedule=_SCHEDULE, stabilized_period="Y2"), value=None)),
        ("TAX-07",), []),
    # RFC 0122: DQ-05 excludes local-time stamps.
    "dq05-date-only-and-local": (
        _doc(_gaps("2026-09-01", "2026-10-15", "2026-09-01T00:00:00", "2026-10-15T12:00", "2026-09-01T00:00:00Z",
                   "not a date")),
        ("DQ-05",), [("DQ-05", "info", "gaps", "items[0].last_checked"),
                     ("DQ-05", "info", "gaps", "items[4].last_checked")]),
}

# Format decides these against the reference; the rows above pin the Format.
SPEC_OVER_REFERENCE = {
    # Format §4.5: "when stabilized_period is stated"; a stated null is not
    # stated. The reference reports TAX-07 at stabilized_period for null.
    "tax07-null-period": (
        _doc(_tax(dict(kind="pilot", schedule=_SCHEDULE, stabilized_period=None))),
        ("TAX-07",), []),
}


def project(result, prefixes):
    return [(i["code"], i["severity"], i["section"], i.get("field") or "")
            for i in result["issues"] if i["code"].startswith(prefixes)]


def validate(raw):
    return asyncio.run(validate_document(parse(raw), now=NOW))


class ReferenceAlignmentTests(unittest.TestCase):
    def test_dispositioned_validate_differences_equal_the_reference(self):
        for name, (raw, prefixes, expected) in {**CASES, **SPEC_OVER_REFERENCE}.items():
            with self.subTest(case=name):
                self.assertEqual(project(validate(raw), prefixes), expected)

    def test_cc15_ineligible_base_is_unresolvable_not_another_scenario(self):
        result = validate(CASES["cc15-ineligible-base"][0])
        self.assertEqual(result["coverage"]["CC-15"]["status"], "skipped")
        self.assertEqual(result["coverage"]["CC-15"]["reason"], "variant_unresolvable")

    def test_cc17_coverage_follows_cc10(self):
        def coverage(raw):
            result = validate(raw)
            entry = result["coverage"]["CC-17"]
            return entry["status"], entry.get("reason"), result
        self.assertEqual(coverage(CASES["cc17-agrees"][0])[:2], ("evaluated", None))
        self.assertEqual(coverage(CASES["cc17-100-off-boundary"][0])[:2], ("evaluated", None))
        self.assertEqual(coverage(_priced(None, well_formed("valuation", purchase_price=1.0)))[:2], ("skipped", "field_absent"))
        self.assertEqual(coverage(_priced(1, well_formed("valuation", underwritten_value=1.0)))[:2], ("skipped", "field_absent"))
        self.assertEqual(coverage(_priced(1))[:2], ("skipped", "section_absent"))
        status, reason, result = coverage(CASES["cc17-unresolved-valuation"][0])
        self.assertEqual((status, reason), ("skipped", "variant_unresolvable"))
        notes = [i for i in result["issues"] if i["code"] == "CC-16"]
        self.assertEqual(len(notes), 1)
        self.assertIn("CC-17", notes[0]["message"])

    def test_cc05_cc06_nonpositive_noi_is_evaluated(self):
        coverage = validate(CASES["cc05-cc06-nonpositive-noi"][0])["coverage"]
        for check in ("CC-05", "CC-06"):
            self.assertEqual(coverage[check]["status"], "evaluated")


class SpecDataLocationTests(unittest.TestCase):
    """`validate` outside a checkout: UWMD_SPEC_DIR names the spec directory."""

    def run_copy(self, directory, document, environment):
        return subprocess.run([sys.executable, "uwmd.py", "validate", str(document), "--json"],
                              cwd=directory, env=environment, capture_output=True, text=True, encoding="utf-8")

    def test_validate_from_a_copy_outside_the_checkout(self):
        document = ROOT / "conformance/builtin-classes/01-hospitality-fixture/deal.uwx.md"
        here = Path(__file__).resolve().parent
        in_checkout = subprocess.run([sys.executable, str(here / "uwmd.py"), "validate", str(document), "--json"],
                                     capture_output=True, text=True, encoding="utf-8")
        with tempfile.TemporaryDirectory() as temporary:
            copy_dir = Path(temporary) / "elsewhere" / "python"
            copy_dir.mkdir(parents=True)
            for module in here.glob("uwmd*.py"):
                (copy_dir / module.name).write_bytes(module.read_bytes())
            environment = {k: v for k, v in os.environ.items() if k != "UWMD_SPEC_DIR"}
            missing = self.run_copy(copy_dir, document, environment)
            self.assertEqual(missing.returncode, 2)
            self.assertIn("UWMD_SPEC_DIR", missing.stdout)
            environment["UWMD_SPEC_DIR"] = str(ROOT / "spec")
            elsewhere = self.run_copy(copy_dir, document, environment)
        self.assertEqual((elsewhere.returncode, elsewhere.stdout), (in_checkout.returncode, in_checkout.stdout))


def write_cases(directory):
    """Write every case as a `.uwx.md` file, for the reference comparison."""
    Path(directory).mkdir(parents=True, exist_ok=True)
    for name, (raw, _, _) in {**CASES, **SPEC_OVER_REFERENCE}.items():
        (Path(directory) / (name + ".uwx.md")).write_bytes(raw)


if __name__ == "__main__":
    unittest.main()
