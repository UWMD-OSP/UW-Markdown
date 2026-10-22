"""Real validation command/transport evidence, not capability certification."""
import copy
import json
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_reader import HEADER
from test_validation import ROOT, well_formed, validate
from test_validation_external import external
from uwmd import main, _validation_response
from uwmd_reader import parse
from uwmd_source import SourceError
from uwmd_validation_selection import ValidationUnavailable
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import metadata_assessment


def fence(body, *, historical=False):
    annotation="```json uw:section=property"+(" superseded=true" if historical else "")
    return (annotation+"\n"+json.dumps(body,ensure_ascii=True)+"\n```\n").encode()


def property_source():
    return HEADER+well_formed("property",address="A",asset_class="multifamily",
                             units=12,total_units=12,asking_price=100)


class ValidationCLITests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix="uwmd-python-validation-cli-")
        self.addCleanup(self.temporary.cleanup)
        self.path=Path(self.temporary.name)/"input.uwx.md"

    def command(self, raw):
        self.path.write_bytes(raw)
        result=subprocess.run([sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py"),
            "validate",str(self.path),"--json"],capture_output=True,encoding="utf8",timeout=30)
        value=json.loads(result.stdout)  # Fails extra stdout frames/logging.
        self.assertEqual(self.path.read_bytes(),raw)
        return value,result.returncode

    def test_real_command_result_partitions_readiness_and_parse_only_discovery(self):
        result,status=self.command(property_source())
        self.assertEqual(status,0)
        self.assertEqual(result["overall_status"],"clean")
        self.assertEqual(len(result["stage_readiness"]),7)
        self.assertEqual(len(result["coverage"]),15)
        for name,severity in (("errors","error"),("warnings","warning"),("info","info")):
            self.assertEqual(result[name],[i for i in result["issues"] if i["severity"]==severity])
        self.assertEqual(result["replacement_funding_verification"]["state"],"not_checked")
        self.assertNotIn("metadata_assessment",result)
        self.assertNotIn("error",result)
        manifest,status=main(["manifest"])
        self.assertEqual((status,manifest["capabilities"],manifest["profiles"]),(0,["parse", "calc-evaluate", "validate", "verify-reserve-accounts", "verify-reserve-draws"],[]))

    def test_registered_whole_missing_metadata_warning_is_consumed_not_suppressed(self):
        body=dict(address="A",asset_class="multifamily",units=12,total_units=12)
        raw=HEADER+fence(body)
        source=parse(raw);before=copy.deepcopy(source)
        inventory=inspect_source_roles(source)
        self.assertEqual([f["field"] for f in inventory["shape_findings"]],["_meta"])
        report=validate(source)
        self.assertEqual(report["metadata_assessment"]["shape_findings"],[])
        self.assertEqual([i["code"] for i in report["warnings"]],["META_MISSING"])
        result,status=self.command(raw)
        self.assertEqual((status,result["overall_status"]),(0,"warnings"))
        self.assertEqual([i["code"] for i in result["warnings"]],["META_MISSING"])
        self.assertEqual(source,before)

    def test_absence_consumption_requires_exact_covered_authored_block(self):
        body=parse(property_source()).source.blocks[0].parsed.value
        late={"value":1,**body}
        raw=HEADER+fence({"units":12})+fence(late)+fence({"units":12},historical=True)
        source=parse(raw);inventory=inspect_source_roles(source)
        self.assertEqual([f["context"]["block_index"] for f in inventory["shape_findings"]],[0,1])
        for covered in ((),(1,),(2,)):
            local=metadata_assessment(source,inventory,missing_meta_blocks=covered)["shape_findings"]
            # RFC0093's actual P1 owner independently consumes block 1;
            # an unrelated/missing completeness owner cannot consume block 0.
            self.assertEqual([f["context"]["block_index"] for f in local],[0])
        local=metadata_assessment(source,inventory,missing_meta_blocks=(0,1,2))["shape_findings"]
        self.assertEqual(local,[])
        integrated=validate(source)
        # Block 0 is overwritten by block 1 (Format 2.7), so it draws no
        # completeness warning; its missing metadata stays attributed, not
        # unallocated (the reference's population, RFC0093/0094).
        self.assertEqual(sum(i["code"]=="META_MISSING" for i in integrated["issues"]),0)
        self.assertEqual(integrated["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([(i["code"],i["context"]["block_index"],i["field"]) for i in
                          integrated["errors"]], [("META-01",1,"_meta")])

    def test_accepted_metadata_and_0096_payload_have_registered_transport(self):
        body=parse(property_source()).source.blocks[0].parsed.value
        typed=copy.deepcopy(body);typed["_meta"]["quality"]["confidence"]=False
        section=copy.deepcopy(body);section["_meta"]["section"]="wrong"
        late={"value":1,**body}
        for value in (typed,section,late):
            with self.subTest(value=value):
                result,status=self.command(HEADER+fence(value))
                self.assertEqual(status,1)
                self.assertNotIn("error",result)
                self.assertEqual(result["overall_status"],"errors")
                self.assertEqual([i["code"] for i in result["errors"]],
                                 ["META-04" if value is typed else "META-01"])
                self.assertNotIn("metadata_assessment", result)
        # Accepted RFC0096 independently owns missing model_type and unknown model.
        raw=property_source()+well_formed("lease_up_schedule",model="not_registered",
            period_granularity="monthly",stabilization_target="2026-01",
            schedule=[{"period":"2026-01"}])
        result,status=self.command(raw)
        self.assertEqual(status,1)
        self.assertEqual([(i["code"],i["field"]) for i in result["errors"]],
                         [("LU-05","model_type"),("LU-05","model")])
        self.assertNotIn("section_assessment",result)
        self.assertNotIn("error",result)

    def test_actor_and_present_null_meta_use_registered_errors_without_inferred_attribution(self):
        actor=parse(property_source()).source.blocks[0].parsed.value
        del actor["_meta"]["provenance"]["actor"]
        for body in (actor,{"_meta":None}):
            result,status=self.command(HEADER+fence(body))
            self.assertEqual((status,result["overall_status"]),(1,"errors"))
            self.assertEqual([i["code"] for i in result["errors"]],["META-01"])
            self.assertNotIn("error",result)
        malformed={"_meta":{"section":"property"}}
        result,status=self.command(HEADER+fence(malformed))
        self.assertEqual(status,1)
        self.assertNotIn("error",result)
        self.assertIn("META-01",[i["code"] for i in result["errors"]])

    def test_external_composition_refuses_without_cli_null_binding_union(self):
        raw=HEADER+external("property")
        result,status=self.command(raw)
        self.assertEqual(status,1)
        self.assertEqual(result["error"]["code"],"COMP-UNRESOLVED")
        self.assertEqual(result["composition_assessment"]["status"],"unresolved")
        self.assertNotIn("overall_status",result)
        # A consulted source likewise remains unperformed in the private API;
        # the command must never serialize that local None as a V.12 result.
        raw=property_source()+external("debt_structure")
        result,status=self.command(raw)
        self.assertEqual(status,1)
        self.assertNotEqual(result["partial_validation_result"].get(
            "replacement_funding_verification","not_present"),None)

    def test_composition_transport_preserves_first_issue_without_global_directive_priority(self):
        for directive,want in (
            (None,"COMP-DIRECTIVE-MALFORMED"),
            (dict(parts=["a"],part_count=True),"COMP-DIRECTIVE-MALFORMED"),
            (dict(parts=["a","a"],part_count=2),"COMP-DUP-KEY"),
            (dict(parts=["a"],part_count=2),"COMP-COUNT-MISMATCH"),
            (dict(parts=["a","a"],part_count=3,unknown=True),"COMP-DUP-KEY")):
            for earlier_unresolved in (False,True):
                with self.subTest(directive=directive,earlier_unresolved=earlier_unresolved):
                    bad=external("valuation",directive);unresolved=external("rent_roll")
                    raw=property_source()+(unresolved+bad if earlier_unresolved else bad+unresolved)
                    document=parse(raw);before=copy.deepcopy(document)
                    report=validate(document);original=copy.deepcopy(report)
                    result,status=self.command(raw)
                    first_code="COMP-UNRESOLVED" if earlier_unresolved else want
                    self.assertEqual((status,result["error"]["category"],result["error"]["code"]),
                                     (1,"validate",first_code))
                    assessment=report["composition_assessment"];first=assessment["issues"][0]
                    self.assertIn(want,[i["code"] for i in assessment["issues"]])
                    self.assertEqual(result["error"],first)
                    self.assertEqual(result["composition_assessment"],assessment)
                    self.assertEqual(result["partial_validation_result"]["issues"],report["issues"])
                    self.assertFalse(any(i["code"].startswith("COMP-") for i in report["issues"]))
                    self.assertNotIn("overall_status",result)
                    response,exit_code=_validation_response(report)
                    self.assertEqual(exit_code,1)
                    self.assertIsNot(response["error"],first)
                    response["error"]["message"]="consumer edit"
                    self.assertEqual(report,original)
                    self.assertEqual(document,before)
        # Defensive local response if an incomplete provider reports unresolved
        # without an issue; never replace a real first issue with this fallback.
        report=validate(parse(property_source()))
        report["composition_assessment"]={"status":"unresolved","externalized":["rent_roll"],"issues":[]}
        response,status=_validation_response(report)
        self.assertEqual((status,response["error"]["code"]),(1,"COMP-UNRESOLVED"))

    def test_frozen_count_and_missing_part_errors_use_real_cli_without_resolution_claim(self):
        for folder in ("reject/count-mismatch","unresolved/missing-part"):
            root=ROOT/"conformance/composition"/folder
            source=root/"record.uwx.md";raw=source.read_bytes()
            expected=json.loads((root/"expected.json").read_text(encoding="utf8"))
            result,status=self.command(raw)
            self.assertEqual((status,result["error"]["category"],result["error"]["code"]),
                             (1,"validate",expected["expected_code"]))
            self.assertEqual(result["composition_assessment"]["status"],"unresolved")
            self.assertIn("rent_roll",result["composition_assessment"]["externalized"])
            self.assertNotIn("overall_status",result)
            self.assertEqual(source.read_bytes(),raw)
            # Only the frozen code/unresolved assertion is compared; no parts,
            # inline equivalence, canonical form or composition-suite pass.

    def test_blocking_workflow_status_alone_does_not_change_command_failure_policy(self):
        raw=property_source().replace(b"unknown_key: retained",b"blocking_flags:\n  - human_review")
        result,status=self.command(raw)
        self.assertEqual(result["overall_status"],"blocking")
        self.assertEqual(result["errors"],[])
        self.assertEqual(status,0)

    def test_async_stale_binding_refuses_without_mutating_synchronous_partition(self):
        source=ROOT/"conformance/hedge/0070-stale-amount/deal.uwx.md"
        result,status=self.command(source.read_bytes())
        self.assertEqual(status,1)
        self.assertEqual(result["errors"],[])
        self.assertEqual(result["overall_status"],"warnings")
        binding=result["replacement_funding_verification"]
        self.assertEqual((binding["state"],binding["reason"]),("failed","stale_binding"))
        self.assertNotIn("HDG-09",[i["code"] for i in result["issues"]])

    def test_known_parse_refusals_conform_to_actual_protocol_error_schema(self):
        schema=json.loads((ROOT/"spec/schemas/protocol-error.schema.json").read_text(encoding="utf8"))
        self.assertTrue(set(schema)<={"$schema","$id","title","description","type","required",
                                     "additionalProperties","properties","examples"})
        self.assertEqual(schema["type"],"object")
        self.assertIs(schema["additionalProperties"],False)
        for raw,filename,code in (
            (property_source().replace(b'uw_version: "3.0"',b'uw_version: "2.0"'),
                "version.uwx.md","UNSUPPORTED_FORMAT_VERSION"),
            (property_source().replace(b"unknown_key: retained",b"unknown_key: &anchor value"),
                "yaml.uwx.md","UNSUPPORTED_YAML_FEATURE"),
            (property_source(),"carrier.uw.md","SOURCE_CONTENT_MISMATCH")):
            with self.subTest(code=code):
                self.path=Path(self.temporary.name)/filename
                result,status=self.command(raw)
                self.assertEqual(status,1)
                self.assertEqual(set(result),{"error"})
                error=result["error"]
                self.assertEqual((error["category"],error["code"]),("parse",code))
                # Execute every assertion keyword used by this exact schema,
                # read from its unchanged source; this is no general validator.
                self.assertTrue(set(schema["required"])<=set(error))
                self.assertTrue(set(error)<=set(schema["properties"]))
                for name,value in error.items():
                    field=schema["properties"][name]
                    self.assertTrue(set(field)<={"enum","description","type","pattern","minLength"})
                    if "enum" in field:self.assertIn(value,field["enum"])
                    if "type" in field:
                        self.assertEqual(field["type"],"string")
                        self.assertIsInstance(value,str)
                    if "pattern" in field:self.assertIsNotNone(re.search(field["pattern"],value))
                    if "minLength" in field:self.assertGreaterEqual(len(value),field["minLength"])

    def test_unallocated_source_and_selection_refusals_get_no_default_protocol_error(self):
        self.path.write_bytes(property_source())
        with patch("uwmd.parse",side_effect=SourceError("Unallocated source refusal")):
            result,status=main(["validate",str(self.path),"--json"])
            self.assertEqual((result,status),({"error":{"message":"Unallocated source refusal"}},1))
        with patch("uwmd._validate_document",side_effect=ValidationUnavailable("Unallocated selection refusal")):
            result,status=main(["validate",str(self.path),"--json"])
            self.assertEqual((result,status),({"error":{"message":"Unallocated selection refusal"}},1))
        # A real duplicate JSON member is the registered parse refusal (RFC 0106),
        # never a validation result state.
        raw=property_source().replace(b'"address": "A"',b'"address": "A", "address": "B"')
        self.assertNotEqual(raw,property_source())
        result,status=self.command(raw)
        self.assertEqual(status,1)
        self.assertEqual(set(result),{"error"})
        self.assertEqual((result["error"]["code"],result["error"]["category"]),("SOURCE_BLOCK_MALFORMED","parse"))

    def test_source_usage_io_and_internal_failures_are_not_validation_verdicts(self):
        result,status=self.command(property_source().replace(b'uw_version: "3.0"',b'uw_version: "2.0"'))
        self.assertEqual(status,1)
        self.assertEqual(result["error"]["code"],"UNSUPPORTED_FORMAT_VERSION")
        self.assertNotIn("overall_status",result)
        self.assertEqual(main(["validate"])[1],1)
        self.assertEqual(main(["validate",str(self.path),"--wrong"])[1],1)
        self.assertEqual(main(["validate",str(self.path.parent/"absent")])[1],2)
        self.path.write_bytes(property_source())
        with patch("uwmd._validate_document",side_effect=RuntimeError("test failure")):
            result,status=main(["validate",str(self.path),"--json"])
        self.assertEqual(status,2)
        self.assertNotIn("overall_status",result)


if __name__=="__main__":
    unittest.main()
