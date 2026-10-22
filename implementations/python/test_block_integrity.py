"""V.9/V.10 bounded evidence; frozen signing inputs are hash-only controls."""
import asyncio
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

from test_reader import HEADER
from uwmd import main
from uwmd_block_integrity import (
    BlockIntegrityError, compute_block_hash, verify_block_chain, verify_block_integrity,
)
from uwmd_jcs import canonicalize
from uwmd_reader import parse

ROOT = Path(__file__).resolve().parents[2]
OMITTED = object()


def hash_block(payload, **kwargs):
    return asyncio.run(compute_block_hash(payload, **kwargs))


def verify(document, **kwargs):
    return asyncio.run(verify_block_integrity(document, **kwargs))


def fence(section, payload=None, *, variant=None, superseded=False, integrity=OMITTED, role=OMITTED):
    body = {"_meta": {"section":section,
        "provenance":{"source":"manual","actor":"tester","timestamp":"2026-01-01T00:00:00Z"},
        "quality":{"confidence":"high","human_review_required":False},
        "lifecycle":{"revision":1,"superseded":superseded}}}
    body.update(payload or {})
    if integrity is not OMITTED:
        body["_meta"]["integrity"]=integrity
    if role is not OMITTED:
        body["_role"]=role
    annotation="```json uw:section="+section+(" variant="+variant if variant is not None else "")
    return (annotation+"\n"+json.dumps(body,ensure_ascii=True)+"\n```\n").encode()


def stamped(section, value, *, parent=None, **kwargs):
    raw=fence(section,value,**kwargs)
    body=parse(HEADER+raw).source.blocks[0].parsed.value
    # Independent test construction from accepted canonical content; production
    # never reads expected fixtures or uses this helper.
    digest=hashlib.sha256(canonicalize({k:v for k,v in body.items() if k!="_meta"}).encode()).hexdigest()
    return fence(section,value,integrity={"content_hash":digest,"parent_hash":parent},**kwargs),digest


