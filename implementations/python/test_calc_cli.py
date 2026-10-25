"""Actual CLI JSON, exit and read-only controls for the developing calc service."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_reader import HEADER, block
from uwmd import main

ROOT = Path(__file__).resolve().parents[2]


class CalcCLITests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="uwmd-python-calc-cli-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.source = self.directory / "source.uwx.md"
        self.declaration = self.directory / "calc.json"
        self.context = self.directory / "context.json"
        self.source.write_bytes(HEADER + block("property", {"amount": 1.005}))

    def command(self, declaration, context=None):
        self.declaration.write_text(json.dumps(declaration), encoding="utf-8")
        args = ["calc", str(self.source), str(self.declaration)]
        paths = [self.source, self.declaration]
        if context is not None:
            self.context.write_text(json.dumps(context), encoding="utf-8")
            args.extend(["--calc-context", str(self.context)])
            paths.append(self.context)
        before = {path: path.read_bytes() for path in paths}
        process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
            *args, "--json"], capture_output=True, encoding="utf-8", timeout=30)
        response = json.loads(process.stdout)
        self.assertEqual(before, {path: path.read_bytes() for path in paths})
        self.assertEqual(process.stderr, "")
        return response, process.returncode

    def test_real_cli_quantized_result_refusal_and_arrays(self):
        result, status = self.command({"id": "money", "formula": "property.amount", "unit": "$"})
        self.assertEqual((status, result["ok"], result["value"], result["round_to"]), (0, True, 1.01, 2))
        result, status = self.command({"id": "zero", "formula": "1/0"})
        self.assertEqual((status, result["ok"], result["value"], result["error"]["code"]),
                         (1, False, None, "CALC-DIV-ZERO"))
        result, status = self.command([{"id": "good", "formula": "2+3"}, {"id": "bad", "formula": "unknown()"}])
        self.assertEqual(status, 1)
        self.assertEqual([row["calc_id"] for row in result], ["good", "bad"])
        self.assertEqual([row["ok"] for row in result], [True, False])
        result, status = self.command([{"id": "only", "formula": "2"}])
        self.assertEqual((status, isinstance(result, list), len(result)), (0, True, 1))

    def test_real_cli_context_selected_variant_and_null_override(self):
        self.source.write_bytes(HEADER + block("debt_structure", {"amount": 1}, variant="one", role="senior")
                                + block("debt_structure", {"amount": 2}, variant="two", role="primary"))
        declaration = {"id": "selected", "formula": "debt_structure.amount"}
        result, status = self.command(declaration, {"sectionVariants": {"debt_structure": "one"}})
        self.assertEqual((status, result["value"]), (0, 1))
        result, status = self.command(declaration, {"sectionVariants": {"debt_structure": "missing"}})
        self.assertEqual((status, result["error"]["code"]), (1, "CALC-RESOLVE-002"))
        result, status = self.command(declaration, {"overrides": {"debt_structure.amount": None}})
        self.assertEqual((status, result["ok"], result["value"]), (0, True, None))

    def test_real_cli_parse_context_and_file_error_boundaries(self):
        result, status = self.command({"id": "probe", "formula": "1"}, {"section_roles": {}})
        self.assertEqual((status, result["error"]["code"]), (1, "CALC-TYPE-001"))
        self.source.write_bytes(b"---\nuw_version: 1\n---\n")
        result, status = self.command({"id": "probe", "formula": "1"})
        self.assertEqual((status, result["error"]["category"], result["error"]["code"]),
                         (1, "parse", "UNSUPPORTED_FORMAT_VERSION"))
        self.source.unlink()
        result, status = main(["calc", str(self.source), "1", "--json"])
        self.assertEqual(status, 2)
        self.assertIn("error", result)
        self.source.write_bytes(HEADER)
        with patch("uwmd.evaluate_calc", side_effect=RuntimeError("controlled internal failure")):
            result, status = main(["calc", str(self.source), "1", "--json"])
        self.assertEqual(status, 2)
        self.assertIn("Internal calculation failure", result["error"]["message"])
        manifest, status = main(["manifest"])
        self.assertEqual((status, manifest["capabilities"]), (0, ['parse', 'calc-evaluate', 'validate', 'verify-reserve-accounts', 'verify-reserve-draws', 'verify-metrics', 'verify-cash-flows', 'verify-property-cash-flows', 'verify-waterfall', 'verify-capital-stack', 'verify-lease-up', 'verify-receipts']))

    def test_unavailable_external_input_is_not_a_fabricated_calc_code(self):
        self.source.write_bytes(HEADER + b'```json uw:section=property external=true\n{"external":{"parts":["p"],"part_count":1}}\n```\n')
        result, status = self.command({"id": "external", "formula": "property.amount"})
        self.assertEqual(status, 1)
        self.assertNotIn("code", result["error"])
        self.assertIn("COMP-UNRESOLVED", result["error"]["message"])
        self.assertNotIn("value", result)


if __name__ == "__main__":
    unittest.main()
