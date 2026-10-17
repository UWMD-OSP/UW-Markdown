"""External applicability evidence, not composition or validate CLI conformance."""
import copy
import json
from pathlib import Path
import unittest

from test_reader import HEADER, block
from test_validation import validate, well_formed
from uwmd_reader import parse
from uwmd_validation_core import CC_IDS
from uwmd_validation_selection import current_blocks, select_section

ROOT=Path(__file__).resolve().parents[2]
DIRECTIVE=dict(parts=["part-a"],part_count=1)


def external(section, descriptor=DIRECTIVE, *, variant=None, role=None, **payload):
    body=dict(external=copy.deepcopy(descriptor),**payload)
    if role is not None:body["_role"]=role
    raw=well_formed(section,**body)
    opening,_,rest=raw.partition(b"\n");opening+=b" external=true"
    if variant is not None:opening+=(" variant="+variant).encode()
    return opening+b"\n"+rest


def replace_source_block(document, target, *, externalize=False, body=None):
    attrs=dict(target.attributes)
    if externalize:attrs["external"]="true"
    payload=copy.deepcopy(target.parsed.value) if body is None else body
    if externalize:
        payload={k:v for k,v in payload.items() if k.startswith("_")}
        payload["external"]=copy.deepcopy(DIRECTIVE)
    raw=("~~~json "+" ".join(k+"="+v for k,v in attrs.items())+"\n"
         +json.dumps(payload)+"\n~~~\n").encode()
    original=document.source.raw
    return parse(original[:target.fence_span.start]+raw+original[target.fence_span.end:])


