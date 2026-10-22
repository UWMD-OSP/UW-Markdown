"""Integrated Format 5.1 readiness/declared gaps, not complete validation."""
import copy
import unittest

from test_reader import HEADER, block
from test_validation import validate, well_formed
from test_validation_external import external
from uwmd_reader import parse
from uwmd_validation_core import STAGES, stage_readiness

# Independent transcription of the Format 5.1 cumulative table, not imported
# production REQUIRED/sections_required; field readiness is scope-specific.
TABLE = {
    "scope": "property",
    "screening": "property debt_structure validation",
    "term_sheet": "property debt_structure validation rent_roll borrower_sponsor preliminary_sizing",
    "full_underwrite": "property debt_structure validation rent_roll borrower_sponsor preliminary_sizing operating_statement noi_model valuation sources_uses market_analysis",
    "credit_approval": "property debt_structure validation rent_roll borrower_sponsor preliminary_sizing operating_statement noi_model valuation sources_uses market_analysis dcf stress_tests risk_assessment compliance assumptions",
    "closing": "property debt_structure validation rent_roll borrower_sponsor preliminary_sizing operating_statement noi_model valuation sources_uses market_analysis dcf stress_tests risk_assessment compliance assumptions due_diligence",
    "monitoring": "property debt_structure validation rent_roll borrower_sponsor preliminary_sizing operating_statement noi_model valuation sources_uses market_analysis dcf stress_tests risk_assessment compliance assumptions due_diligence",
}
ASSETS = ("multifamily", "office", "retail", "industrial", "self_storage",
          "hospitality", "mixed_use", "senior_housing", "student_housing",
          "land", "data_center", "manufactured_housing", "unrecognized")


def requirements(stage, asset):
    sections = TABLE[stage].split()
    if asset == "land":
        sections = [s for s in sections if s not in ("rent_roll", "operating_statement")]
    elif asset == "mixed_use":
        sections = ["components" if s in ("rent_roll", "operating_statement") else s for s in sections]
    if stage != "scope" and asset in ("data_center", "manufactured_housing"):
        sections.append("dc_capacity" if asset == "data_center" else "mhc_sites")
    return tuple(dict.fromkeys(sections))


def header(stage="scope", asset="multifamily"):
    return HEADER.replace(b"unknown_key: retained", ("deal_stage: " + stage).encode()).replace(
        b"asset_class: multifamily", ("asset_class: " + asset).encode())


def property_block(**values):
    return well_formed("property", **{"address": "A", "asset_class": "multifamily", "total_units": 0, "rentable_square_feet": 1, "gross_leasable_area": 1, "net_rentable_square_feet": 1, "keys": 1, "total_beds": 1, "gross_acres": 1, "critical_it_load_kw": 1, "total_sites": 1, **values})


def declared_document(stage, asset, omitted=None):
    raw = header(stage, asset)
    for section in requirements(stage, asset):
        if section != omitted:
            raw += property_block(asset_class=asset) if section == "property" else well_formed(section, stated=True)
    if omitted != "valuation":
        raw += well_formed("valuation", purchase_price=1)
    return parse(raw)


