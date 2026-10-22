"""Narrow V.12 evidence; adapted standalone comparisons are not validate passes."""
import asyncio
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

from test_reserve_draws import alter
from uwmd import main
from uwmd_envelope import EnvelopeError, source_digest
from uwmd_reader import parse
from uwmd_validation import validate_document
from uwmd_replacement_funding import (
    ReplacementFundingError, check_replacement_funding_structure,
    compute_replacement_cash_flow_binding_digest, replacement_funding_report,
    verify_replacement_funding_bindings,
)

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "conformance/hedge"


def case(name="0070-outright-payment"):
    return parse((FOLDER / name / "deal.uwx.md").read_bytes())


def report(document, **kwargs):
    return asyncio.run(replacement_funding_report(document, **kwargs))


def verify(document, **kwargs):
    return asyncio.run(verify_replacement_funding_bindings(document, **kwargs))


def digest(series, variant="cap-cash", index=1, currency="USD", **kwargs):
    return asyncio.run(compute_replacement_cash_flow_binding_digest(series, variant, index, currency, **kwargs))


def codes(result):
    return [i["code"] for i in result["structural_issues"]]


def payload(document, section):
    return next(b.parsed.value for b in document.source.blocks if b.section == section)


def change_hedge(document, action):
    index = next(i for i,b in enumerate(document.source.blocks) if b.section == "debt_structure")
    return alter(document, index, lambda p: action(p["rate_hedge"]))


