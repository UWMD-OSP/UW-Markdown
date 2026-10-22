"""RFC 0118: exact declared frontmatter vocabularies, independently checked."""
import copy
import json
import unittest

from test_reader import HEADER
from test_validation import validate
from uwmd_reader import parse


VOCABULARIES = {
    "deal_stage": ("scope screening term_sheet full_underwrite credit_approval closing monitoring".split(), "INVALID-DEAL-STAGE-001"),
    "tier": (["screener", "analyst"], "INVALID-TIER-001"),
    "status": (["draft", "in_progress", "complete", "flagged", "archived"], "INVALID-STATUS-001"),
    "recommendation": (["pending", "approve", "approve_with_conditions", "decline"], "INVALID-RECOMMENDATION-001"),
}


class FrontmatterVocabularyTests(unittest.TestCase):
    def document(self, field, value):
        return parse(HEADER.replace(b"unknown_key: retained", (field + ": " + json.dumps(value)).encode()))

    def test_every_named_value_null_and_absence(self):
        for field, (values, code) in VOCABULARIES.items():
            for value in [*values, None]:
                with self.subTest(field=field, value=value):
                    self.assertFalse(any(i["code"] == code for i in validate(self.document(field, value))["issues"]))
            self.assertFalse(any(i["code"] == code for i in validate(parse(HEADER))["issues"]))

    def test_invalid_values_report_at_their_field_without_source_mutation(self):
        for field, (_, code) in VOCABULARIES.items():
            for value in ("bogus", "", "toString", "__proto__", " pending", 3, False):
                with self.subTest(field=field, value=value):
                    document = self.document(field, value)
                    before = copy.deepcopy(document)
                    report = validate(document)
                    found = [i for i in report["issues"] if i["code"] == code]
                    self.assertEqual(len(found), 1)
                    self.assertEqual((found[0]["severity"], found[0]["section"], found[0]["field"], found[0]["value"]),
                                     ("error", "frontmatter", field, value))
                    if field == "deal_stage":
                        self.assertFalse(any(i["code"] == "DQ-06" for i in report["issues"]))
                    self.assertEqual(document, before)