class ValidationReadinessTests(unittest.TestCase):
    def test_all_seven_tables_all_twelve_classes_and_unknown_base_overlay(self):
        self.assertEqual(set(TABLE), set(STAGES))
        for asset in ASSETS:
            for stage in STAGES:
                with self.subTest(asset=asset, stage=stage):
                    parsed = declared_document(stage, asset)
                    before = copy.deepcopy(parsed)
                    result = validate(parsed)
                    self.assertTrue(result["stage_readiness"][stage])
                    self.assertFalse(any(i["code"] == "DQ-06" for i in result["issues"]))
                    self.assertEqual(set(result["stage_readiness"]), set(TABLE))
                    self.assertTrue(all(type(value) is bool for value in result["stage_readiness"].values()))
                    self.assertEqual(parsed, before)

    def test_each_missing_required_section_has_exact_declared_gap_and_presence_verdict(self):
        for asset in ("multifamily", "land", "mixed_use", "data_center", "manufactured_housing"):
            for stage in STAGES:
                for missing in requirements(stage, asset):
                    with self.subTest(asset=asset, stage=stage, missing=missing):
                        result = validate(declared_document(stage, asset, missing))
                        self.assertFalse(result["stage_readiness"][stage])
                        gaps = [(i["section"], i["severity"]) for i in result["issues"] if i["code"] == "DQ-06"]
                        self.assertEqual(gaps, [] if missing == "property" else [(missing, "info")])
                        if missing == "property":
                            self.assertEqual([i["severity"] for i in result["issues"] if i["code"] == "CC-14"], ["warning"])

    def test_scope_uses_eligible_primary_not_later_component_or_invalid_role(self):
        primary = parse(HEADER + property_block()).source.blocks[0].parsed.value
        for role in ("component", "invalid"):
            with self.subTest(role=role):
                raw = header() + block("property", primary, variant="selected", role="primary")
                raw += block("property", {"address": None, "units": None}, variant="later", role=role)
                parsed = parse(raw); before = copy.deepcopy(parsed); result = validate(parsed)
                self.assertTrue(result["stage_readiness"]["scope"])
                self.assertFalse(any(i["code"] == "DQ-04" for i in result["issues"]))
                self.assertEqual(parsed, before)

    def test_unresolvable_scope_does_not_select_last_physical_peer(self):
        for roles in (("primary", "primary"), ("component", "component")):
            with self.subTest(roles=roles):
                raw = header()
                for variant, role in zip(("a", "b"), roles):
                    body = parse(HEADER + property_block()).source.blocks[0].parsed.value
                    raw += block("property", body, variant=variant, role=role)
                result = validate(parse(raw))
                self.assertFalse(result["stage_readiness"]["scope"])
                self.assertTrue(any(i["code"] == "CC-16" and i["section"] == "property"
                                    for i in result["issues"]))

    def test_scope_field_presence_distinguishes_null_zero_without_type_coercion(self):
        for values, ready, missing in (
            ({}, True, []), ({"total_units": None}, False, ["property.total_units|valuation.purchase_price"]),
            ({"address": None}, False, ["address"]),
            ({"asset_class": None}, False, ["asset_class"]),
            ({"address": ""}, False, ["address"]),
            ({"asset_class": ""}, False, ["asset_class"]),
            ({"total_units": ""}, False, ["property.total_units|valuation.purchase_price"]),
            ({"total_units": False, "address": " ", "asset_class": " "}, True, []),
            ({"total_units": " "}, True, [])):
            with self.subTest(values=values):
                parsed = parse(header() + property_block(**values)); before = copy.deepcopy(parsed)
                result = validate(parsed)
                self.assertIs(result["stage_readiness"]["scope"], ready)
                self.assertEqual([i["field"] for i in result["issues"] if i["code"] == "DQ-04"], missing)
                self.assertEqual(parsed, before)
        # DQ-04 checks presence; this does not certify string/count field types,
        # infer zero, trim whitespace, or establish malformed full input is valid.

    def test_presence_readiness_does_not_inherit_unstated_future_field_claims(self):
        raw = header("screening") + well_formed("property") + well_formed("debt_structure") + well_formed("validation")
        result = validate(parse(raw))
        self.assertFalse(result["stage_readiness"]["scope"])
        self.assertFalse(result["stage_readiness"]["screening"])
        self.assertFalse(result["stage_readiness"]["term_sheet"])
        self.assertFalse(any(i["code"] == "DQ-04" for i in result["issues"]))
        self.assertEqual({i["section"] for i in result["issues"] if i["code"] == "DQ-06"}, {"property", "debt_structure", "validation"})
        # The table reports section presence, not cleared diligence/final loan
        # terms or a guarantee that every previous stage's fields are complete.

    def test_selected_external_property_stays_unavailable_despite_later_inline_component(self):
        raw = header() + external("property", variant="selected", role="primary")
        body = parse(HEADER + property_block()).source.blocks[0].parsed.value
        raw += block("property", body, variant="later", role="component")
        parsed = parse(raw); before = copy.deepcopy(parsed); result = validate(parsed)
        self.assertFalse(result["stage_readiness"]["scope"])
        self.assertFalse(any(i["code"] in ("DQ-04", "CC-13", "CC-14") for i in result["issues"]))
        self.assertEqual(result["composition_assessment"]["status"], "unresolved")
        self.assertEqual(parsed, before)

    def test_external_presence_history_and_current_head_are_distinct(self):
        raw = header("monitoring")
        for section in requirements("monitoring", "multifamily"):
            raw += external(section)
        result = validate(parse(raw))
        self.assertFalse(result["stage_readiness"]["scope"])
        self.assertFalse(any(result["stage_readiness"].values()))
        self.assertFalse(any(i["code"] == "DQ-06" for i in result["issues"]))
        raw = header() + block("property", {"address": "A", "asset_class": "multifamily", "total_units": 1}, superseded=True)
        self.assertFalse(stage_readiness(parse(raw))["scope"])
        raw += property_block(total_units=None)
        self.assertFalse(stage_readiness(parse(raw))["scope"])
        raw += property_block()
        self.assertTrue(stage_readiness(parse(raw))["scope"])


if __name__ == "__main__":
    unittest.main()
