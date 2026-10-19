"""Accepted procedure identity; archived evidence is read-only, not an oracle service."""
import ast
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys
import unittest
import zipfile

import uwmd_fdlibm as k
from uwmd_numeric import quantize

LAB = Path(__file__).resolve().parents[2] / "experiments/numerical-0088"


def evaluate(record):
    operation = record["op"]
    arguments = [k.from_bits(record["x"])]
    if operation in ("pow", "copysign"):
        arguments.append(k.from_bits(record["y"]))
    elif operation == "scalbn":
        arguments.append(record["n"])
    return getattr(k, operation)(*arguments)


class PinnedNumericalTests(unittest.TestCase):
    def test_constant_identity_and_binary64_environment(self):
        constants = LAB / "pinned-fdlibm/constants.json"
        self.assertEqual(hashlib.sha256(constants.read_bytes()).hexdigest(),
                         "e9793112e7a5d0e2c1ccb2f8d8dd9bbc35608598cf725cb8e5ee44117dad59d9")
        self.assertEqual(k._LITERAL_WORDS, json.loads(constants.read_bytes())["literals"])
        self.assertEqual((sys.float_info.radix, sys.float_info.mant_dig, sys.float_info.max_exp), (2, 53, 1024))
        half = k.from_bits("3ca0000000000000")
        self.assertEqual(k.to_bits(1.0 + half), "3ff0000000000000")
        self.assertEqual(k.to_bits(1.0 + 3.0 * half), "3ff0000000000002")
        self.assertEqual(k.to_bits(k.from_bits("0010000000000000") * k.from_bits("3cb0000000000000")), "0000000000000001")

    def test_4204_frozen_operands_against_three_archived_native_streams(self):
        manifest = json.loads((LAB / "python-fdlibm/evidence-inputs.json").read_bytes())["files"]
        for path, digest in manifest.items():
            self.assertEqual(hashlib.sha256((LAB / path).read_bytes()).hexdigest(), digest, path)
        operands = json.loads((LAB / "native-reference/inputs.json").read_bytes())["cases"]
        actual = [evaluate(case) for case in operands]
        self.assertEqual(len(actual), 4204)
        self.assertEqual(sum(math.isnan(value) for value in actual), 769)
        archives = [path for path in manifest if path.endswith(".zip")]
        self.assertEqual(len(archives), 3)
        for path in archives:
            with zipfile.ZipFile(LAB / path) as archive:
                reference = json.loads(archive.read("results.json"))
            self.assertEqual(len(reference), len(operands))
            for case, value, expected in zip(operands, actual, reference):
                self.assertEqual((case["id"], case["op"]), (expected["id"], expected["op"]))
                if expected["native_class"] == "nan":
                    self.assertTrue(math.isnan(value), (path, case["id"]))
                else:
                    self.assertEqual(k.to_bits(value), expected["native_bits"], (path, case["id"]))

    def test_178_mathematical_certificates_retain_five_one_ulp_differences(self):
        operands = json.loads((LAB / "pinned-fdlibm/math-inputs.json").read_bytes())["cases"]
        references = json.loads((LAB / "pinned-fdlibm/math-evidence.json").read_bytes())["cases"]
        self.assertEqual((len(operands), len(references)), (178, 178))
        differences = []
        for case, expected in zip(operands, references):
            self.assertEqual(case["id"], expected["id"])
            actual, exact = k.to_bits(evaluate(case)), expected["reference"]["bits"]
            if actual != exact:
                differences.append((case["id"], actual, exact))
                self.assertEqual(abs(int(actual, 16) - int(exact, 16)), 1)
        self.assertEqual(differences, [
            ("exp-word-3fd62e41ffffffff", "3ff6a09e0c594ff2", "3ff6a09e0c594ff3"),
            ("exp-word-3ff0000000000000", "4005bf0a8b14576a", "4005bf0a8b145769"),
            ("bounded-math-power-2", "3fe6a09e667f3bcc", "3fe6a09e667f3bcd"),
            ("bounded-math-power-4", "4071cda00ebe20d6", "4071cda00ebe20d7"),
            ("bounded-math-power-7", "4006a09e667f3bcc", "4006a09e667f3bcd"),
        ])

    def test_raw_typed_boundary_and_argument_order(self):
        for bad in (None, True, 2, "2", [], {}):
            for function in (k.pinned_exp, k.pinned_log):
                with self.subTest(function=function.__name__, bad=bad), self.assertRaises(k.NumericError) as caught:
                    function(bad)
                self.assertEqual(caught.exception.code, "CALC-TYPE-001")
            with self.assertRaisesRegex(k.NumericError, "base"):
                k.pinned_pow(bad, None)
            with self.assertRaisesRegex(k.NumericError, "exponent"):
                k.pinned_pow(2.0, bad)
        self.assertEqual(k.pinned_pow(k.NAN, 0.0), 1.0)
        self.assertTrue(math.isnan(k.pinned_pow(-2.0, 0.5)))
        self.assertEqual(k.pinned_exp(-k.INF), 0.0)
        self.assertEqual(k.pinned_log(0.0), -k.INF)
        self.assertEqual(k.pinned_log(k.INF), k.INF)
        self.assertTrue(math.isnan(k.pinned_log(k.NAN)))

    def test_signed_words_negative_exponents_and_internal_infinity(self):
        self.assertEqual(k.to_bits(k.pinned_pow(-0.0, -3.0)), "fff0000000000000")
        self.assertEqual(k.to_bits(k.pinned_pow(2.0, -1074.0)), "0000000000000001")
        self.assertEqual(k.to_bits(k.pinned_pow(-2.0, -1075.0)), "8000000000000000")
        self.assertEqual(k.shift(0x80000001, 32, "unsigned"), 0)
        self.assertEqual(k.shift(0x80000001, 32, "signed"), -1)
        self.assertEqual(k.shift(0x80000001, 32, "left"), 0)
        self.assertEqual(k.to_bits(k.divide(1.0, -0.0)), "fff0000000000000")
        factor = k.pinned_pow(1e155, 2.0)
        self.assertEqual(factor, k.INF)
        self.assertEqual(k.divide(1.0, factor), 0.0)
        # An internal infinite denominator can yield a finite financial value;
        # a public calc pow refusal belongs to the separate evaluator boundary.
        self.assertEqual(quantize(k.divide(1.0, factor), 12), 0.0)
        with self.assertRaises(ValueError):
            quantize(k.divide(0.0, 0.0), 12)

    def test_no_host_transcendentals_or_runtime_evidence_imports(self):
        tree = ast.parse(Path(k.__file__).read_text())
        imports = [alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names]
        self.assertEqual(imports, ["struct"])
        self.assertFalse(any(isinstance(node, ast.ImportFrom) for node in ast.walk(tree)))
        for node in ast.walk(tree):
            self.assertFalse(isinstance(node, ast.Pow))
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                self.assertNotIn(node.func.attr, ("read_text", "read_bytes", "pow", "exp", "log", "sqrt", "ldexp"))

    def test_ten_frozen_quantization_controls(self):
        operands = json.loads((LAB / "cash-graphs/inputs.json").read_bytes())["quantization_controls"]
        reference = json.loads((LAB / "cash-graphs/evidence.json").read_bytes())["quantization_controls"]
        self.assertEqual((len(operands), len(reference)), (10, 10))
        for case, expected in zip(operands, reference):
            self.assertEqual(case["id"], expected["id"])
            self.assertEqual(k.to_bits(quantize(k.from_bits(case["bits"]), case["places"])),
                             expected["boundary"]["bits"], case["id"])

    def test_archived_financial_trajectory_reporting_boundaries(self):
        inputs = json.loads((LAB / "financial-trajectories/inputs.json").read_bytes())["cases"]
        frozen = json.loads(gzip.decompress((LAB / "financial-trajectories/evidence/python.json.gz").read_bytes()))
        by_id = {case["id"]: case for case in inputs}
        checked = 0
        for case in frozen["cases"]:
            result = case["result"]
            if result.get("status") != "returned":
                continue
            value = k.from_bits(result["raw"]["bits"])
            if result["reporting"]["status"] == "refused_nonfinite":
                with self.assertRaises(ValueError):
                    quantize(value, by_id[case["id"]]["places"])
            else:
                self.assertEqual(k.to_bits(quantize(value, by_id[case["id"]]["places"])),
                                 result["reporting"]["bits"], case["id"])
            checked += 1
        self.assertGreaterEqual(checked, 10)


if __name__ == "__main__":
    unittest.main()
