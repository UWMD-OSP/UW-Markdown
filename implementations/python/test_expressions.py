"""Grammar/reference evidence only; no expression is executed by these controls."""
from dataclasses import FrozenInstanceError
import json
from pathlib import Path
import unittest

from uwmd import main
from uwmd_expressions import (ExpressionError, Reference, blocked_references, check_reference_structure,
                              expression_references, parse_expression)


ROOT = Path(__file__).resolve().parents[2]


def reference(head, *members, selector=None, after=None):
    return ("reference", Reference(head, tuple(members), selector, after))


class ExpressionTests(unittest.TestCase):
    def refusal(self, code, function, *arguments):
        with self.assertRaises(ExpressionError) as caught:
            function(*arguments)
        self.assertEqual(caught.exception.code, code)

    def test_numeric_literal_lexemes_are_retained_without_evaluation(self):
        for spelling in ("0", "00", "01.2300", "9007199254740993", "9" * 5000):
            self.assertEqual(parse_expression(spelling), ("number", spelling))
        self.assertEqual(parse_expression("-0"), ("unary", "-", ("number", "0")))
        for bad in ("1e3", "1E-3", ".5", "1.", "+1", "0x10", "NaN +", "1_000"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_multiplicative_additive_and_logical_precedence_is_structural(self):
        self.assertEqual(parse_expression("a + b * c - d / e % f"),
            ("binary", "-", ("binary", "+", reference("a"),
                ("binary", "*", reference("b"), reference("c"))),
             ("binary", "%", ("binary", "/", reference("d"), reference("e")), reference("f"))))
        self.assertEqual(parse_expression("a || b && c == -d"),
            ("binary", "||", reference("a"), ("binary", "&&", reference("b"),
                ("binary", "==", reference("c"), ("unary", "-", reference("d"))))))
        self.assertEqual(parse_expression("!(a < b)"),
                         ("unary", "!", ("binary", "<", reference("a"), reference("b"))))
        for bad in ("a < b < c", "a == b != c", "--1", "!!true", "-!true"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)
        parse_expression("a < (b < c)")  # Grammar admission is not a type verdict.

    def test_ternaries_are_right_associative_and_both_branches_parse(self):
        self.assertEqual(parse_expression("a ? b : c ? d : e"),
            ("conditional", reference("a"), reference("b"),
                ("conditional", reference("c"), reference("d"), reference("e"))))
        self.assertEqual(parse_expression("a ? b ? c : d : e"),
            ("conditional", reference("a"),
                ("conditional", reference("b"), reference("c"), reference("d")), reference("e")))
        for bad in ("true ? 1 : (x = 2)", "false && (x = 2)", "true || (x = 2)", "a ? b", "a : b"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_strings_are_literal_single_quoted_content_without_escapes(self):
        for content in ("", "a.b@Y1", "a\\n", "Café", "a\nb", '"quoted"', "!"):
            self.assertEqual(parse_expression("'" + content + "'"), ("string", content))
        self.assertEqual(parse_expression("'true'"), ("string", "true"))
        self.assertEqual(parse_expression("true"), ("boolean", True))
        self.assertEqual(parse_expression("false"), ("boolean", False))
        self.assertEqual(parse_expression("null"), ("null",))
        for bad in ('"double"', "'unterminated", "'a' 'b'", "'a\\'b'"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_calls_are_syntax_only_and_preserve_arguments(self):
        self.assertEqual(parse_expression("unknown()"), ("call", "unknown", ()))
        self.assertEqual(parse_expression("if(true, f(a), null)"),
            ("call", "if", (("boolean", True), ("call", "f", (reference("a"),)), ("null",))))
        self.assertEqual(parse_expression("pow(a, pow(b, c))"),
            ("call", "pow", (reference("a"), ("call", "pow", (reference("b"), reference("c"))))))
        for valid in ("pow(1.2, 31)", "irr(-100, 110)", "is_calendar_date()", "1 / 0", "null ? 1 : 2"):
            # Runtime domains, arity, convergence and null ternary behavior are
            # outside parsing; no numerical-policy choice is made here.
            parse_expression(valid)
        for bad in ("f(,a)", "f(a,)", "f(a b)", "f()()", "a.b()", "(f)(a)"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_reference_inventory_keeps_literal_members_and_syntax_order(self):
        tree = parse_expression("f(a['x.y'], a.x.y, a['x@y'], a) ? b : a")
        self.assertEqual(expression_references(tree), (
            Reference("a", ("x.y",)), Reference("a", ("x", "y")), Reference("a", ("x@y",)),
            Reference("a"), Reference("b"), Reference("a")))
        self.assertEqual(expression_references(parse_expression("false && unavailable")), (Reference("unavailable"),))
        self.assertEqual(expression_references(parse_expression("'a.x'")), ())
        with self.assertRaises(FrozenInstanceError):
            expression_references(tree)[0].head = "changed"
        for bad in ("a[0]", "a[]", "a[b]", "a.", "(a).b", "a[true]"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_period_node_retains_root_series_identity_and_leaf_boundaries(self):
        for selector in ("Y3", "2028-Q1", "2028-02", "0000-02-29"):
            tree = parse_expression("dcf.annual_cash_flows@" + selector + "['x.y']['0']-1")
            self.assertEqual(tree, ("binary", "-",
                reference("dcf", "annual_cash_flows", "x.y", "0", selector=selector, after=1), ("number", "1")))
            check_reference_structure(tree)
        self.assertEqual(expression_references(parse_expression("dcf['annual_cash_flows'] @ Y3.noi")),
            (Reference("dcf", ("annual_cash_flows", "noi"), "Y3", 1),))
        for bad in ("a@Y1", "a.b@Y1@Y2", "a.b@Y01", "a.b@Y0", "a.b@Q1", "a.b@2026-Q5"):
            self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_static_reference_checks_are_separate_from_grammar_and_source_lookup(self):
        for formula, code in [("dcf.unknown@Y1.noi", "CALC-PERIOD-001"),
                              ("dcf.annual_cash_flows.more@Y1", "CALC-PERIOD-001"),
                              ("cash_flow_series.series@2026-02-30.amount", "CALC-PERIOD-001"),
                              ("lease_up_schedule.schedule@2026-13.amount", "CALC-PERIOD-001"),
                              ("dcf.annual_cash_flows@Y9007199254740992.noi", "CALC-PERIOD-001")]:
            tree = parse_expression(formula)
            self.refusal(code, check_reference_structure, tree)
        check_reference_structure(parse_expression("unknown.absent + f(missing)"))
        check_reference_structure(parse_expression("a['literal.constructor']"))
        for formula, expected in [("a.constructor", Reference("a", ("constructor",))),
                                  ("a['__proto__']", Reference("a", ("__proto__",))),
                                  ("prototype.x", Reference("prototype", ("x",))),
                                  ("dcf.annual_cash_flows@Y1['constructor']",
                                   Reference("dcf", ("annual_cash_flows", "constructor"), "Y1", 1))]:
            # Valid grammar; safe traversal is unimplemented, so static spelling
            # inventory cannot be promoted to a normative parse/runtime refusal.
            tree = parse_expression(formula)
            check_reference_structure(tree)
            self.assertEqual(blocked_references(tree), (expected,))
        self.assertEqual(blocked_references(parse_expression("a['literal.constructor']")), ())
        self.assertEqual(blocked_references(parse_expression("'a.constructor'")), ())

    def test_host_language_and_incomplete_input_refuse(self):
        for bad in (None, True, 1, "", " ", "x = 1", "x => x", "lambda x: x", "for(;;)",
                    "[1, 2]", "{x: 1}", "a; b", "a ** b", "a ^ b", "a & b", "a | b", "a // b", "a # comment",
                    "/*comment*/ 1", "a += 1", "a[0] = 1", "a...b", "a @", "a.b@", "(a", "a)"):
            with self.subTest(formula=bad):
                self.refusal("CALC-PARSE-001", parse_expression, bad)

    def test_host_limits_refuse_explicitly_and_flat_inventory_is_iterative(self):
        self.refusal("CALC-LIMIT-001", parse_expression, "(" * 100 + "1" + ")" * 100)
        self.refusal("CALC-LIMIT-001", parse_expression, "+".join(["a"] * 6000))
        tree = parse_expression("+".join(["a"] * 1000))
        self.assertEqual(len(expression_references(tree)), 1000)

    def test_all_frozen_calc_formulas_parse_without_claiming_their_results(self):
        paths = sorted((ROOT / "conformance/calc/fixtures").glob("*/calc.json"))
        self.assertEqual(len(paths), 97)
        for path in paths:
            with self.subTest(scenario=path.parent.name):
                declaration = json.loads(path.read_text(encoding="utf-8"))
                frozen = json.loads((path.parent / "expected-result.json").read_text(encoding="utf-8"))
                self.assertEqual(frozen["calc_id"], declaration["id"])
                tree = parse_expression(declaration["formula"])
                if path.parent.name == "period-08-unregistered":
                    self.assertFalse(frozen["ok"])
                    self.refusal(frozen["error"]["code"], check_reference_structure, tree)
                else:
                    check_reference_structure(tree)
                # All final values/verdicts remain untested by this parser.

    def test_frozen_period_and_variant_formulas_have_exact_reference_inventory(self):
        directory = ROOT / "conformance/calc/fixtures"
        cases = {
            "period-01-year-order": (
                Reference("dcf", ("annual_cash_flows", "noi"), "Y3", 1),
                Reference("dcf", ("annual_cash_flows", "noi"), "Y1", 1)),
            "period-04-dated-series": (
                Reference("cash_flow_series", ("series", "amount"), "2028-02-29", 1),
                Reference("distribution_waterfall", ("stated_schedule", "lp_distribution"), "2028-02-29", 1)),
            "variant-04-role-preference": (
                Reference("debt_structure", ("loan_amount",)), Reference("valuation", ("purchase_price",))),
        }
        for name, expected in cases.items():
            formula = json.loads((directory / name / "calc.json").read_text(encoding="utf-8"))["formula"]
            self.assertEqual(expression_references(parse_expression(formula)), expected)

    def test_normative_dictionary_formulas_reproduce_declared_static_input_sets(self):
        dictionary = json.loads((ROOT / "spec/metrics/builtin.json").read_text(encoding="utf-8"))
        self.assertEqual(len(dictionary["calculations"]), 171)
        for declaration in dictionary["calculations"]:
            with self.subTest(id=declaration["id"], classes=declaration["asset_classes"]):
                tree = parse_expression(declaration["formula"])
                check_reference_structure(tree)
                references = expression_references(tree)
                self.assertTrue(all(ref.selector is None for ref in references))
                self.assertEqual({".".join((ref.head, *ref.members)) for ref in references},
                                 set(declaration["input_paths"]))

    def test_frozen_module_reject_formula_fails_grammar_without_module_profile_claim(self):
        directory = ROOT / "conformance/modules/reject"
        fixture = json.loads((directory / "09-unparseable-formula.module.json").read_text(encoding="utf-8"))
        frozen = json.loads((directory / "09-unparseable-formula.expected.json").read_text(encoding="utf-8"))
        self.assertEqual(frozen["expected_codes"], ["PROTO-MOD-018"])
        self.assertEqual(len(fixture["calculations"]), 1)
        self.refusal("CALC-PARSE-001", parse_expression, fixture["calculations"][0]["formula"])
        # PROTO-MOD-018 belongs to module loading; this tests its parse premise
        # without pretending a module loader or profile has been implemented.

    def test_discovery_stays_parse_only_without_an_evaluator_command(self):
        manifest, status = main(["manifest"])
        self.assertEqual(status, 0)
        self.assertEqual(manifest["capabilities"], ["parse"])
        self.assertEqual(manifest["profiles"], [])
        self.assertNotIn("tier", manifest)
        self.assertNotEqual(main(["calc", "unused"])[1], 0)


if __name__ == "__main__":
    unittest.main()
