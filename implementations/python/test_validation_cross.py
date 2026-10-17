"""Accepted CC operand/selection controls; no CLI or complete tier claim."""
import copy
import json
import math
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate
from test_validation_external import external
from uwmd_reader import parse


def stack(amount=1000, rate=.0625):
    return {"tranches": [dict(id="senior", position=1, amount=amount,
                             rate=rate, **{"class": "senior_debt"})]}


def report(raw):
    parsed = parse(raw)
    before = copy.deepcopy(parsed)
    result = validate(parsed)
    if parsed != before:
        raise AssertionError("Validation changed its source snapshot")
    return result, [issue for issue in result["issues"] if issue["code"] == "CC-03"]


class ValidationCrossTests(unittest.TestCase):
    def test_canonical_interest_rate_wins_and_unknown_rate_pct_is_not_alias(self):
        for canonical, shortcut, mismatch in ((.0625, .9, False), (.07, .0625, True)):
            with self.subTest(canonical=canonical):
                raw = HEADER + block("debt_structure", dict(interest_rate=canonical, rate_pct=shortcut))
                raw += block("capital_stack", stack())
                result, issues = report(raw)
                self.assertEqual(len(issues), int(mismatch))
                self.assertEqual(result["coverage"]["CC-03"]["status"], "evaluated")
                if mismatch:
                    self.assertEqual(issues[0]["severity"], "error")
                    self.assertEqual(issues[0]["value"], dict(stated=.0625, comparison=.07))

    def test_missing_null_and_wrong_type_do_not_fall_back_or_become_zero(self):
        for payload in ({}, {"interest_rate": None}, {"interest_rate": False},
                        {"interest_rate": ".0625"}, {"interest_rate": []}):
            with self.subTest(payload=payload):
                raw = HEADER + block("sources_uses") + block("debt_structure", {**payload, "rate_pct": .99})
                raw += block("capital_stack", stack())
                result, issues = report(raw)
                self.assertEqual(issues, [])
                self.assertEqual(result["coverage"]["CC-03"]["reason"], "field_absent")
        raw = HEADER + block("sources_uses") + block("debt_structure", dict(interest_rate=.0625))
        for rate in (None, False, ".0625"):
            with self.subTest(tranche_rate=rate):
                result, issues = report(raw + block("capital_stack", stack(rate=rate)))
                self.assertEqual(issues, [])
                self.assertEqual(result["coverage"]["CC-03"]["reason"], "field_absent")

    def test_rate_agreement_is_exact_and_zero_is_a_stated_finite_operand(self):
        for left, right, mismatch in ((0, 0, False), (0, .0625, True),
                (.0625, math.nextafter(.0625, math.inf), True)):
            with self.subTest(left=left, right=right):
                raw = HEADER + block("debt_structure", dict(interest_rate=left))
                result, issues = report(raw + block("capital_stack", stack(rate=right)))
                self.assertEqual(len(issues), int(mismatch))
                self.assertEqual(result["coverage"]["CC-03"]["status"], "evaluated")

    def test_independent_amount_legs_preserve_100_dollar_tolerance_without_stack(self):
        # No stack: the existing senior sources/debt amount comparison remains.
        for amount, mismatch in ((1100, False), (1101, True)):
            with self.subTest(amount=amount):
                raw = HEADER + block("debt_structure", dict(loan_amount=1000))
                raw += block("sources_uses", dict(sources={"loan_amount": amount}))
                result, issues = report(raw)
                self.assertEqual(len(issues), int(mismatch))
                self.assertEqual(result["coverage"]["CC-03"]["status"], "evaluated")
        # No debt statement: a usable stack/sources leg still evaluates.
        raw = HEADER + block("sources_uses", dict(sources={"loan_amount": 1200}))
        result, issues = report(raw + block("capital_stack", stack()))
        self.assertEqual(len(issues), 1)
        self.assertEqual(result["coverage"]["CC-03"]["status"], "evaluated")
        self.assertEqual(issues[0]["value"], dict(stated=1000, comparison=1200))

    def test_exact_senior_role_and_collision_keep_other_usable_legs(self):
        raw = HEADER + block("debt_structure", dict(interest_rate=.9), variant="component", role="component")
        raw += block("debt_structure", dict(interest_rate=.0625), variant="selected", role="senior")
        raw += block("capital_stack", stack())
        result, issues = report(raw)
        self.assertEqual(issues, [])
        evidence = result["coverage"]["CC-03"]["resolutions"]["debt_structure"]
        self.assertEqual(evidence, dict(variant="selected", via="role"))
        raw += block("debt_structure", dict(interest_rate=.99), variant="collision", role="senior")
        raw += block("sources_uses", dict(sources={"loan_amount": 1200}))
        result, issues = report(raw)
        self.assertEqual(len(issues), 1)  # Stack/sources; no guessed debt-rate leg.
        self.assertEqual(issues[0]["value"], dict(stated=1000, comparison=1200))
        self.assertEqual(result["coverage"]["CC-03"]["status"], "evaluated")
        self.assertTrue(any(i["code"] == "CC-16" and i["section"] == "debt_structure"
                            for i in result["issues"]))

    def test_current_history_and_external_availability_do_not_infer_rate(self):
        raw = HEADER + block("debt_structure", dict(interest_rate=.9), superseded=True)
        raw += block("debt_structure", dict(interest_rate=.0625))
        result, issues = report(raw + block("capital_stack", stack()))
        self.assertEqual(issues, [])
        # A present selected external debt statement has no available coupon.
        raw = HEADER + external("debt_structure")
        raw += block("sources_uses", dict(sources={"loan_amount": 1000}))
        result, issues = report(raw + block("capital_stack", stack()))
        self.assertEqual(issues, [])
        self.assertEqual(result["coverage"]["CC-03"]["status"], "evaluated")
        self.assertEqual(result["composition_assessment"]["status"], "unresolved")

    def test_frozen_senior_reconciliation_document_assertions_unchanged(self):
        root = ROOT / "conformance/capital-stack/senior-reconciles-debt-structure"
        expected = json.loads((root / "expected.json").read_text(encoding="utf8"))
        for name in ("agree", "mismatch"):
            with self.subTest(name=name):
                path = root / (name + ".uwx.md")
                raw = path.read_bytes()
                result, _ = report(raw)
                actual = [i["code"] for i in result["issues"] if i["code"].startswith(("CS-", "CC-03"))]
                self.assertEqual(actual, expected[name + "_codes"])
                self.assertEqual(path.read_bytes(), raw)
        # These are only the frozen document diagnostic assertions, not stack
        # sizing recomputation, a portable case execution or a capability pass.