class ValidationExternalTests(unittest.TestCase):
    def test_property_presence_and_exemption_with_local_unresolved_not_new_status(self):
        raw=HEADER.replace(b"unknown_key: retained",b"deal_stage: scope")+external("property")
        parsed=parse(raw);before=copy.deepcopy(parsed);result=validate(parsed)
        self.assertFalse(set(i["code"] for i in result["issues"])&{"CC-14","CC-13","DQ-04"})
        self.assertEqual(result["coverage"]["CC-14"],{"status":"evaluated"})
        self.assertEqual(result["coverage"]["CC-13"]["reason"],"not_applicable")
        self.assertEqual(set(result["coverage"]),set(CC_IDS))
        self.assertFalse(result["stage_readiness"]["scope"])
        self.assertIn(result["overall_status"],("clean","warnings","errors","blocking"))
        assessment=result["composition_assessment"]
        self.assertEqual(assessment["status"],"unresolved")
        self.assertEqual(assessment["externalized"],["property"])
        self.assertEqual([i["code"] for i in assessment["issues"]],["COMP-UNRESOLVED"])
        self.assertTrue(all("severity" not in i for i in assessment["issues"]))
        self.assertIsNotNone(result["replacement_funding_verification"])
        assessment["issues"][0]["message"]="consumer edit"
        self.assertEqual(parsed,before)

    def test_unchanged_frozen_missing_part_is_unresolved_without_partial_merge(self):
        root=ROOT/"conformance/composition/unresolved/missing-part"
        source=root/"record.uwx.md";raw=source.read_bytes();parsed=parse(raw)
        expected=json.loads((root/"expected.json").read_text())
        assessment=validate(parsed)["composition_assessment"]
        self.assertEqual(assessment["status"],expected["status"])
        self.assertIn(expected["expected_code"],[i["code"] for i in assessment["issues"]])
        self.assertEqual(assessment["externalized"],[expected["section_remains_externalized"]])
        self.assertNotIn("units",parsed.source.blocks[0].parsed.value)
        self.assertEqual(parsed.source.raw,raw);self.assertEqual(source.read_bytes(),raw)
        # No actual parts are resolved; this is not a composition-suite pass.

    def test_directive_shape_counts_duplicates_separate_from_unavailable_payload(self):
        for descriptor,want in (
            (None,"COMP-DIRECTIVE-MALFORMED"),
            (dict(parts=[],part_count=0),"COMP-DIRECTIVE-MALFORMED"),
            (dict(parts=["a"],part_count=True),"COMP-DIRECTIVE-MALFORMED"),
            (dict(parts=["a"],part_count=2),"COMP-COUNT-MISMATCH"),
            (dict(parts=["a","a"],part_count=2),"COMP-DUP-KEY"),
            (dict(parts=["a"],part_count=1,collection_key="id"),"COMP-DIRECTIVE-MALFORMED"),
            (dict(parts=["a"],part_count=1,unknown=1),"COMP-DIRECTIVE-MALFORMED")):
            with self.subTest(descriptor=descriptor):
                result=validate(parse(HEADER+external("dc_capacity",descriptor)))
                self.assertEqual(result["composition_assessment"]["status"],"unresolved")
                self.assertIn(want,[i["code"] for i in result["composition_assessment"]["issues"]])
                self.assertNotIn("CLS-04",[i["code"] for i in result["issues"]])
                self.assertFalse(any(i["code"].startswith("COMP-") for i in result["issues"]))

    def test_payload_rules_skipped_while_physical_source_role_metadata_checked(self):
        raw=HEADER.replace(b"asset_class: multifamily",b"asset_class: data_center")
        raw+=external("dc_capacity",role="invented")
        raw+=external("cash_flow_series",variant="cash")
        raw+=external("reserve_accounts",variant="reserve")
        raw+=external("distribution_waterfall",variant="waterfall")
        result=validate(parse(raw));codes=[i["code"] for i in result["issues"]]
        self.assertIn("ROLE-01",codes)
        self.assertFalse(set(codes)&{"CLS-03","CLS-04"})
        self.assertFalse(any(c.startswith(("CF-","RSV-","WF-")) for c in codes))
        self.assertEqual(result["composition_assessment"]["externalized"],
                         ["dc_capacity","cash_flow_series","reserve_accounts","distribution_waterfall"])

    def test_external_payload_member_without_marker_remains_inline_data(self):
        parsed=parse(HEADER+well_formed("property",external={"ordinary":"payload"},total_units=2))
        result=validate(parsed)
        self.assertEqual(result["composition_assessment"],dict(status="resolved",externalized=[],issues=[]))
        self.assertEqual(result["coverage"]["CC-13"]["status"],"evaluated")
        self.assertEqual(current_blocks(parsed,"property")[0].parsed.value["external"],{"ordinary":"payload"})

    def test_current_history_and_exact_role_selection_before_unavailability(self):
        raw=HEADER+external("property")+well_formed("property",total_units=1)
        self.assertEqual(validate(parse(raw))["composition_assessment"]["status"],"resolved")
        raw=HEADER+well_formed("rent_roll",gross_potential_rent=100)
        raw+=external("operating_statement",variant="t12",role="summary")
        raw+=block("operating_statement",{"gross_potential_rent":100},variant="other",role="primary")
        parsed=parse(raw);selection=select_section(parsed,"operating_statement",preferred_key="t12")
        self.assertTrue(selection.externalized);self.assertIsNone(selection.block)
        result=validate(parsed)
        self.assertEqual(result["coverage"]["CC-01"]["reason"],"field_absent")
        self.assertIn("externalized",result["coverage"]["CC-01"]["detail"])
        self.assertFalse(any(i["code"]=="CC-16" and i["section"]=="operating_statement" for i in result["issues"]))
        history=external("property").replace(b" external=true",b" external=true superseded=true",1)
        parsed=parse(HEADER+history+well_formed("property",total_units=2))
        self.assertEqual(validate(parsed)["composition_assessment"]["status"],"resolved")

    def test_exact_role_collision_does_not_fall_back_from_external_source(self):
        raw=HEADER+external("debt_structure",variant="a",role="senior")
        raw+=block("debt_structure",{"loan_amount":100},variant="b",role="senior")
        raw+=well_formed("valuation",purchase_price=100)
        result=validate(parse(raw))
        self.assertEqual(result["coverage"]["CC-02"]["reason"],"variant_unresolvable")
        self.assertTrue(any(i["code"]=="CC-16" for i in result["issues"]))
        self.assertIsNotNone(result["replacement_funding_verification"])

    def test_external_cash_identity_not_missing_for_waterfall_and_recovery(self):
        tenant=dict(recovery_true_up=[dict(period_start="2025-01-01",period_end="2025-12-31",
                                         cash_flow_ref={"variant":"cash"})])
        raw=HEADER+external("cash_flow_series",variant="cash")
        raw+=well_formed("rent_roll",tenants=[tenant])
        raw+=well_formed("distribution_waterfall",cash_flow_ref={"variant":"cash"},
            equity_split={"lp":.9,"gp":.1},tiers=[dict(type="split",lp_share=.9,gp_share=.1)],
            clawback=dict(basis="lp_em_floor",floor_multiple=1,cap="promote_received"))
        result=validate(parse(raw));codes=[i["code"] for i in result["issues"]]
        self.assertFalse(set(codes)&{"WF-02","WF-03","WF-15","REC-09"})
        self.assertEqual(result["composition_assessment"]["status"],"unresolved")

    def test_external_components_presence_enforces_asset_class_boundary(self):
        result=validate(parse(HEADER+external("components")))
        self.assertIn("CC-11",[i["code"] for i in result["issues"]])
        self.assertNotIn("MU-01",[i["code"] for i in result["issues"]])
        self.assertEqual(result["coverage"]["CC-11"]["status"],"evaluated")

    def test_only_consulted_external_dependencies_withhold_local_v12(self):
        source=ROOT/"conformance/hedge/0070-stale-amount/deal.uwx.md"
        raw=source.read_bytes();base=parse(raw)
        expected=validate(base)["replacement_funding_verification"]
        self.assertEqual(expected["state"],"failed")
        for section in ("debt_structure","sources_uses","cash_flow_series"):
            with self.subTest(section=section):
                target=next(b for b in base.source.blocks if b.section==section)
                result=validate(replace_source_block(base,target,externalize=True))
                self.assertIsNone(result["replacement_funding_verification"])
                self.assertEqual(result["composition_assessment"]["status"],"unresolved")
                self.assertFalse(any(i["code"].startswith(("HDG-","ESC-")) for i in result["issues"]))
        for extra in (external("market_analysis"),external("cash_flow_series",variant="unselected"),
                      external("debt_structure",variant="unselected",role="component")):
            with self.subTest(extra=extra[:80]):
                result=validate(parse(raw+extra))
                self.assertEqual(result["composition_assessment"]["status"],"unresolved")
                self.assertEqual(result["replacement_funding_verification"],expected)
        self.assertEqual(source.read_bytes(),raw);self.assertEqual(base.source.raw,raw)

    def test_cash_not_consulted_after_invalid_funding_keeps_known_refusal(self):
        raw=(ROOT/"conformance/hedge/0070-stale-amount/deal.uwx.md").read_bytes()
        base=parse(raw);debt=next(b for b in base.source.blocks if b.section=="debt_structure")
        body=copy.deepcopy(debt.parsed.value)
        body["rate_hedge"]["replacement_funding"]={"mode":"unknown"}
        candidate=replace_source_block(base,debt,body=body)
        cash=next(b for b in candidate.source.blocks if b.section=="cash_flow_series")
        result=validate(replace_source_block(candidate,cash,externalize=True))
        self.assertIsNotNone(result["replacement_funding_verification"])
        self.assertEqual(result["replacement_funding_verification"]["state"],"unverifiable")
        self.assertIn("HDG-07",[i["code"] for i in result["issues"]])


if __name__=="__main__":
    unittest.main()
