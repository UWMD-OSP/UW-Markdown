"""Accepted RFC0097 config transport in the developing validation operation."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from uwmd_institution import load_institution_thresholds
from uwmd_reader import parse
from uwmd_validation import _validate_source,validate_document
from uwmd_validation_cross import _default_threshold_bands
from uwmd_institution_config import _InstitutionConfigError
from uwmd import main

ROOT=Path(__file__).resolve().parents[2]
FIXTURE=ROOT/"conformance/documents/fixtures/02-full-multifamily.uwx.md"
CLI=Path(__file__).with_name("uwmd.py")


class InstitutionThresholdTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix="uwmd-institution-354-")
        self.addCleanup(self.temporary.cleanup)
        self.folder=Path(self.temporary.name);self.document_folder=self.folder/"records";self.document_folder.mkdir()
        self.document=self.document_folder/"deal.uwx.md";self.raw=FIXTURE.read_bytes();self.document.write_bytes(self.raw)
        self.sidecar=self.document_folder/".uw.institution.json"

    def config(self,overrides,path=None):
        target=path or self.sidecar
        target.write_text(json.dumps(dict(institution_id="fixture-policy",validation_overrides=overrides)),encoding="utf8")
        return target

    def command(self,*flags):
        files={p:p.read_bytes() for p in self.folder.rglob("*") if p.is_file()}
        process=subprocess.run([sys.executable,"-B",str(CLI),"validate",str(self.document),*flags,"--json"],
            cwd=self.folder,capture_output=True,encoding="utf8",timeout=30)
        result=json.loads(process.stdout)
        self.assertEqual(process.stderr,"")
        self.assertEqual({p:p.read_bytes() for p in files},files)
        self.assertEqual(FIXTURE.read_bytes(),self.raw)
        return result,process.returncode

    def test_exact_three_mappings_preserve_detached_default_bands_and_other_data(self):
        self.config(dict(dscr_warning_below=1.25,ltv_warning_above=.7,debt_yield_warning_below=.09,
                         an_unknown_preference=dict(opaque=True)))
        first=load_institution_thresholds(self.document);before=copy.deepcopy(first)
        defaults=_default_threshold_bands()
        self.assertEqual(first,dict(dscr=dict(error_below=1.0,warning_below=1.25),
                                   ltv=dict(warning_above=.7,error_above=.85),debt_yield=dict(warning_below=.09)))
        first["dscr"]["error_below"]=-1
        self.assertEqual(load_institution_thresholds(self.document),before)
        self.assertEqual(_default_threshold_bands(),defaults)
        for key in ("ltv","debt_yield"):
            self.config({"dscr_warning_below":1.25})
            self.assertNotIn(key,load_institution_thresholds(self.document))

    def test_actual_cli_all_three_below_equal_above_controls(self):
        # Values are already stated in the unchanged positive frozen record.
        for key,code,controls in (
                ("dscr_warning_below","FV-04",((1.108,False),(1.109,False),(1.110,True))),
                ("ltv_warning_above","FV-09",((.699,True),(.7,False),(.701,False))),
                ("debt_yield_warning_below","FV-03",((.0786,False),(.0787,False),(.0788,True)))):
            for bound,expected in controls:
                with self.subTest(key=key,bound=bound):
                    self.config({key:bound});result,status=self.command()
                    self.assertEqual(status,0)
                    found=[i for i in result["issues"] if i["code"]==code]
                    self.assertEqual(bool(found),expected)
                    self.assertTrue(all(i["severity"]=="warning" for i in found))

    def test_actual_cli_explicit_path_is_cwd_relative_and_overrides_adjacent_file(self):
        self.config(dict(dscr_warning_below=1.110))
        selected=self.config(dict(dscr_warning_below=1.108),self.folder/"selected.json")
        self.assertTrue(any(i["code"]=="FV-04" for i in self.command()[0]["issues"]))
        for flags in (("--institution",selected.name),("--institution="+selected.name,)):
            result,status=self.command(*flags)
            self.assertEqual(status,0)
            self.assertFalse(any(i["code"]=="FV-04" for i in result["issues"]))
        # Discovery uses the actual document directory, not cwd.
        self.config(dict(dscr_warning_below=1.110),self.folder/".uw.institution.json")
        self.config(dict(dscr_warning_below=1.108))
        self.assertFalse(any(i["code"]=="FV-04" for i in self.command()[0]["issues"]))

    def test_auto_absence_keeps_defaults_and_supplied_missing_never_falls_back(self):
        self.assertEqual(load_institution_thresholds(self.document),{})
        result,status=self.command();self.assertEqual(status,0)
        self.assertTrue(any(i["code"]=="FV-04" for i in result["warnings"]))
        self.config(dict(dscr_warning_below=1.108))
        response,status=self.command("--institution","missing.json")
        self.assertEqual(status,1)
        self.assertEqual(response,dict(error=dict(category="validate",code="VAL-INSTITUTION-CONFIG-UNREADABLE",
                                                message="Selected institution config could not be read.")))

    def test_supplied_invalid_inputs_have_exact_error_only_transport(self):
        for config in (None,False,[],dict(validation_overrides=None),dict(validation_overrides=[]),
                       dict(validation_overrides=dict(dscr_warning_below=None)),
                       dict(validation_overrides=dict(ltv_warning_above=True)),
                       dict(validation_overrides=dict(debt_yield_warning_below=".09")),
                       dict(thresholds=dict(dscr=dict(warning_below=1))),
                       dict(validation_overrides={},thresholds={})):
            with self.subTest(config=config):
                self.sidecar.write_text(json.dumps(config),encoding="utf8")
                response,status=self.command()
                self.assertEqual(status,1)
                expected=dict(category="validate",code="VAL-INSTITUTION-CONFIG-MALFORMED",
                              message="Selected institution config is malformed.")
                if isinstance(config,dict):
                    if "thresholds" in config:expected["pointer"]="thresholds"
                    elif not isinstance(config.get("validation_overrides"),dict):expected["pointer"]="validation_overrides"
                    else:
                        name=next(iter(config["validation_overrides"]))
                        expected["pointer"]="validation_overrides."+name
                self.assertEqual(response,dict(error=expected))
        self.sidecar.write_text("{ invalid JSON",encoding="utf8")
        self.assertEqual(self.command()[1],1)
        with patch("uwmd_institution_config.Path.read_bytes",side_effect=PermissionError("not available")):
            with self.assertRaises(_InstitutionConfigError):load_institution_thresholds(self.document)

    def test_no_new_range_rules_and_no_exhaustive_unknown_key_vocabulary(self):
        for number in (-10,0,3.5):
            self.config(dict(dscr_warning_below=number))
            self.assertEqual(load_institution_thresholds(self.document)["dscr"]["warning_below"],number)
        self.sidecar.write_text(json.dumps(dict(opaque_unknown=dict(value=False),validation_overrides=dict(other_unknown=None))),encoding="utf8")
        self.assertEqual(load_institution_thresholds(self.document),{})

    def test_pure_apis_do_not_discover_or_read_sidecar_and_accept_nested_maps(self):
        self.sidecar.write_text("{ invalid JSON",encoding="utf8")
        document=parse(self.raw);before=copy.deepcopy(document)
        thresholds=dict(dscr=dict(warning_below=1.108,error_below=1.0));prior=copy.deepcopy(thresholds)
        with patch("uwmd_institution.load_institution_thresholds",side_effect=AssertionError("pure API must not load config")):
            model=asyncio.run(validate_document(document,thresholds=thresholds))
            source=asyncio.run(_validate_source(self.raw,filename=str(self.document),thresholds=thresholds))
        for result in (model,source):
            self.assertFalse(any(i["code"]=="FV-04" for i in result["issues"]))
        self.assertEqual(document,before);self.assertEqual(thresholds,prior)
        self.assertEqual(self.document.read_bytes(),self.raw)


    def test_atomic_error_refuses_before_validation_or_binding(self):
        self.sidecar.write_bytes(b'{"validation_overrides":{"dscr_warning_below":1.108,"ltv_warning_above":"private-bad-value"}}')
        before=self.sidecar.read_bytes()
        with patch("uwmd._validate_document",side_effect=AssertionError("validation must not start")),patch(
                "uwmd_validation._binding_verify",side_effect=AssertionError("binding must not start")):
            value,status=main(["validate",str(self.document),"--json"])
        self.assertEqual((status,value),(1,dict(error=dict(category="validate",
            code="VAL-INSTITUTION-CONFIG-MALFORMED",message="Selected institution config is malformed.",
            pointer="validation_overrides.ltv_warning_above"))))
        self.assertEqual(self.sidecar.read_bytes(),before);self.assertEqual(self.document.read_bytes(),self.raw)

    def test_fatal_actual_source_precedes_config_but_document_issues_do_not(self):
        self.sidecar.write_bytes(b'{ invalid config }')
        for raw in (self.raw.replace(b'uw_version: "3.0"',b'uw_version: "2.0"'),
                    self.raw.replace(b'asset_class: multifamily',b'asset_class: &anchor value')):
            self.document.write_bytes(raw)
            with patch("uwmd_institution.load_institution_thresholds",side_effect=AssertionError("config must wait for fatal parse")):
                value,status=main(["validate",str(self.document),"--json"])
            self.assertEqual(status,1);self.assertEqual(value["error"]["category"],"parse")
            self.assertNotIn("INSTITUTION",value["error"]["code"])
            self.assertEqual(self.document.read_bytes(),raw)
        # A parseable document's ordinary metadata errors must wait for config.
        raw=self.raw.replace(b'"human_review_required": false',b'"human_review_required": null')
        self.document.write_bytes(raw)
        value,status=main(["validate",str(self.document),"--json"])
        self.assertEqual(status,1);self.assertEqual(set(value),{"error"})
        self.assertEqual(value["error"]["code"],"VAL-INSTITUTION-CONFIG-MALFORMED")
        self.assertEqual(self.document.read_bytes(),raw)

    def test_actual_cli_opaque_overflow_unicode_and_atomic_failure(self):
        self.sidecar.write_bytes(b'{"opaque":1e309,"unknown":"\\ud83d\\ude00","validation_overrides":{"dscr_warning_below":1.108}}')
        value,status=self.command()
        self.assertEqual(status,0);self.assertNotIn("FV-04",[i["code"] for i in value["issues"]])
        for raw in (b'{"opaque":"\\ud800","validation_overrides":{"dscr_warning_below":1.108}}',
                    b'{"opaque":{"x":1,"\\u0078":2}}'):
            self.sidecar.write_bytes(raw);value,status=self.command()
            self.assertEqual((status,value),(1,dict(error=dict(category="validate",
                code="VAL-INSTITUTION-CONFIG-MALFORMED",message="Selected institution config is malformed."))))
        self.sidecar.write_bytes(b'{"validation_overrides":{"dscr_warning_below":1.108,"ltv_warning_above":null}}')
        value,status=self.command()
        self.assertEqual(status,1);self.assertEqual(set(value),{"error"})
        self.assertEqual(value["error"]["pointer"],"validation_overrides.ltv_warning_above")

    def test_actual_nonjson_refusal_has_stderr_only_no_result_claim(self):
        self.sidecar.write_bytes(b'{ private invalid bytes }')
        for flags,code in (([],"VAL-INSTITUTION-CONFIG-MALFORMED"),
                (["--institution","missing.json"],"VAL-INSTITUTION-CONFIG-UNREADABLE")):
            process=subprocess.run([sys.executable,"-B",str(CLI),"validate",str(self.document),*flags],
                cwd=self.folder,capture_output=True,encoding="utf8",timeout=30)
            self.assertEqual(process.returncode,1);self.assertEqual(process.stdout,"")
            self.assertIn(code,process.stderr);self.assertNotIn("private invalid",process.stderr)
            self.assertNotIn("partial_validation_result",process.stderr)

    def test_resource_or_runtime_failure_is_internal_not_malformed(self):
        self.sidecar.write_bytes(b'{}')
        for error in (RecursionError("resource boundary"),MemoryError("resource boundary"),RuntimeError("test defect")):
            with patch("uwmd_institution_config.json.loads",side_effect=error):
                value,status=main(["validate",str(self.document),"--json"])
            self.assertEqual(status,2);self.assertNotIn("code",value["error"])
            self.assertNotIn("MALFORMED",value["error"]["message"])

    def test_configured_then_default_same_process_and_nonvalidation_io_isolation(self):
        self.config(dict(dscr_warning_below=1.108))
        configured,status=main(["validate",str(self.document),"--json"])
        self.assertEqual(status,0);self.assertNotIn("FV-04",[i["code"] for i in configured["issues"]])
        self.sidecar.unlink()
        default,status=main(["validate",str(self.document),"--json"])
        self.assertEqual(status,0);self.assertIn("FV-04",[i["code"] for i in default["issues"]])
        self.sidecar.write_bytes(b'{ invalid selected config }')
        with patch("uwmd_institution.load_institution_thresholds",side_effect=AssertionError("not a validation operation")):
            for args in (["parse",str(self.document)],["calc",str(self.document),"1+1","--json"],
                         ["verify-reserve-accounts",str(self.document),"--json"]):
                result,status=main(args);self.assertEqual(status,0)
        self.assertEqual(self.document.read_bytes(),self.raw)

    def test_actual_cli_document_symlink_uses_invocation_parent_sidecar(self):
        links=self.folder/"links";links.mkdir();link=links/"linked.uwx.md"
        try:link.symlink_to(self.document)
        except OSError as error:self.skipTest("This host cannot create symlinks: "+str(error))
        self.sidecar.write_bytes(b'{ invalid target-directory config }')
        selected=links/".uw.institution.json";selected.write_bytes(b'{"validation_overrides":{"dscr_warning_below":1.108}}')
        before=selected.read_bytes()
        process=subprocess.run([sys.executable,"-B",str(CLI),"validate",str(link),"--json"],
            cwd=self.folder,capture_output=True,encoding="utf8",timeout=30)
        value=json.loads(process.stdout)
        self.assertEqual(process.returncode,0);self.assertEqual(process.stderr,"")
        self.assertNotIn("FV-04",[i["code"] for i in value["issues"]])
        self.assertEqual(selected.read_bytes(),before);self.assertEqual(self.document.read_bytes(),self.raw)


if __name__=="__main__":
    unittest.main()