class BlockIntegrityTests(unittest.TestCase):
    def test_11_actual_standalone_frozen_hash_only_comparisons(self):
        spec=importlib.util.spec_from_file_location("block_shared",ROOT/"conformance/runner/runner.py")
        driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
        files=sorted((ROOT/"conformance/signing/blocks").glob("*/deal.uwx.md"))
        files += [ROOT/"conformance/documents/malformed/04-broken-chain.uwx.md",
                  ROOT/"conformance/starter/editor/fixtures/parent-hash-stamp/before.uwx.md"]
        self.assertEqual(len(files),11)
        for path in files:
            with self.subTest(fixture=path):
                original=path.read_bytes()
                proc=subprocess.run([sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py"),
                    "verify-block-integrity",str(path),"--json"],capture_output=True,text=True,timeout=60)
                actual=json.loads(proc.stdout)
                self.assertEqual(actual["assessment"],"complete")
                self.assertFalse(actual["signatures_checked"])
                self.assertEqual(actual["signatures_verified"],0)
                if path.parent.parent.name=="blocks":
                    frozen=json.loads((path.parent/"expected.json").read_text())
                    want=sorted(c for c in frozen["expected_codes"] if c in ("INT-01","INT-03","INT-04"))
                    self.assertEqual(actual["signatures_present"],frozen["signatures_present"])
                elif path.name=="04-broken-chain.uwx.md":
                    frozen=json.loads(path.with_name("04-broken-chain.expected.json").read_text())
                    want=frozen["expected_codes"]
                else:
                    want=[]
                    self.assertEqual(actual["blocks"][0]["computed_hash"],
                        "80b42de6702a102a5ffc7f084e2ec9267e6854ca7583ad58a981e986527649ae")
                # Explicit hash-only projection: no frozen signature/verifier
                # success is asserted and no portable catalogue case is changed.
                projection=dict(codes=sorted(i["code"] for i in actual["issues"]))
                self.assertEqual(driver.json_subset(dict(codes=want),projection),[])
                self.assertEqual(proc.returncode,0 if actual["ok"] else 1)
                self.assertEqual(path.read_bytes(),original)
        self.assertEqual(main(["manifest"])[0]["capabilities"],["parse", "calc-evaluate", "validate"])
        self.assertEqual(main(["manifest"])[0]["profiles"],[])
        for command in ("validate","calc","verify"):
            self.assertNotEqual(main([command,"unused"])[1],0)

    def test_v9_exact_scope_literal_content_and_nested_meta(self):
        self.assertEqual(hash_block({"_meta":{"anything":1},"a":1}),
            "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862")
        base={"_meta":{"section":"property"},"content":{"_meta":"payload"},"values":[1,2]}
        before=copy.deepcopy(base);initial=hash_block(base)
        changed=copy.deepcopy(base);changed["_meta"]={"entire":"replacement","integrity":{"parent_hash":"x"}}
        self.assertEqual(hash_block(changed),initial)
        for key,value in (("_notes",None),("_role","primary"),("_overrides",[]),("extra",1)):
            changed=copy.deepcopy(base);changed[key]=value
            self.assertNotEqual(hash_block(changed),initial)
        changed=copy.deepcopy(base);changed["content"]["_meta"]="changed"
        self.assertNotEqual(hash_block(changed),initial)
        changed=copy.deepcopy(base);changed["values"].reverse()
        self.assertNotEqual(hash_block(changed),initial)
        self.assertEqual(base,before)

    def test_unhashed_is_explicitly_unchecked_not_authentication(self):
        doc=parse(HEADER+fence("property",{"value":1})+fence("property",{"value":2},superseded=True))
        result=verify(doc)
        self.assertTrue(result["ok"])
        self.assertEqual((result["chains_with_hashes"],result["chains_checked"],result["chains_skipped"]),(0,0,1))
        self.assertEqual([b["hash_status"] for b in result["blocks"]],["unchecked","unchecked"])
        self.assertEqual(result["issues"],[])

    def test_complete_sequence_history_and_root_replacement_boundary(self):
        first,h1=stamped("property",{"value":1},superseded=True)
        second,h2=stamped("property",{"value":2},parent=h1)
        result=verify(parse(HEADER+first+second))
        self.assertTrue(result["ok"])
        self.assertEqual((result["blocks_hashed"],result["chains_with_hashes"]),(2,1))
        self.assertEqual([b["superseded"] for b in result["blocks"]],[True,False])
        # A valid replace may discard the predecessor; no new orphan/root-parent
        # refusal is inferred from a non-null parent on the retained first block.
        root=verify(parse(HEADER+second))
        self.assertTrue(root["ok"])
        self.assertEqual(root["issues"],[])
        self.assertEqual(root["blocks"][0]["computed_hash"],h2)
        # The unchanged schema explicitly admits empty parent text. Preserve it
        # lexically; it is not null when an actual predecessor hash is compared.
        blank=second.replace(('"parent_hash": "'+h1+'"').encode(),b'"parent_hash": ""')
        self.assertTrue(verify(parse(HEADER+blank))["ok"])
        linked=verify(parse(HEADER+first+blank))
        self.assertEqual([i["code"] for i in linked["issues"]],["INT-01"])
        self.assertEqual(linked["issues"][0]["actual"],"")

    def test_parent_and_content_failures_are_independent_exact_severities(self):
        first,h1=stamped("property",{"value":1},superseded=True)
        second,_=stamped("property",{"value":2},parent="0"*64)
        second=second.replace(b'"value": 2',b'"value": 3')
        result=verify(parse(HEADER+first+second))
        self.assertFalse(result["ok"])
        self.assertEqual([(i["code"],i["severity"]) for i in result["issues"]],[("INT-04","warning"),("INT-01","error")])
        content=result["issues"][0]
        evidence=result["blocks"][1]
        self.assertEqual((content["expected"],content["actual"]),
                         (evidence["computed_hash"],evidence["stamped_hash"]))
        self.assertNotEqual(content["expected"],content["actual"])
        mismatch=result["issues"][1]
        self.assertEqual((mismatch["expected"],mismatch["actual"]),(h1,"0"*64))
        self.assertNotIn("INT-02",[i["code"] for i in result["issues"]])

    def test_optin_prefix_vs_later_missing_stamp_and_immediate_predecessor(self):
        prefix=fence("property",{"value":0},superseded=True)
        first,h1=stamped("property",{"value":1},superseded=True)
        before=verify(parse(HEADER+prefix+first))
        self.assertEqual(before["issues"],[])
        missing=fence("property",{"value":2},integrity={"parent_hash":h1},superseded=True)
        later,_=stamped("property",{"value":3},parent=h1)
        result=verify(parse(HEADER+prefix+first+missing+later))
        self.assertEqual([(i["code"],i["severity"]) for i in result["issues"]],[("INT-03","warning"),("INT-01","error")])
        self.assertEqual(result["blocks_hashed"],2)
        self.assertEqual(result["issues"][1]["actual"],h1)

    def test_registered_variants_and_null_default_never_cross_link(self):
        raw=HEADER
        for variant in (None,"default","base"):
            first,h1=stamped("cash_flow_series",{"series":[]},variant=variant,superseded=True)
            second,_=stamped("cash_flow_series",{"series":[1]},variant=variant,parent=h1)
            raw+=first+second
        result=verify(parse(raw))
        self.assertTrue(result["ok"])
        self.assertEqual(result["chains_with_hashes"],3)
        self.assertEqual(result["blocks_hashed"],6)

    def test_current_role_maps_do_not_use_financial_selection_or_envelope(self):
        raw=HEADER
        for variant in ("alpha","beta"):
            first,h1=stamped("x_peer",{"value":1},variant=variant,role="primary",superseded=True)
            second,_=stamped("x_peer",{"value":2},variant=variant,role="primary",parent=h1)
            raw+=first+second
        result=verify(parse(raw))
        self.assertTrue(result["ok"])
        self.assertEqual(result["chains_with_hashes"],2)
        # A role collision matters to financial source selection, never to
        # independently addressed physical block hashes or these distinct chains.
        self.assertEqual(result["blocks_hashed"],4)

    def test_removed_historical_roles_retained_as_local_unsupported_not_policy(self):
        first,h1=stamped("debt_structure",{"value":1},variant="alpha",role="senior",superseded=True)
        second,_=stamped("debt_structure",{"value":2},variant="alpha",parent=h1)
        doc=parse(HEADER+first+second);result=verify(doc)
        self.assertFalse(result["ok"])
        self.assertEqual(result["assessment"],"unsupported")
        self.assertEqual(result["unsupported_chains"][0]["block_indexes"],[0,1])
        self.assertEqual(result["blocks_hashed"],2)
        self.assertEqual(result["issues"],[])
        explicit=asyncio.run(verify_block_chain(doc.source.blocks))
        self.assertTrue(explicit["ok"])
        self.assertEqual(explicit["chains_with_hashes"],1)

    def test_append_only_entries_do_not_invent_supersede_links(self):
        first,_=stamped("custom_calculations",{"value":1})
        second,_=stamped("custom_calculations",{"value":2})
        result=verify(parse(HEADER+first+second))
        self.assertEqual(result["assessment"],"unsupported")
        self.assertFalse(result["ok"])
        self.assertEqual(result["blocks_hashed"],2)
        self.assertEqual(result["issues"],[])

    def test_bad_metadata_jcs_and_provider_never_fabricate_mismatch(self):
        first,_=stamped("property",{"value":1})
        doc=parse(HEADER+first)
        async def broken(_):raise RuntimeError("no provider")
        async def malformed(_):return "sha256:"+"a"*64
        async def uppercase(_):return "A"*64
        for provider in (broken,malformed,uppercase,lambda _:None):
            result=verify(doc,hash_provider=provider)
            self.assertEqual(result["assessment"],"unavailable")
            self.assertFalse(result["ok"])
            self.assertEqual(result["issues"],[])
            self.assertIsNone(result["blocks"][0]["computed_hash"])
        for metadata in ({"content_hash":None},{"content_hash":"A"*64},{"algorithm":"sha512"},{"parent_hash":5}):
            result=verify(parse(HEADER+fence("property",{"value":1},integrity=metadata)))
            self.assertEqual(result["assessment"],"unavailable")
            self.assertEqual(result["issues"],[])
        bad=copy.deepcopy(doc);bad.source.blocks[0].parsed.value["value"]="\ud800"
        result=verify(bad)
        self.assertEqual(result["assessment"],"unavailable")
        self.assertEqual(result["issues"],[])
        with self.assertRaises(BlockIntegrityError):hash_block({"bad":"\ud800"})
        with self.assertRaises(BlockIntegrityError):hash_block([])
        with self.assertRaises(BlockIntegrityError):asyncio.run(verify_block_chain([{}]))
        # A provider failure never erases another block's actual finite evidence.
        second,_=stamped("valuation",{"value":2})
        calls=0
        async def partly_available(preimage):
            nonlocal calls
            calls+=1
            if calls==1:raise RuntimeError("first unavailable")
            return hashlib.sha256(preimage).hexdigest()
        partial=verify(parse(HEADER+first+second),hash_provider=partly_available)
        self.assertEqual(partial["assessment"],"unavailable")
        self.assertEqual([b["hash_status"] for b in partial["blocks"]],["unavailable","matched"])
        self.assertEqual(partial["issues"],[])

    def test_signatures_are_present_unchecked_never_verified(self):
        first,_=stamped("property",{"value":1})
        doc=parse(HEADER+first)
        doc.source.blocks[0].parsed.value["_meta"]["integrity"]["signature"]={"alg":"unrecognized","sig":"anything"}
        result=verify(doc)
        self.assertTrue(result["ok"])
        self.assertEqual((result["signatures_present"],result["signatures_verified"],result["signatures_checked"]),(1,0,False))
        self.assertEqual(result["issues"],[])
        doc.source.blocks[0].parsed.value["_meta"]["integrity"]["algorithm"]="unsupported"
        result=verify(doc)
        self.assertEqual(result["assessment"],"unavailable")
        self.assertEqual(result["signatures_present"],1)
        self.assertFalse(result["signatures_checked"])

    def test_hash_snapshot_before_await_and_detached_evidence(self):
        first,h1=stamped("property",{"value":1},superseded=True)
        second,_=stamped("property",{"value":2},parent=h1)
        doc=parse(HEADER+first+second);original=copy.deepcopy(doc)
        called=0
        async def mutate(preimage):
            nonlocal called
            called+=1
            await asyncio.sleep(0)
            for block in doc.source.blocks:
                block.parsed.value["value"]="mutated"
                block.parsed.value["_meta"]["integrity"]["parent_hash"]="0"*64
            return hashlib.sha256(preimage).hexdigest()
        result=verify(doc,hash_provider=mutate)
        self.assertTrue(result["ok"])
        self.assertEqual(called,2)
        clean=parse(original.source.raw);self.assertTrue(verify(clean)["ok"])
        self.assertEqual(clean,original)
        result["blocks"][0]["computed_hash"]="changed"
        self.assertEqual(verify(clean)["blocks"][0]["computed_hash"],h1)


if __name__=="__main__":unittest.main()
