"""Accepted RFC0055 co-tenancy predicates, field ordering and real CLI transport."""
import asyncio
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate, well_formed
from test_validation_cli import property_source
from uwmd_reader import parse
from uwmd_validation import _validate_source

BASE = "tenants[0].co_tenancy_details"
CODES = ("LSE-06", "LSE-07", "LSE-08")


def details(**overrides):
    return dict(trigger="occupancy_threshold", occupancy_threshold=.5,
                remedy="termination_right", **overrides)


def raw(tenant):
    return property_source() + well_formed("rent_roll", tenants=[tenant])


def findings(result):
    return [(i["code"], i["field"]) for i in result["issues"] if i["code"] in CODES]


def expected(code, leaf=""):
    return (code, BASE + ("." + leaf if leaf else ""))


class CoTenancyAdmissionTests(unittest.TestCase):
    def assess(self, authored):
        source = raw(authored); document = parse(source); before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, source)
        self.assertEqual(result["errors"], [i for i in result["issues"] if i["severity"] == "error"])
        self.assertEqual(findings(asyncio.run(_validate_source(source))), findings(result))
        return findings(result)

    def clause(self, value):
        return self.assess(dict(co_tenancy_clause=True, co_tenancy_details=value))

    def test_parent_admission_exact_fields_and_no_child_cascade(self):
        for flag in (None, False, 1, "true", [], {}):
            self.assertEqual(self.assess(dict(co_tenancy_clause=flag, co_tenancy_details={})),
                             [("LSE-06", "tenants[0].co_tenancy_clause")])
        for tenant in ({}, {"co_tenancy_clause":False}, {"co_tenancy_details":None},
                       {"co_tenancy_clause":False,"co_tenancy_details":None}):
            self.assertEqual(self.assess(tenant), [])
        for value in (None, False, 0, "body", [], [details()]):
            self.assertEqual(self.clause(value), [expected("LSE-06")])
        self.assertEqual(self.assess(dict(co_tenancy_clause=True)), [expected("LSE-06")])

    def test_invalid_trigger_stops_this_clause_only(self):
        for value in (None, False, 0, "BOTH", [], {}):
            body=dict(trigger=value, remedy="bad", cure_period_months=False)
            self.assertEqual(self.clause(body), [expected("LSE-07","trigger")])
        self.assertEqual(self.clause({}), [expected("LSE-07","trigger")])
        source=raw(dict(co_tenancy_clause=True, co_tenancy_details={},
                       ti_allowance_original=1,ti_outstanding_balance=2,recovery_terms="bad"))
        result=validate(parse(source))
        self.assertEqual([i["code"] for i in result["issues"] if i["code"] in (*CODES,"LSE-09","REC-02")],
                         ["LSE-07","LSE-09","REC-02"])

    def test_independent_companions_value_then_cure_order(self):
        body=dict(trigger="both",named_cotenants=[],occupancy_threshold=0,
                  remedy="rent_reduction",cure_period_months=False)
        self.assertEqual(self.clause(body), [expected("LSE-07","named_cotenants"),
            expected("LSE-07","occupancy_threshold"),expected("LSE-08","remedy_value"),
            expected("LSE-07","cure_period_months")])
        body["remedy"]="bad"
        self.assertEqual(self.clause(body), [expected("LSE-07","named_cotenants"),
            expected("LSE-07","occupancy_threshold"),expected("LSE-08","remedy")])
        del body["remedy"]
        self.assertEqual(self.clause(body)[-1],expected("LSE-08","remedy"))

    def test_named_domain_preserves_whitespace_duplicates_and_literal_strings(self):
        for names in ([" "],["\t"],["\u2003"],["same","same"],["a"," b "]):
            body=dict(trigger="named_tenant_departure",named_cotenants=names,remedy="termination_right")
            self.assertEqual(self.clause(body),[])
        for names in (None,False,0,"name",{},[],[""],[None],[False],[0],[[]],[{}],["a",""]):
            body=dict(trigger="named_tenant_departure",named_cotenants=names,remedy="termination_right")
            self.assertEqual(self.clause(body),[expected("LSE-07","named_cotenants")])
        body=dict(trigger="named_tenant_departure",remedy="termination_right")
        self.assertEqual(self.clause(body),[expected("LSE-07","named_cotenants")])

    def test_occupancy_and_remedy_value_numeric_null_boolean_boundaries(self):
        for value in (None,False,True,0,1,-.1,"0.5",[],{}):
            body=details();body["occupancy_threshold"]=value
            self.assertEqual(self.clause(body),[expected("LSE-07","occupancy_threshold")])
        for remedy, admitted, rejected in (
                ("rent_reduction",(.1,1,1.0),(None,False,True,0,-1,1.1,"1",[],{})),
                ("alternate_rent",(0,1,1.5),(None,False,True,-1,"1",[],{})),
                ("termination_right",(None,),(False,True,0,1,"",[],{}))):
            for value in admitted:
                body=details();body.update(remedy=remedy,remedy_value=value)
                self.assertEqual(self.clause(body),[])
            for value in rejected:
                body=details();body.update(remedy=remedy,remedy_value=value)
                self.assertEqual(self.clause(body),[expected("LSE-08","remedy_value")])
        for remedy in (None,False,0,"unknown",[],{}):
            body=details();body.update(remedy=remedy,cure_period_months=False)
            self.assertEqual(self.clause(body),[expected("LSE-08","remedy")])

    def test_cure_whole_domain_has_no_notice_safe_integer_ceiling(self):
        for value in (None,0,1,1.0,9007199254740991,9007199254740992,1e100):
            self.assertEqual(self.clause(details(cure_period_months=value)),[])
        for value in (False,True,-1,.5,"1",[],{}):
            self.assertEqual(self.clause(details(cure_period_months=value)),
                             [expected("LSE-07","cure_period_months")])
        self.assertEqual(self.clause(details()),[])

    def test_unowned_unknown_or_unused_companions_get_no_generic_lse_fallback(self):
        body=details(named_cotenants=False,unknown_data={"lawful":"opaque"})
        self.assertEqual(self.clause(body),[])
        body=dict(trigger="named_tenant_departure",named_cotenants=["a"],
                  occupancy_threshold=False,remedy="termination_right")
        self.assertEqual(self.clause(body),[])

    def test_current_model_authority_and_unchanged_current_population(self):
        tenant=dict(co_tenancy_clause=True,co_tenancy_details=details())
        source=raw(tenant);document=parse(source)
        current=document.source.blocks[1].parsed.value["tenants"][0]["co_tenancy_details"]
        current["cure_period_months"]=False
        before=copy.deepcopy(document)
        self.assertEqual(findings(validate(document)),[expected("LSE-07","cure_period_months")])
        self.assertEqual(document,before)
        self.assertEqual(document.source.raw,source)
        self.assertEqual(findings(asyncio.run(_validate_source(source))),[])
        invalid=parse(HEADER+well_formed("rent_roll",tenants=[dict(co_tenancy_clause=True)])).source.blocks[0].parsed.value
        valid=parse(HEADER+well_formed("rent_roll",tenants=[tenant])).source.blocks[0].parsed.value
        historical=copy.deepcopy(invalid);historical["_meta"]["lifecycle"]["superseded"]=True
        source=property_source()+block("rent_roll",invalid)+block("rent_roll",valid)+block("rent_roll",historical,superseded=True)
        self.assertEqual(findings(validate(parse(source))),[])
        source+=block("rent_roll",invalid,variant="peer",role="component")
        self.assertEqual(findings(validate(parse(source))),[expected("LSE-06")])
        source=property_source()+well_formed("x_unknown",tenants=[dict(co_tenancy_clause=True)])
        self.assertEqual(findings(validate(parse(source))),[])

    def test_actual_cli_on_frozen_fixture_mutations_fields_exits_and_bytes(self):
        fixture=ROOT/"conformance/lease/valid-every-clause/deal.uwx.md"
        original=fixture.read_bytes();fixture_hash=hashlib.sha256(original).hexdigest()
        document=parse(original);carrier=document.source.blocks[0]
        cases=[("whitespace",dict(trigger="named_tenant_departure",named_cotenants=[" "],remedy="termination_right"),[]),
               ("both_missing",dict(trigger="both",named_cotenants=[],occupancy_threshold=0,remedy="rent_reduction",cure_period_months=False),
                [expected("LSE-07","named_cotenants"),expected("LSE-07","occupancy_threshold"),
                 expected("LSE-08","remedy_value"),expected("LSE-07","cure_period_months")]),
               ("bad_trigger",dict(trigger="bad",remedy="bad",cure_period_months=False),[expected("LSE-07","trigger")]),
               ("large_cure",details(cure_period_months=9007199254740992),[])]
        with tempfile.TemporaryDirectory(prefix="uwmd-cotenancy-cli-") as folder:
            for name,body,wanted in cases:
                payload=copy.deepcopy(carrier.parsed.value)
                payload["tenants"][0]["co_tenancy_details"]=body
                authored=original[:carrier.body_span.start]+json.dumps(payload,ensure_ascii=False,indent=2).encode()+b"\n"+original[carrier.body_span.end:]
                path=Path(folder)/(name+".uwx.md");path.write_bytes(authored)
                process=subprocess.run([sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py"),
                    "validate",str(path),"--json"],capture_output=True,encoding="utf8",timeout=30)
                response=json.loads(process.stdout)
                self.assertEqual(process.stderr,"")
                self.assertNotIn("error",response)
                self.assertNotIn("partial_validation_result",response)
                self.assertEqual(findings(response),wanted)
                self.assertEqual(response["errors"],[i for i in response["issues"] if i["severity"]=="error"])
                self.assertEqual(process.returncode,1 if response["errors"] else 0)
                self.assertEqual(path.read_bytes(),authored)
        self.assertEqual(hashlib.sha256(fixture.read_bytes()).hexdigest(),fixture_hash)
        self.assertEqual(fixture.read_bytes(),original)


if __name__ == "__main__":
    unittest.main()