class ReplacementFundingTests(unittest.TestCase):
    def test_71_adapted_actual_standalone_comparisons_not_validate_capability(self):
        spec = importlib.util.spec_from_file_location("replacement_shared", ROOT / "conformance/runner/runner.py")
        driver = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(driver)
        paths = []
        for path in sorted((ROOT / "conformance/runner/cases").glob("*.case.json")):
            frozen = json.loads(path.read_text(encoding="utf-8"))
            if frozen.get("expect", {}).get("project") == "replacement-funding":
                paths.append((path, frozen))
        self.assertEqual(len(paths), 71)
        for path, frozen in paths:
            with self.subTest(case=frozen["id"]):
                before = path.read_bytes()
                self.assertEqual((frozen["command"], frozen["requires_capabilities"]), ("validate", ["validate"]))
                fixture = ROOT / frozen["fixture_dir"] / "deal.uwx.md"
                source = fixture.read_bytes()
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "verify-replacement-funding", str(fixture), "--json"], capture_output=True, text=True, timeout=60)
                self.assertEqual(process.returncode, frozen["expect"]["exit_code"], process.stderr)
                actual = json.loads(process.stdout)
                self.assertEqual(set(actual), {"structural_issues", "replacement_funding_verification"})
                # Only a test adapter supplies the shared projection's input names.
                # No validate command, capability bypass or portable-case claim.
                adapted = dict(issues=actual["structural_issues"],
                               replacement_funding_verification=actual["replacement_funding_verification"])
                expected = json.loads((fixture.parent / frozen["expect"]["file"]).read_text())
                self.assertEqual(driver.json_subset(expected, driver.project(adapted, "replacement-funding")), [])
                self.assertEqual((path.read_bytes(), fixture.read_bytes()), (before, source))
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse", "calc-evaluate", "validate"])
        for command in ("validate", "calc"):
            self.assertNotEqual(main([command, "unused"])[1], 0)

    def test_digest_published_answers_and_null_identity(self):
        rows = payload(case(), "cash_flow_series")["series"]
        self.assertEqual(digest(rows), "sha256:3add19b25a3adb3d8bfa3f02977ecd14a53ead000abc4ad1ae99cd3d39fdf1fa")
        self.assertEqual(digest(rows, currency=None), "sha256:33072bf8b331730e37176a3fb1b1f80cb3fc1c398bed4746fcffc3d5b74ea63a")
        floating = copy.deepcopy(rows)
        floating[1]["amount"] = float(floating[1]["amount"])
        self.assertEqual(digest(rows), digest(floating, index=1.0))
        absent = parse(case().source.raw.replace(b"currency_code: USD\n", b""))
        null = parse(case().source.raw.replace(b"currency_code: USD", b"currency_code: null"))
        self.assertEqual(verify(absent)["computed_digest"], verify(null)["computed_digest"])

    def test_digest_helper_explicit_invalid_inputs_and_entire_vector(self):
        rows = payload(case(), "cash_flow_series")["series"]
        for variant, index, currency in ((None,1,"USD"),("",1,"USD"),("cap-cash",True,"USD"),
                ("cap-cash",-1,"USD"),("cap-cash",0.5,"USD"),("cap-cash",2,"USD"),
                ("cap-cash",9007199254740992,"USD"),("cap-cash",1,"usd")):
            with self.subTest(variant=variant,index=index,currency=currency), self.assertRaises(ReplacementFundingError):
                digest(rows,variant,index,currency)
        for mutate in (lambda r:r[0].update(label="changed"),lambda r:r.insert(0,dict(r[0])),
                lambda r:r[0].update(amount=-399999),lambda r:r[0].update(label=None)):
            changed=copy.deepcopy(rows);mutate(changed)
            self.assertNotEqual(digest(changed),digest(rows))
        same=copy.deepcopy(rows);same.append(dict(rows[1]))
        swapped=copy.deepcopy(same);swapped[1],swapped[2]=swapped[2],swapped[1]
        self.assertEqual(digest(same),digest(swapped))

    def test_metadata_metrics_and_lawful_extension_map_outside_digest(self):
        document=case()
        changed=alter(document,2,lambda p:p.update(label="different",day_count="actual/360",
            stated_metrics={"total_net":999},_notes="different",_meta={"anything":"retained"}))
        self.assertEqual(verify(changed),verify(document))
        # Reuse source blocks mechanically; unrelated x_ variants trigger the
        # known Envelope shape boundary but cannot enter this V.12 preimage.
        raw=changed.source.raw
        for variant in (b"alpha",b"beta"):
            full={"_meta":{"section":"x_peer","provenance":{"source":"manual","actor":"reviewer",
                "timestamp":"2026-10-03T00:00:00Z"},"quality":{"confidence":"high","human_review_required":False},
                "lifecycle":{"revision":1,"superseded":False}},"_role":"primary","arbitrary":1}
            raw+=b'\n```json uw:section=x_peer variant='+variant+b' source=manual ts=2026-10-03T00:00:00Z v=1 confidence=high\n'+json.dumps(full).encode()+b'\n```\n'
        extension=parse(raw)
        with self.assertRaises(EnvelopeError):
            source_digest(extension)
        self.assertEqual(verify(extension),verify(document))
        historical=parse(document.source.raw+b'\n```json uw:section=cash_flow_series variant=cap-cash superseded=true\n{"series":[]}\n```\n')
        self.assertEqual(verify(historical),verify(document))

    def test_exact_cash_identity_and_current_canonical_revision(self):
        document=case()
        for replacement in (b"",b"variant=base",b"variant=default"):
            changed=parse(document.source.raw.replace(b"variant=cap-cash",replacement))
            self.assertEqual(verify(changed)["reason"],"unresolvable_source")
        for variant in ("default","base"):
            changed=change_hedge(document,lambda h:h["replacement_funding"]["cash_flow_ref"].update(variant=variant))
            self.assertEqual(verify(changed)["reason"],"unresolvable_source")
        source=document.source.blocks[2]
        # Format2.7: last active revision of the same declared identity is current;
        # this is not a fallback across different variants or similar rows.
        raw=document.source.raw+b'\n```json uw:section=cash_flow_series variant=cap-cash\n'+json.dumps(source.parsed.value).encode()+b'\n```\n'
        self.assertEqual(verify(parse(raw)),verify(document))
        rows=payload(document,"cash_flow_series")["series"]
        explicit=parse(document.source.raw.replace(b"variant=cap-cash",b"variant=default"))
        explicit=change_hedge(explicit,lambda h:h["replacement_funding"]["cash_flow_ref"].update(
            variant="default",binding_digest=digest(rows,"default")))
        peer=b'\n```json uw:section=cash_flow_series\n{"series":[]}\n```\n'
        point=explicit.source.blocks[2].fence_span.start
        for raw in (explicit.source.raw+peer,explicit.source.raw[:point]+peer+explicit.source.raw[point:]):
            self.assertEqual(verify(parse(raw))["state"],"verified")

    def test_role_precedence_collisions_eligibility_and_singleton_routing(self):
        self.assertEqual(verify(case("0075-junior-keyed-base"))["state"],"verified")
        collision=case("0075-two-seniors")
        self.assertEqual(verify(collision)["reason"],"unresolvable_source")
        # Invalid/component roles are excluded even on default/base paths.
        document=case()
        for role in ("component",None,[],"bogus"):
            changed=alter(document,0,lambda p:p.update(_role=role))
            self.assertEqual(verify(changed)["reason"],"unresolvable_source")
        # A role-free property section remains a singleton, not an arbitrary map.
        raw=document.source.raw+b'\n```json uw:section=debt_structure variant=other\n{"rate_type":"floating"}\n```\n'
        self.assertEqual(verify(parse(raw))["reason"],"not_applicable")

    def test_only_consulted_role_collisions_and_current_revision_selection(self):
        document=case()
        def fence(value,variant):
            return b'\n```json uw:section=debt_structure variant='+variant.encode()+b'\n'+json.dumps(value).encode()+b'\n```\n'
        senior=copy.deepcopy(payload(document,"debt_structure"));senior["_role"]="senior"
        primary={"_role":"primary","rate_type":"floating"}
        raw=document.source.raw+fence(senior,"senior")+fence(primary,"p1")+fence(primary,"p2")
        self.assertEqual(verify(parse(raw))["state"],"verified")
        # Only when the senior selection fails to find a match is primary consulted.
        raw=document.source.raw+fence(primary,"p1")+fence(primary,"p2")
        self.assertEqual(verify(parse(raw))["reason"],"unresolvable_source")
        # Current revision for p1 replaces the prior same-key role; its historical
        # or superseded peer must not create a phantom consulted-role collision.
        raw+=fence({"_role":"component"},"p1")
        self.assertEqual(verify(parse(raw))["reason"],"not_applicable")
        history=fence(primary,"old").replace(b'variant=old',b'variant=old superseded=true')
        self.assertEqual(verify(parse(raw+history))["reason"],"not_applicable")
        for role in ("component","invalid",None):
            raw=document.source.raw+fence(senior,"selected")+fence({"_role":role},"base")
            self.assertEqual(verify(parse(raw))["state"],"verified")

    def test_closed_escrow_facts_and_lawful_absence_are_distinct(self):
        document=case("0070-legacy-escrow")
        self.assertEqual(verify(document)["reason"],"not_applicable")
        for mutate,code in ((lambda p:p["uses"].update(escrows=[]),"ESC-01"),
                (lambda p:p["uses"]["escrows"][0].update(upfront=True),"ESC-01"),
                (lambda p:p["uses"]["escrows"][0].update(monthly=-1),"ESC-01"),
                (lambda p:p["uses"]["escrows"][0].update(label="not-other"),"ESC-02"),
                (lambda p:p["uses"]["escrows"].append(dict(p["uses"]["escrows"][0])),"ESC-02")):
            result=report(alter(document,1,mutate))
            self.assertIn(code,codes(result))
            self.assertEqual(result["replacement_funding_verification"]["reason"],"invalid_structure")
        # Format 4.8's ESC-01 judges the name and funding amounts only; other
        # escrow members are inert, as the reference reads them.
        inert=report(alter(document,1,lambda p:p["uses"]["escrows"][0].update(unknown=1,lender_required="yes")))
        self.assertFalse({"ESC-01","ESC-02"}&set(codes(inert)))

    def test_0081_strike_only_terms_null_and_refused_selection_boundary(self):
        strike=case("0076-two-seniors-no-hedge-escrow")
        self.assertEqual(codes(report(strike)),["ESC-04"])
        self.assertEqual(verify(strike)["reason"],"invalid_structure")
        full=case("0076-two-seniors-replace-escrow")
        self.assertEqual(codes(report(full)),["HDG-08"])
        document=change_hedge(case(),lambda h:[h.pop(k,None) for k in (*("notional","index","effective_date","expiration_date","post_expiration_assumption"),"replacement_funding")])
        document=change_hedge(document,lambda h:h.update(notional=None,index=None,effective_date=None,expiration_date=None,post_expiration_assumption=None,replacement_funding=None))
        self.assertEqual(verify(document)["reason"],"not_applicable")
        partial=change_hedge(document,lambda h:h.update(notional=0))
        self.assertIn("HDG-01",codes(report(partial)))
        self.assertNotEqual(verify(partial)["state"],"verified")

    def test_missing_selection_precedence_and_no_independent_findings_erased(self):
        document=case("0076-sources-refused-malformed-hedge")
        result=report(document)
        self.assertEqual(set(codes(result)),{"HDG-01","HDG-08"})
        self.assertEqual(result["replacement_funding_verification"]["reason"],"unresolvable_source")
        self.assertNotIn("ESC-04",codes(result))
        missing=case("0070-missing-sources-uses")
        self.assertEqual(verify(missing)["reason"],"invalid_structure")
        self.assertIn("ESC-04",codes(report(missing)))
        no_hedge=parse(b'---\nuw_version: "3.0"\n---\n')
        self.assertEqual(verify(no_hedge),dict(state="not_checked",reason="not_applicable",issues=[]))
        mixed=change_hedge(case(),lambda h:h["replacement_funding"]["cash_flow_ref"].update(variant="missing",row_index=-1))
        self.assertEqual(verify(mixed)["reason"],"unresolvable_source")

    def test_shape_before_reference_and_no_false_escrow_exemption(self):
        for name in ("0070-missing-reference","0070-digest-member-missing","0070-unknown-member","0070-unknown-mode"):
            result=report(case(name))
            self.assertEqual(sorted(codes(result)),["ESC-04","HDG-07"])
            self.assertIsNone(result["replacement_funding_verification"]["context"])
        malformed=change_hedge(case(),lambda h:h["replacement_funding"]["cash_flow_ref"].update(binding_digest=None))
        self.assertEqual(codes(report(malformed)),["HDG-08"])

    def test_zero_subcent_sign_and_initial_date_without_expiry_constraint(self):
        document=case()
        for amount,expected in ((0,"failed"),(-0.0,"failed"),(-0.000001,"failed"),(0.000001,"unverifiable")):
            changed=alter(document,2,lambda p:p["series"][1].update(amount=amount))
            self.assertEqual(verify(changed)["state"],expected)
            self.assertEqual("HDG-10" in codes(report(changed)),amount>0)
        for name in ("0070-before-expiration","0070-on-expiration","0070-after-expiration"):
            self.assertEqual(verify(case(name))["state"],"verified")
        invalid=change_hedge(document,lambda h:h.update(effective_date="invalid"))
        self.assertIn("HDG-01",codes(report(invalid)))
        self.assertNotIn("HDG-10",codes(report(invalid)))

    def test_full_selected_cf_source_shape_and_independent_metric_scope(self):
        document=case()
        # Format §4.26 owns CF findings; HDG-08 owns the binding's own row
        # contract (closed rows), and metrics are outside it (V.12 step 3).
        for mutate,cf in ((lambda p:p["series"][0].update(date="2026-02-30"),True),
                (lambda p:p["series"][0].update(date="2029-01-01"),True),
                (lambda p:p["series"][0].update(unknown=1),False),
                (lambda p:p.update(day_count="invented"),True)):
            result=report(alter(document,2,mutate))
            self.assertIn("HDG-08",codes(result))
            self.assertEqual(any(c.startswith("CF-") for c in codes(result)),cf)
            self.assertEqual(result["replacement_funding_verification"]["reason"],"invalid_structure")
        # A stated xirr without a sign change is CF-03 in validation, but a
        # metric is outside the binding (V.12 step 3), as in the reference.
        signs=alter(document,2,lambda p:p.update(stated_metrics={"xirr":0.1}))
        self.assertEqual(codes(report(signs)),[])
        self.assertEqual(verify(signs)["state"],"verified")
        validation=asyncio.run(validate_document(signs,now="2026-10-16T00:00:00Z"))
        self.assertEqual([i["code"] for i in validation["errors"]],["CF-03"])
        good=alter(document,2,lambda p:p.update(stated_metrics={"xnpv":{"rate":0.1,"value":123}}))
        self.assertEqual(verify(good)["state"],"verified")

    def test_currency_raw_identity_context_and_hd09_separation(self):
        document=case()
        stale=parse(document.source.raw.replace(b"currency_code: USD",b"currency_code: EUR"))
        result=report(stale);verdict=result["replacement_funding_verification"]
        self.assertEqual(result["structural_issues"],[])
        self.assertEqual((verdict["state"],verdict["reason"]),("failed","stale_binding"))
        self.assertEqual([i["code"] for i in verdict["issues"]],["HDG-09"])
        self.assertEqual(verdict["context"],dict(debt_variant="base",cash_flow_variant="cap-cash",row_index=1,currency_code="EUR"))
        self.assertNotEqual(verdict["stated_digest"],verdict["computed_digest"])
        malformed=parse(document.source.raw.replace(b"currency_code: USD",b'currency_code: " usd "'))
        self.assertEqual(codes(report(malformed)),["CUR-01"])
        self.assertIsNone(verify(malformed)["context"])

    def test_hash_unavailable_is_not_mismatch_and_structure_never_hashes(self):
        async def unavailable(_):raise RuntimeError("provider unavailable")
        document=case()
        result=report(document,hash_provider=unavailable)
        self.assertEqual(result["structural_issues"],[])
        verdict=result["replacement_funding_verification"]
        self.assertEqual((verdict["state"],verdict["reason"]),("unverifiable","crypto_unavailable"))
        self.assertEqual((verdict["issues"],verdict["structural_issues"]),([],[]))
        self.assertNotIn("computed_digest",verdict)
        self.assertEqual(check_replacement_funding_structure(document),[])
        async def must_not_hash(_):raise AssertionError("invalid structure reached hash")
        bad=case("0070-bad-index-0_5")
        self.assertEqual(verify(bad,hash_provider=must_not_hash)["reason"],"invalid_structure")
        self.assertEqual(verify(case("0070-legacy-escrow"),hash_provider=must_not_hash)["reason"],"not_applicable")

    def test_snapshot_before_await_read_only_and_detached_evidence(self):
        import hashlib
        document=case();before=copy.deepcopy(document)
        async def mutating_provider(preimage):
            await asyncio.sleep(0)
            payload(document,"cash_flow_series")["series"][1]["amount"]=-1
            payload(document,"debt_structure")["rate_hedge"]["replacement_funding"]["cash_flow_ref"]["row_index"]=0
            document.frontmatter.value["currency_code"]="EUR"
            return "sha256:"+hashlib.sha256(preimage).hexdigest()
        result=verify(document,hash_provider=mutating_provider)
        self.assertEqual(result["state"],"verified")
        self.assertEqual((result["context"]["row_index"],result["context"]["currency_code"]),(1,"USD"))
        untouched=case();self.assertEqual(verify(untouched)["state"],"verified")
        self.assertEqual(untouched,before)
        result["context"]["currency_code"]="GBP"
        self.assertEqual(verify(untouched)["context"]["currency_code"],"USD")


if __name__ == "__main__":
    unittest.main()
