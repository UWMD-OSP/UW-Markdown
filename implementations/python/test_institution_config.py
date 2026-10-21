"""Independent main-safe accepted RFC0097 controls; no WIP-validator imports."""
import copy
import json
import math
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from uwmd_institution_config import (_InstitutionConfigError,_parse_institution_config,
    _load_institution_config,_institution_threshold_map)


class InstitutionConfigTests(unittest.TestCase):
    def refused(self,raw,pointer=None):
        with self.assertRaises(_InstitutionConfigError) as caught:_parse_institution_config(raw)
        expected=dict(category="validate",code="VAL-INSTITUTION-CONFIG-MALFORMED",
                      message="Selected institution config is malformed.")
        if pointer is not None:expected["pointer"]=pointer
        self.assertEqual(caught.exception.projection(),expected)
        self.assertEqual(str(caught.exception),expected["message"])
        return caught.exception

    def test_root_carrier_and_exact_primary_order(self):
        for value in (None,False,1,"text",[]):self.refused(json.dumps(value).encode())
        for value in (None,False,1,"text",[]):
            self.refused(json.dumps(dict(validation_overrides=value)).encode(),"validation_overrides")
        self.refused(b'{"validation_overrides":null,"thresholds":null}',"thresholds")
        self.refused(b'{"thresholds":{}}',"thresholds")
        raw=b'{"validation_overrides":{"debt_yield_warning_below":null,"ltv_warning_above":false,"dscr_warning_below":"bad"}}'
        self.refused(raw,"validation_overrides.dscr_warning_below")
        self.refused(b'{"validation_overrides":{"debt_yield_warning_below":null,"ltv_warning_above":false}}',"validation_overrides.ltv_warning_above")

    def test_strict_whole_json_utf8_bom_whitespace_and_no_causes(self):
        for raw in (b'',b' ',b'\xef\xbb\xbf{}',b'\xff',b'{ secret }',b'{}{}',b'{}x',
                    b'{}\x0b',b'NaN',b'Infinity',b'{"a":NaN}',b'{"a":-Infinity}',b'{"a":01}'):
            with self.subTest(raw=raw):
                error=self.refused(raw)
                self.assertNotIn("cause",error.projection());self.assertNotIn("secret",str(error))
        self.assertEqual(_parse_institution_config(b' \t\r\n{}\t\r\n '),{})

    def test_decoded_duplicates_in_every_object_without_normalization(self):
        for raw in (b'{"a":1,"a":2}',b'{"a":1,"\\u0061":2}',
                    b'{"opaque":[{"x":1,"x":2}]}',
                    b'{"validation_overrides":{"dscr_warning_below":1,"\\u0064scr_warning_below":2}}'):
            self.refused(raw)
        # Canonically equivalent but distinct strings are not normalized.
        self.assertEqual(_parse_institution_config('{"é":1,"e\u0301":2}'.encode()),{})

    def test_all_unicode_keys_and_values_including_opaque_data(self):
        for token in ('"\\ud800"','"\\udfff"','"x\\ud800y"'):
            for text in ('{'+token+':0}','{"opaque":'+token+'}',
                         '{"opaque":[{"child":'+token+'}]}'):
                self.refused(text.encode())
        self.assertEqual(_parse_institution_config(b'{"opaque":"\\ud83d\\ude00"}'),{})
        self.assertEqual(_parse_institution_config('{"😀":"é"}'.encode()),{})
        self.refused(b'{"thresholds":{},"opaque":"\\ud800"}')  # Profile precedes root shape.

    def test_known_leaf_finite_binary64_domains_and_opaque_numbers(self):
        for name in ("dscr_warning_below","ltv_warning_above","debt_yield_warning_below"):
            pointer="validation_overrides."+name
            for value in (None,False,True,"1",[],{}):
                self.refused(json.dumps(dict(validation_overrides={name:value})).encode(),pointer)
            for spelling in ("1e309","-1e309"):
                self.refused(('{"validation_overrides":{"'+name+'":'+spelling+'}}').encode(),pointer)
            for spelling,value in (("-10",-10),("0",0),("-0",-0.0),(".5",None),
                                   ("1.25",1.25),("1e-400",0),("1.7976931348623157e308",math.nextafter(math.inf,0))):
                if value is None:continue  # Leading-dot syntax is tested as JSON failure below.
                self.assertEqual(_parse_institution_config(('{"validation_overrides":{"'+name+'":'+spelling+'}}').encode()),{name:value})
        self.refused(b'{"validation_overrides":{"dscr_warning_below":.5}}')
        opaque=b'{"opaque":1e309,"negative":-1e309,"huge":'+b'9'*5000+b',"validation_overrides":{"unknown":1e309,"dscr_warning_below":1.2}}'
        self.assertEqual(_parse_institution_config(opaque),dict(dscr_warning_below=1.2))

    def test_atomic_admission_then_fresh_bands_no_new_ranges(self):
        self.refused(b'{"validation_overrides":{"dscr_warning_below":1.1,"ltv_warning_above":"bad"}}',"validation_overrides.ltv_warning_above")
        defaults=dict(dscr=dict(error_below=1,warning_below=1.2),ltv=dict(warning_above=.75,error_above=.85),
                      debt_yield=dict(warning_below=.07),other=dict(opaque=[1]))
        before=copy.deepcopy(defaults)
        admitted=_parse_institution_config(b'{"opaque":{"thresholds":null},"validation_overrides":{"unknown":{},"dscr_warning_below":-10,"ltv_warning_above":0,"debt_yield_warning_below":3.5}}')
        prior=copy.deepcopy(admitted);result=_institution_threshold_map(admitted,defaults)
        self.assertEqual(result,dict(dscr=dict(error_below=1,warning_below=-10),
                         ltv=dict(warning_above=0,error_above=.85),debt_yield=dict(warning_below=3.5)))
        result["dscr"]["error_below"]=-1
        self.assertEqual(defaults,before);self.assertEqual(admitted,prior)
        self.assertEqual(_institution_threshold_map({},defaults),{})

    def test_financial_validity_errors_strict_admission(self):
        # RFC 0109 D3: an array of registered FV-NN codes, governed after the
        # three numeric members; any other present value is MALFORMED.
        pointer="validation_overrides.financial_validity_errors"
        def config(value):
            return ('{"validation_overrides":{"financial_validity_errors":'+value+'}}').encode()
        for value in ('"FV-04"','null','false','1','{}','{"FV-04":true}'):
            with self.subTest(value=value):self.refused(config(value),pointer)
        for value in ('[1]','[null]','[true]','[["FV-04"]]','[{"code":"FV-04"}]','["FV-04",4]'):
            with self.subTest(value=value):self.refused(config(value),pointer)
        for code in ("FV-99","FV-00","FV-15","FV-4","fv-04","FV-04 ","CC-01",""):
            with self.subTest(code=code):self.refused(config(json.dumps(["FV-04",code])),pointer)
        self.assertEqual(_parse_institution_config(config('[]')),dict(financial_validity_errors=[]))
        self.assertEqual(_parse_institution_config(config('["FV-04","FV-09","FV-04"]')),
                         dict(financial_validity_errors=["FV-04","FV-09","FV-04"]))
        every=["FV-%02d"%n for n in range(1,15)]
        self.assertEqual(_parse_institution_config(config(json.dumps(every))),dict(financial_validity_errors=every))
        # Governed order: a malformed numeric member is refused first.
        self.refused(b'{"validation_overrides":{"financial_validity_errors":"bad","debt_yield_warning_below":null}}',
                     "validation_overrides.debt_yield_warning_below")
        self.refused(b'{"validation_overrides":{"financial_validity_errors":["FV-99"],"dscr_warning_below":1.1}}',pointer)
        self.assertEqual(_parse_institution_config(b'{"validation_overrides":{"financial_validity_errors":["FV-04"],"dscr_warning_below":1.1}}'),
                         dict(dscr_warning_below=1.1,financial_validity_errors=["FV-04"]))
        # The codes are not a threshold band.
        self.assertEqual(_institution_threshold_map(dict(financial_validity_errors=["FV-04"]),{}),{})

    def test_pure_admission_does_not_read_files_and_runtime_errors_are_not_malformed(self):
        with patch("uwmd_institution_config.Path.read_bytes",side_effect=AssertionError("no I/O")):
            self.assertEqual(_parse_institution_config(b'{}'),{})
        for error in (RecursionError("resource"),MemoryError("resource"),RuntimeError("defect")):
            with patch("uwmd_institution_config.json.loads",side_effect=error):
                with self.assertRaises(type(error)):_parse_institution_config(b'{}')

    def test_lexical_selection_cwd_relative_explicit_and_no_fallback(self):
        calls=[]
        def read(path):calls.append(path);return b'{}'
        with patch("uwmd_institution_config.Path.read_bytes",read),patch(
                "uwmd_institution_config.Path.resolve",side_effect=AssertionError("no realpath")):
            self.assertEqual(_load_institution_config(Path("records")/".."/"deal.uwx.md"),{})
            self.assertEqual(calls[-1],Path(os.path.abspath("deal.uwx.md")).parent/".uw.institution.json")
            self.assertEqual(_load_institution_config("records/link.uwx.md","other selected.json"),{})
            self.assertEqual(calls[-1],Path(os.path.abspath("other selected.json")))
        self.assertEqual(len(calls),2)

    def test_read_first_absence_dangling_and_race_classification(self):
        observed=[]
        def missing(path):observed.append(("read",path));raise FileNotFoundError()
        def no_entry(path):observed.append(("entry",path));raise FileNotFoundError()
        with patch("uwmd_institution_config.Path.read_bytes",missing),patch(
                "uwmd_institution_config.os.lstat",no_entry):
            self.assertEqual(_load_institution_config("deal.uwx.md"),{})
            self.assertEqual([kind for kind,_ in observed],["read","entry"])
            with self.assertRaises(_InstitutionConfigError) as caught:
                _load_institution_config("deal.uwx.md","gone.json")
            self.assertEqual(caught.exception.code,"VAL-INSTITUTION-CONFIG-UNREADABLE")
            self.assertEqual([kind for kind,_ in observed],["read","entry","read"])
        # A sidecar directory entry that is a dangling link is not absence.
        with patch("uwmd_institution_config.Path.read_bytes",side_effect=FileNotFoundError()),patch(
                "uwmd_institution_config.os.lstat",return_value=object()):
            with self.assertRaises(_InstitutionConfigError):_load_institution_config("deal.uwx.md")
        # A failed lstat after read ENOENT cannot prove genuine absence.
        for failure in (PermissionError("private"),OSError("unknown")):
            with patch("uwmd_institution_config.Path.read_bytes",side_effect=FileNotFoundError()),patch(
                    "uwmd_institution_config.os.lstat",side_effect=failure):
                with self.assertRaises(_InstitutionConfigError) as caught:_load_institution_config("deal.uwx.md")
                self.assertEqual(caught.exception.code,"VAL-INSTITUTION-CONFIG-UNREADABLE")
        # File disappearance/read failure is classified from the actual attempted
        # read, not an exists-only check followed by an assumed successful open.
        for error in (PermissionError("private path"),IsADirectoryError(),OSError("read failed")):
            with patch("uwmd_institution_config.Path.read_bytes",side_effect=error),patch(
                    "uwmd_institution_config.os.lstat",side_effect=AssertionError("not absence")):
                with self.assertRaises(_InstitutionConfigError) as caught:_load_institution_config("deal.uwx.md")
                self.assertEqual(caught.exception.projection(),dict(category="validate",
                    code="VAL-INSTITUTION-CONFIG-UNREADABLE",message="Selected institution config could not be read."))

    def test_real_files_explicit_authority_auto_absence_and_readonly(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-config-main-safe-") as folder:
            root=Path(folder);records=root/"records";records.mkdir();document=records/"deal.uwx.md"
            document.write_bytes(b'original source')
            self.assertEqual(_load_institution_config(document),{})
            sidecar=records/".uw.institution.json";sidecar.write_bytes(b'{"validation_overrides":{"dscr_warning_below":1.2}}')
            explicit=root/"selected.json";explicit.write_bytes(b'{}')
            before={path:path.read_bytes() for path in (document,sidecar,explicit)}
            self.assertEqual(_load_institution_config(document),dict(dscr_warning_below=1.2))
            self.assertEqual(_load_institution_config(document,explicit),{})
            with self.assertRaises(_InstitutionConfigError):_load_institution_config(document,root/"missing.json")
            for path,raw in before.items():self.assertEqual(path.read_bytes(),raw)
            sidecar.unlink();sidecar.mkdir()
            with self.assertRaises(_InstitutionConfigError) as caught:_load_institution_config(document)
            self.assertEqual(caught.exception.code,"VAL-INSTITUTION-CONFIG-UNREADABLE")

    def test_real_document_symlink_uses_lexical_parent(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-config-link-") as folder:
            root=Path(folder);left=root/"left";right=root/"right";left.mkdir();right.mkdir()
            target=right/"actual.uwx.md";target.write_bytes(b'original source');link=left/"input.uwx.md"
            try:link.symlink_to(target)
            except OSError as error:self.skipTest("This host cannot create document symlinks: "+str(error))
            (left/".uw.institution.json").write_bytes(b'{"validation_overrides":{"dscr_warning_below":1.1}}')
            (right/".uw.institution.json").write_bytes(b'{"validation_overrides":{"dscr_warning_below":9}}')
            self.assertEqual(_load_institution_config(link),dict(dscr_warning_below=1.1))
            self.assertEqual(target.read_bytes(),b'original source')

    def test_real_dangling_sidecar_is_unreadable(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-config-dangling-") as folder:
            root=Path(folder);document=root/"input.uwx.md";document.write_bytes(b'original source')
            sidecar=root/".uw.institution.json"
            try:sidecar.symlink_to(root/"missing.json")
            except OSError as error:self.skipTest("This host cannot create sidecar symlinks: "+str(error))
            with self.assertRaises(_InstitutionConfigError) as caught:_load_institution_config(document)
            self.assertEqual(caught.exception.code,"VAL-INSTITUTION-CONFIG-UNREADABLE")


if __name__=="__main__":unittest.main()