class ValidationLTVOperandTests(unittest.TestCase):
    """RFC 0079 D2 / Protocol XIII.2 denominator evidence, not new ratio policy."""

    def inspect(self, debt, valuation, *, prefix=b""):
        document=parse(HEADER+prefix+block("debt_structure",debt)+block("valuation",valuation))
        before=copy.deepcopy(document)
        result=validate(document)
        self.assertEqual(document,before)
        issues=[i for i in result["issues"] if i["code"]=="CC-02"]
        return result,issues

    def test_stated_underwritten_value_is_used_instead_of_purchase_price(self):
        result,issues=self.inspect(dict(loan_amount=50,ltv=.5),
                                   dict(underwritten_value=100,purchase_price=200))
        self.assertEqual(issues,[])
        self.assertEqual(result["coverage"]["CC-02"]["status"],"evaluated")
        result,issues=self.inspect(dict(loan_amount=50,ltv=.25),
                                   dict(underwritten_value=100,purchase_price=200))
        self.assertEqual(len(issues),1)
        self.assertEqual((issues[0]["code"],issues[0]["severity"]),("CC-02","warning"))
        self.assertEqual(issues[0]["value"],dict(stated=.25,comparison=.5))

    def test_only_absent_or_null_underwritten_value_uses_purchase_price(self):
        for valuation in (dict(purchase_price=200),
                          dict(underwritten_value=None,purchase_price=200)):
            with self.subTest(valuation=valuation):
                result,issues=self.inspect(dict(loan_amount=50,ltv=.25),valuation)
                self.assertEqual(issues,[])
                self.assertEqual(result["coverage"]["CC-02"]["status"],"evaluated")

    def test_stated_zero_or_invalid_underwritten_value_never_uses_price(self):
        for value in (0,False,"100",[],{}):
            with self.subTest(underwritten_value=value):
                result,issues=self.inspect(dict(loan_amount=50,ltv=.25),
                    dict(underwritten_value=value,purchase_price=200))
                self.assertEqual(issues,[])
                self.assertEqual(result["coverage"]["CC-02"]["reason"],"field_absent")

    def test_missing_null_or_nonnumber_operands_do_not_infer_values(self):
        cases=[({},dict(underwritten_value=100)),
               (dict(loan_amount=None,ltv=.5),dict(underwritten_value=100)),
               (dict(loan_amount=True,ltv=.5),dict(underwritten_value=100)),
               (dict(loan_amount=50),dict(underwritten_value=100)),
               (dict(loan_amount=50,ltv=None),dict(underwritten_value=100)),
               (dict(loan_amount=50,ltv=".5"),dict(underwritten_value=100)),
               (dict(loan_amount=50,ltv=.5),{}),
               (dict(loan_amount=50,ltv=.5),dict(purchase_price=False))]
        for debt,valuation in cases:
            with self.subTest(debt=debt,valuation=valuation):
                result,issues=self.inspect(debt,valuation)
                self.assertEqual(issues,[])
                self.assertEqual(result["coverage"]["CC-02"]["reason"],"field_absent")

    def test_zero_loan_is_stated_and_existing_half_percent_threshold_is_exact(self):
        # Zero numerator makes the published .005 boundary directly representable
        # as the authored float; no hand-derived financial model is introduced.
        for stated,mismatch in ((0,False),(.005,False),(math.nextafter(.005,math.inf),True)):
            result,issues=self.inspect(dict(loan_amount=0,ltv=stated),dict(underwritten_value=100))
            self.assertEqual(len(issues),int(mismatch))
            self.assertEqual(result["coverage"]["CC-02"]["status"],"evaluated")

    def test_selected_senior_ignores_unselected_and_superseded_operands(self):
        raw=HEADER+block("debt_structure",dict(loan_amount=99,ltv=.99),
                         variant="irrelevant",role="component")
        raw+=block("debt_structure",dict(loan_amount=99,ltv=.99),variant="old",
                   role="senior",superseded=True)
        raw+=block("debt_structure",dict(loan_amount=50,ltv=.5),variant="senior",role="senior")
        raw+=block("valuation",dict(underwritten_value=100))
        document=parse(raw);before=copy.deepcopy(document);result=validate(document)
        self.assertEqual(document,before)
        self.assertFalse(any(i["code"]=="CC-02" for i in result["issues"]))
        self.assertEqual(result["coverage"]["CC-02"],
            dict(status="evaluated",resolutions={"debt_structure":dict(variant="senior",via="role")}))
        raw+=block("debt_structure",dict(loan_amount=1,ltv=.01),variant="collision",role="senior")
        result=validate(parse(raw))
        self.assertEqual(result["coverage"]["CC-02"]["reason"],"variant_unresolvable")
        self.assertTrue(any(i["code"]=="CC-16" and i["section"]=="debt_structure"
                            for i in result["issues"]))
        self.assertFalse(any(i["code"]=="CC-02" for i in result["issues"]))

    def test_unresolved_external_selected_operand_never_uses_local_peer_or_marker(self):
        for section in ("debt_structure","valuation"):
            raw=HEADER
            if section=="debt_structure":
                raw+=external(section,loan_amount=50,ltv=.9)
                raw+=block("valuation",dict(underwritten_value=100))
            else:
                raw+=block("debt_structure",dict(loan_amount=50,ltv=.9))
                raw+=external(section,underwritten_value=100)
            document=parse(raw);before=copy.deepcopy(document);result=validate(document)
            self.assertEqual(document,before)
            self.assertEqual(result["coverage"]["CC-02"]["reason"],"field_absent")
            self.assertFalse(any(i["code"]=="CC-02" for i in result["issues"]))


if __name__ == "__main__":
    unittest.main()
