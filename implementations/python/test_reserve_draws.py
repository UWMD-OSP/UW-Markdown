"""VIII.12 frozen/shared and adversarial evidence; no tier/calc capability claim."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from test_reader import block
from uwmd import main
from uwmd_binding_sources import cash_source_issues, lease_source_issues
from uwmd_envelope import semantic_envelope, source_digest
from uwmd_reader import parse
from uwmd_reserve_draws import verify_reserve_draw_bindings
from uwmd_reserves import verify_reserve_accounts

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "conformance/reserve-draw-bindings"


def case(name="one-to-one"):
    folder = FOLDER / name
    return (parse((folder / "deal.uwx.md").read_bytes()),
            json.loads((folder / "plan.json").read_text(encoding="utf-8")))


def rebind(document, plan):
    updated = copy.deepcopy(plan)
    updated["source_digest"] = source_digest(document)
    return updated


def alter(document, index, change):
    source = document.source.blocks[index]
    payload = copy.deepcopy(source.parsed.value)
    change(payload)
    replacement = json.dumps(payload, ensure_ascii=True).encode("utf-8") + b"\n"
    raw = document.source.raw[:source.body_span.start] + replacement + document.source.raw[source.body_span.end:]
    return parse(raw)


class ReserveDrawTests(unittest.TestCase):
    def test_all_46_unchanged_cases_using_actual_shared_subprocess_comparison(self):
        spec = importlib.util.spec_from_file_location("shared_draw_driver", ROOT / "conformance/runner/runner.py")
        driver = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(driver)
        paths = sorted((ROOT / "conformance/runner/cases").glob("verifier__reserve-draw-bindings__*__verify-reserve-draws.case.json"))
        self.assertEqual(len(paths), 46)
        for path in paths:
            frozen = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(frozen["requires_capabilities"], ["parse", "calc-evaluate"])
            with self.subTest(case=frozen["id"]):
                _, problems = driver.run_case([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py")], frozen, 60)
                self.assertEqual(problems, [])
        # Direct case execution deliberately does not alter catalogue selection,
        # generated cases, expectations or manifest flags to fake certification.
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse"])
        for command in ("validate", "calc"):
            self.assertNotEqual(main([command, "unused"])[1], 0)

    def test_frozen_superseded_source_digest_without_json_injection(self):
        document, plan = case("superseded-source")
        before = copy.deepcopy(document)
        self.assertEqual(source_digest(document), plan["source_digest"])
        envelope = semantic_envelope(document)
        historical = envelope["superseded"]["cash_flow_series"][0]
        self.assertTrue(historical["annotation"]["superseded"])
        self.assertNotIn("superseded", historical["content"]["_meta"]["lifecycle"])
        self.assertEqual(verify_reserve_draw_bindings(document, plan)["issues"][0]["code"], "RDB-03")
        self.assertEqual(document, before)
        reserve = document.source.blocks[0]
        raw = document.source.raw.replace(b"uw:section=reserve_accounts", b"uw:section=reserve_accounts superseded=true", 1)
        history = parse(raw)
        result = verify_reserve_accounts(history)
        self.assertEqual((result["state"], result["reason"]), ("not_checked", "not_applicable"))
        self.assertIsNone(result["source_digest"])
        self.assertEqual(semantic_envelope(history)["superseded"]["reserve_accounts"][0]["content"], reserve.parsed.value)

    def test_omitted_null_and_invalid_duplicate_plan_precede_digest_work(self):
        document, plan = case()
        with patch("uwmd_reserve_draws.source_digest", side_effect=AssertionError("must not hash")):
            omitted = verify_reserve_draw_bindings(document)
            self.assertEqual((omitted["state"], omitted["reason"]), ("not_checked", "not_applicable"))
            self.assertIsNone(omitted["source_digest"])
            self.assertEqual(verify_reserve_draw_bindings(document, None)["issues"][0]["code"], "RDB-01")
            duplicate = copy.deepcopy(plan)
            duplicate["bindings"].append(copy.deepcopy(duplicate["bindings"][0]))
            result = verify_reserve_draw_bindings(document, duplicate)
            self.assertEqual((result["state"], result["reason"]), ("unverifiable", "invalid_structure"))
            self.assertEqual([i["code"] for i in result["issues"]], ["RDB-05"])
        for bad in (True, -1, 0.5, 9007199254740992):
            changed = copy.deepcopy(plan)
            changed["expenditures"][0]["ref"]["row_index"] = bad
            self.assertEqual(verify_reserve_draw_bindings(document, changed)["reason"], "invalid_structure")
        changed = copy.deepcopy(plan)
        changed["expenditures"][0]["ref"]["row_index"] = 0.0
        self.assertEqual(verify_reserve_draw_bindings(document, changed)["state"], "verified")

    def test_digest_unavailable_and_stale_precede_source_resolution(self):
        document, plan = case()
        plan["selected_draws"][0]["movement_id"] = "missing"
        plan["bindings"][0]["draw"]["movement_id"] = "missing"
        plan["source_digest"] = "sha256:" + "0" * 64
        stale = verify_reserve_draw_bindings(document, plan)
        self.assertEqual((stale["state"], stale["reason"]), ("failed", "stale_binding"))
        self.assertEqual([i["code"] for i in stale["issues"]], ["RDB-02"])
        self.assertEqual(stale["evidence"], [])
        raw = document.source.raw + block("x_opaque", {"n": "SURROGATE"}).replace(b'"SURROGATE"', b'"\\ud800"')
        unavailable = verify_reserve_draw_bindings(parse(raw), plan)
        self.assertEqual((unavailable["state"], unavailable["reason"]), ("unverifiable", "digest_unavailable"))
        self.assertEqual(unavailable["issues"], [])

    def test_exact_null_named_variant_and_active_ambiguity(self):
        document, plan = case()
        for variant in ("default", "base"):
            changed = copy.deepcopy(plan)
            changed["selected_draws"][0]["variant"] = variant
            changed["bindings"][0]["draw"]["variant"] = variant
            self.assertEqual(verify_reserve_draw_bindings(document, changed)["issues"][0]["code"], "RDB-03")
        duplicate = parse(document.source.raw + block("reserve_accounts", document.source.blocks[0].parsed.value))
        result = verify_reserve_draw_bindings(duplicate, rebind(duplicate, plan))
        self.assertEqual(result["issues"][0]["code"], "RDB-03")
        historical = copy.deepcopy(document.source.blocks[0].parsed.value)
        historical["_meta"]["lifecycle"]["superseded"] = True
        extra = parse(document.source.raw + block("reserve_accounts", historical))
        self.assertEqual(verify_reserve_draw_bindings(extra, rebind(extra, plan))["state"], "verified")

    def test_selected_variant_full_validation_and_original_whole_source_digest(self):
        document, plan = case()
        malformed = copy.deepcopy(document.source.blocks[0].parsed.value)
        malformed["accounts"][0]["owner"] = ""
        augmented = parse(document.source.raw + block("reserve_accounts", malformed, variant="unselected"))
        result = verify_reserve_draw_bindings(augmented, rebind(augmented, plan))
        self.assertEqual(result["state"], "verified")
        self.assertEqual(result["source_digest"], source_digest(augmented))
        self.assertNotEqual(result["source_digest"], source_digest(document))
        self.assertEqual(verify_reserve_accounts(augmented)["state"], "unverifiable")
        def add_invalid_account(payload):
            account = copy.deepcopy(payload["accounts"][0])
            account["account_id"], account["owner"] = "not-selected-account", ""
            payload["accounts"].append(account)
        selected_bad = alter(document, 0, add_invalid_account)
        refused = verify_reserve_draw_bindings(selected_bad, rebind(selected_bad, plan))
        self.assertEqual(refused["issues"][0]["code"], "RDB-04")
        self.assertTrue(any(i["code"] == "RSV-01" for i in refused["issues"][0]["value"]))

    def test_invalid_source_precedes_totals_and_keeps_other_finite_edges(self):
        document, plan = case("one-to-one")
        extra = copy.deepcopy(plan["expenditures"][0])
        extra["expenditure_id"], extra["ref"]["row_index"] = "missing-expense", 100
        plan["expenditures"].append(extra)
        plan["bindings"][0]["funded_amount"] = 50
        result = verify_reserve_draw_bindings(document, plan)
        self.assertEqual((result["state"], result["reason"]), ("unverifiable", "invalid_source"))
        self.assertEqual([i["code"] for i in result["issues"]], ["RDB-03"])
        self.assertEqual(len(result["evidence"]), 1)
        self.assertEqual(result["evidence"][0]["funded_amount"], 50)

    def test_closed_source_shapes_validate_every_row_without_metric_evaluation(self):
        document, plan = case()
        for row in ({"date": "2026-02-30", "amount": 0},
                    {"date": "2025-01-01", "amount": 0},
                    {"date": "2026-01-21", "amount": True},
                    {"date": "2026-01-21", "amount": 0, "unknown": 1}):
            changed = alter(document, 1, lambda payload: payload["series"].append(row))
            result = verify_reserve_draw_bindings(changed, rebind(changed, plan))
            self.assertEqual(result["issues"][0]["code"], "RDB-04")
        cash = copy.deepcopy(document.source.blocks[1].parsed.value)
        cash["stated_metrics"] = {"xnpv": {"rate": 0.1, "value": -999999}}
        self.assertEqual(cash_source_issues(cash), [])  # Shape, no xnpv recomputation.
        for change in (lambda p: p.update(day_count="unknown"),
                       lambda p: p["series"][0].update(kind="unknown"),
                       lambda p: p.update(stated_metrics={"xnpv": {"rate": True, "value": 0}})):
            value = copy.deepcopy(cash)
            change(value)
            self.assertTrue(cash_source_issues(value))

    def test_lease_source_registered_model_closed_ranges_and_contiguity(self):
        document, plan = case("lease-up-component")
        original = copy.deepcopy(document.source.blocks[2].parsed.value)
        self.assertEqual(lease_source_issues(original), [])
        for change in (lambda p: p.update(model_type="unregistered"),
                       lambda p: p.update(stabilization_target="2025-12"),
                       lambda p: p["schedule"].append({"period": "2026-03", "ti_lc_capex": -1}),
                       lambda p: p["schedule"][0].update(vacancy_rate=2),
                       lambda p: p.update(assumptions={"leasing_commission_rate": -1}),
                       lambda p: p.update(stabilized_summary={"occupancy_rate": 2}),
                       lambda p: p["schedule"][0].update(unregistered=1)):
            value = copy.deepcopy(original)
            change(value)
            self.assertTrue(lease_source_issues(value))
            changed = alter(document, 2, change)
            self.assertEqual(verify_reserve_draw_bindings(changed, rebind(changed, plan))["issues"][0]["code"], "RDB-04")
        result = verify_reserve_draw_bindings(document, plan)
        expense = result["evidence"][0]["expenditure"]
        self.assertIsNone(expense["date"])
        self.assertEqual(expense["period"], "2026-01")
        self.assertEqual(expense["source_path"], "lease_up_schedule.schedule@2026-01.ti_lc_capex")

    def test_positive_quantum_and_gross_sign_are_separate_boundaries(self):
        document, plan = case()
        for location in ("binding", "expenditure"):
            changed = copy.deepcopy(plan)
            target = changed["bindings"][0] if location == "binding" else changed["expenditures"][0]
            target["funded_amount"] = 0.001
            self.assertEqual(verify_reserve_draw_bindings(document, changed)["reason"], "invalid_structure")
        for value in (None, 0, -0.001, 100):
            changed = alter(document, 1, lambda payload: payload["series"][0].update(amount=value))
            result = verify_reserve_draw_bindings(changed, rebind(changed, plan))
            self.assertEqual(result["state"], "unverifiable")
            self.assertEqual(result["issues"][0]["code"], "RDB-04" if value is None else "RDB-06")

    def test_overflow_retains_edges_and_later_finite_mismatch(self):
        document, plan = case("nonfinite-allocation")
        result = verify_reserve_draw_bindings(document, plan)
        self.assertEqual((result["state"], result["reason"]), ("unverifiable", "nonfinite_arithmetic"))
        self.assertEqual([i["code"] for i in result["issues"]], ["RDB-09"] * 4)
        self.assertEqual([e["binding_index"] for e in result["evidence"]], [0, 1, 2, 3])
        # A later independently finite draw/expenditure still gets its own
        # mismatch findings after earlier independent totals overflow.
        def add_finite_account(payload):
            account = copy.deepcopy(payload["accounts"][0])
            account["account_id"] = "finite-later-account"
            period = copy.deepcopy(account["periods"][0])
            period["period_id"] = "finite-later-period"
            period.pop("previous_period_id", None)
            movement = copy.deepcopy(period["movements"][0])
            movement.update(movement_id="finite-later-draw", kind="internal_draw", amount=10)
            period.update(opening_balance=10, ending_balance=0, movements=[movement])
            account["periods"] = [period]
            payload["accounts"].append(account)
        extended = alter(document, 0, add_finite_account)
        row_index = len(extended.source.blocks[1].parsed.value["series"])
        extended = alter(extended, 1, lambda payload: payload["series"].append(
            {"date": payload["series"][-1]["date"], "amount": -10, "kind": "capex"}))
        changed = copy.deepcopy(plan)
        draw = dict(variant=None, account_id="finite-later-account",
                    period_id="finite-later-period", movement_id="finite-later-draw")
        expenditure = copy.deepcopy(changed["expenditures"][0])
        expenditure.update(expenditure_id="finite-later-expense", funded_amount=10)
        expenditure["ref"]["row_index"] = row_index
        changed["selected_draws"].append(draw)
        changed["expenditures"].append(expenditure)
        changed["bindings"].append(dict(draw=draw, expenditure_id="finite-later-expense", funded_amount=9))
        later = verify_reserve_draw_bindings(extended, rebind(extended, changed))
        self.assertEqual((later["state"], later["reason"]), ("unverifiable", "nonfinite_arithmetic"))
        self.assertEqual([i["code"] for i in later["issues"]],
                         ["RDB-09", "RDB-09", "RDB-07", "RDB-09", "RDB-09", "RDB-08"])
        self.assertEqual(len(later["evidence"]), 5)
        # No nonfinite running sum escapes into evidence/wire JSON.
        json.dumps(result, allow_nan=False)
        json.dumps(later, allow_nan=False)
        cent, cent_plan = case("cent-split-draw")
        self.assertEqual(verify_reserve_draw_bindings(cent, cent_plan)["state"], "verified")
        wrong, wrong_plan = case("cent-one-cent-unallocated")
        self.assertEqual(verify_reserve_draw_bindings(wrong, wrong_plan)["issues"][0]["code"], "RDB-07")

    def test_read_only_evidence_order_and_snapshot_both_inputs(self):
        document, plan = case("many-to-many-partial")
        before_document, before_plan = copy.deepcopy(document), copy.deepcopy(plan)
        result = verify_reserve_draw_bindings(document, plan)
        self.assertEqual(result["state"], "verified")
        self.assertEqual([e["binding_index"] for e in result["evidence"]], list(range(len(plan["bindings"]))))
        self.assertEqual(document, before_document)
        self.assertEqual(plan, before_plan)
        result["evidence"][0]["draw"]["source"]["document"] = "result mutation"
        self.assertEqual(document, before_document)
        self.assertEqual(plan, before_plan)
        def mutate_callers(snapshot):
            document.source.blocks[0].parsed.value["accounts"] = []
            plan["bindings"] = []
            return source_digest(snapshot)
        with patch("uwmd_reserve_draws.source_digest", side_effect=mutate_callers):
            snapshotted = verify_reserve_draw_bindings(document, plan)
        self.assertEqual(snapshotted["state"], "verified")


if __name__ == "__main__":
    unittest.main()
