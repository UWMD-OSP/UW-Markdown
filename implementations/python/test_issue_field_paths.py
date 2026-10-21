"""RFC 0104 agreement: the portable field-path case's rows appear in Python's result."""
import json
from pathlib import Path
import unittest

from uwmd import main

ROOT = Path(__file__).resolve().parents[2]
CASE = ROOT / "conformance/documents/malformed/66-issue-field-paths"


class IssueFieldPathTests(unittest.TestCase):
    def test_field_rows_match_the_reference_case(self):
        expected = json.loads(Path(str(CASE) + ".expected.json").read_text(encoding="utf-8"))
        result, _status = main(["validate", str(CASE) + ".uwx.md", "--json"])
        seen = [(i["code"], i["section"], i.get("field")) for i in result["issues"]]
        for row in expected["field_issues"]:
            with self.subTest(row=row):
                self.assertIn((row["code"], row["section"], row["field"]), seen)


if __name__ == "__main__":
    unittest.main()
