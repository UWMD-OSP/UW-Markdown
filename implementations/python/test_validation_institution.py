"""Known Format C.6 threshold slice; invalid config policy remains LOCAL/unclosed."""
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
from uwmd_validation_selection import ValidationUnavailable

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
        self.assertIn("local development boundary",response["error"]["message"])
        self.assertNotIn("code",response["error"]);self.assertNotIn("overall_status",response)

    def test_supplied_invalid_inputs_remain_explicit_local_incomplete_not_normative_errors(self):
        for config in (None,False,[],dict(validation_overrides=None),dict(validation_overrides=[]),
                       dict(validation_overrides=dict(dscr_warning_below=None)),
                       dict(validation_overrides=dict(ltv_warning_above=True)),
                       dict(validation_overrides=dict(debt_yield_warning_below=".09")),
                       dict(thresholds=dict(dscr=dict(warning_below=1))),
                       dict(validation_overrides={},thresholds={})):
            with self.subTest(config=config):
                self.sidecar.write_text(json.dumps(config),encoding="utf8")
                response,status=self.command()
                self.assertEqual(status,1);self.assertIn("complete validation is unavailable",response["error"]["message"])
                self.assertNotIn("code",response["error"]);self.assertNotIn("category",response["error"])
                self.assertNotIn("overall_status",response)
        self.sidecar.write_text("{ invalid JSON",encoding="utf8")
        self.assertEqual(self.command()[1],1)
        with patch("uwmd_institution.Path.read_bytes",side_effect=PermissionError("not available")):
            with self.assertRaises(ValidationUnavailable):load_institution_thresholds(self.document)

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


if __name__=="__main__":
    unittest.main()
