"""Ordinary wrapper diagnostic projection, separate from source-owner evidence."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_validation import ROOT
from test_metadata_leaves_0094 import valid_body, fence
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation import validate_document, _validate_source
from uwmd_validation_core import _validation_source_issue


class WrapperProjectionTests(unittest.TestCase):
    def test_only_same_current_oldshape_error_loses_optional_field(self):
        body = valid_body(); body["_meta"]["provenance"] = []
        document = parse(HEADER + fence(body))
        issue = inspect_source_roles(document)["issues"][0]
        before = copy.deepcopy(issue)
        self.assertNotIn("field", _validation_source_issue(document, issue))
        for key, value in (("code", "META-04"), ("severity", "warning"),
                           ("field", "_meta.quality"), ("section", "other")):
            wrong = copy.deepcopy(issue); wrong[key] = value
            self.assertEqual(_validation_source_issue(document, wrong), wrong)
        for index in (None, True, -1, 1, "0"):
            wrong = copy.deepcopy(issue); wrong["context"]["block_index"] = index
            self.assertEqual(_validation_source_issue(document, wrong), wrong)
        self.assertEqual(issue, before)
        projected = _validation_source_issue(document, issue)
        projected["context"]["block_index"] = 999
        self.assertEqual(issue, before)

    def test_current_model_predicate_and_exact_peer_not_stale_bytes(self):
        old = valid_body(); old["_meta"]["provenance"] = []
        late = {"before": 1, **valid_body()}
        raw = HEADER + fence(old) + fence(late)
        document = parse(raw)
        inventory = inspect_source_roles(document)
        old_issue, p1 = inventory["issues"]
        self.assertNotIn("field", _validation_source_issue(document, old_issue))
        self.assertEqual(_validation_source_issue(document, p1)["field"], "_meta")
        wrong = copy.deepcopy(old_issue); wrong["context"]["block_index"] = 1
        self.assertEqual(_validation_source_issue(document, wrong), wrong)
        document.source.blocks[0].parsed.value["_meta"] = valid_body()["_meta"]
        self.assertEqual(_validation_source_issue(document, old_issue), old_issue)
        self.assertEqual([i["field"] for i in asyncio.run(validate_document(document))["errors"]], ["_meta"])
        source = asyncio.run(_validate_source(raw))
        self.assertEqual([i.get("field") for i in source["errors"]], [None, "_meta"])
        self.assertEqual(document.source.raw, raw)

    def test_actual_cli_old_shape_is_fieldless_but_new_fields_remain_exact(self):
        old = valid_body(); old["_meta"]["provenance"] = []
        later = {"before": 1, **valid_body()}
        later["_meta"]["section"] = "wrong"
        later["_meta"]["provenance"]["actor"] = ""
        later["_meta"]["quality"]["confidence"] = "unknown"
        raw = HEADER + fence(old) + fence(later)
        document = parse(raw); before = copy.deepcopy(document)
        inventory = inspect_source_roles(document)
        self.assertEqual(inventory["issues"][0]["field"], "_meta")
        with tempfile.TemporaryDirectory(prefix="uwmd-wrapper-projection-") as folder:
            path = Path(folder) / "source.uwx.md"; path.write_bytes(raw)
            process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                "validate", str(path), "--json"], capture_output=True, encoding="utf8", timeout=30)
            response = json.loads(process.stdout)
            self.assertEqual((process.returncode, process.stderr), (1, ""))
            self.assertNotIn("error", response)
            self.assertEqual([i.get("field") for i in response["errors"]],
                [None, "_meta", "_meta.section", "_meta.provenance.actor", "_meta.quality.confidence"])
            self.assertEqual(response["errors"], [i for i in response["issues"] if i["severity"] == "error"])
            self.assertEqual(path.read_bytes(), raw)
        self.assertEqual(document, before)
        self.assertEqual(inspect_source_roles(document), inventory)


if __name__ == "__main__":
    unittest.main()
