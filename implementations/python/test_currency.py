"""Document currency checks, separate from full validation/display/bindings."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

from uwmd import main
from uwmd_currency import inspect_document_currency
from uwmd_reader import parse

ROOT=Path(__file__).resolve().parents[2]
OMITTED=object()


def document(value=OMITTED):
    declaration=b"" if value is OMITTED else ("currency_code: "+json.dumps(value,ensure_ascii=True)+"\n").encode()
    return parse(b'---\nuw_version: "3.0"\n'+declaration+b'---\n')


class DocumentCurrencyTests(unittest.TestCase):
    def test_four_actual_standalone_fixtures_with_explicit_scoped_comparison(self):
        spec=importlib.util.spec_from_file_location("currency_shared",ROOT/"conformance/runner/runner.py")
        driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
        malformed=ROOT/"conformance/currency/malformed/deal.uwx.md"
        frozen=json.loads((malformed.parent/"expected-validation.json").read_text())
        expected=[i for i in frozen["issues"] if i["code"].startswith("CUR-")]
        fixtures=[(malformed,expected),(ROOT/"conformance/currency/explicit-code/deal.uwx.md",[]),
            (ROOT/"conformance/hedge/0070-currency-absent/deal.uwx.md",[]),
            (ROOT/"conformance/hedge/0070-currency-null/deal.uwx.md",[])]
        for path,want in fixtures:
            with self.subTest(source=path):
                before=path.read_bytes()
                process=subprocess.run([sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py"),
                    "inspect-document-currency",str(path),"--json"],capture_output=True,text=True,timeout=60)
                result=json.loads(process.stdout)
                # Explicit test-only currency projection of frozen validation;
                # unrelated findings/rendering and portable flags are not claimed.
                projection=dict(issues=[dict(code=i["code"],severity=i["severity"]) for i in result["issues"]])
                self.assertEqual(driver.json_subset(dict(issues=want),projection),[])
                self.assertEqual(process.returncode,1 if want else 0)
                self.assertNotIn("overall_status",result)
                self.assertEqual(path.read_bytes(),before)
        self.assertEqual((main(["manifest"])[0]["capabilities"],main(["manifest"])[0]["profiles"]),(["parse", "calc-evaluate", "validate", "verify-reserve-accounts", "verify-reserve-draws"],[]))
        for command in ("validate","calc","verify"):
            self.assertNotEqual(main([command,"unused"])[1],0)

    def test_absence_and_null_are_admitted_but_not_normalized_together(self):
        missing=inspect_document_currency(document())
        null=inspect_document_currency(document(None))
        self.assertEqual(missing["evidence"],dict(authored=False))
        self.assertEqual(null["evidence"],dict(authored=True,value=None))
        self.assertTrue(missing["ok"])
        self.assertTrue(null["ok"])
        self.assertEqual((missing["issues"],null["issues"]),([],[]))

    def test_three_ascii_letters_require_no_iso_allocation_lookup(self):
        for value in ("USD","MXN","EUR","JPY","ABC","ZZZ"):
            with self.subTest(currency=value):
                result=inspect_document_currency(document(value))
                self.assertTrue(result["ok"])
                self.assertEqual(result["evidence"],dict(authored=True,value=value))
        self.assertEqual(inspect_document_currency(document("ZZZ"))["issues"],[])

    def test_malformed_authored_values_are_exact_error_without_coercion(self):
        for value in ("usd","Usd"," US","USD ","USD\n","","US","USDD","$","US1","ＵＳＤ","UŚD",False,0,123):
            with self.subTest(currency=value):
                doc=document(value);before=copy.deepcopy(doc)
                result=inspect_document_currency(doc)
                self.assertFalse(result["ok"])
                self.assertEqual([(i["code"],i["severity"],i["section"],i["field"]) for i in result["issues"]],
                    [("CUR-01","error","frontmatter","currency_code")])
                self.assertEqual(result["evidence"]["value"],value)
                self.assertEqual(doc,before)

    def test_structured_currency_values_are_not_strings_or_defaults(self):
        for value in (["USD"],{"currency":"USD"},[],{}):
            doc=document()
            doc.frontmatter.value["currency_code"]=copy.deepcopy(value)
            result=inspect_document_currency(doc)
            self.assertEqual([i["code"] for i in result["issues"]],["CUR-01"])
            self.assertEqual(result["evidence"]["value"],value)
            result["evidence"]["value"].clear()
            self.assertEqual(doc.frontmatter.value["currency_code"],value)

    def test_verdict_is_independent_of_locale_location_and_financial_sections(self):
        for currency in (OMITTED,None,"MXN","usd"):
            baseline=inspect_document_currency(document(currency))
            for locale in ("en-US","de-DE","unsupported",None,False):
                doc=document(currency)
                doc.frontmatter.value.update(locale=locale,city="London",state="GB",property_address="€1",
                    scenario="value_add",asset_class="office",quick_metrics={"purchase_price":123})
                self.assertEqual(inspect_document_currency(doc),baseline)
            # No hedge/reserve/financial payload is needed to inspect the declaration.
            self.assertEqual(document(currency).source.blocks,())

    def test_decoded_frontmatter_key_and_original_bytes_are_preserved(self):
        plain=document("USD")
        quoted=parse(plain.source.raw.replace(b"currency_code:",b'"currency_code":'))
        self.assertEqual(inspect_document_currency(plain),inspect_document_currency(quoted))
        for raw in (quoted.source.raw, b'\xef\xbb\xbf'+quoted.source.raw.replace(b'\n',b'\r\n')):
            doc=parse(raw);before=copy.deepcopy(doc)
            inspect_document_currency(doc)
            self.assertEqual(doc.source.raw,raw)
            self.assertEqual(doc.projection(),before.projection())
            self.assertEqual(doc,before)


if __name__=="__main__":unittest.main()
