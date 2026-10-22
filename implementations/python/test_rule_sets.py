"""RFC 0111: validation runs under the rule set the declared Format version names."""
import asyncio
import copy
import unittest

from test_reader import HEADER
from uwmd_reader import ReaderError, parse
from uwmd_rule_sets import RULE_SETS, rule_set_for
from uwmd_validation import validate_document


def validate(document):
    return asyncio.run(validate_document(document, now="2026-10-16T00:00:00Z"))


class RuleSetTests(unittest.TestCase):
    def test_one_rule_set_is_kept(self):
        self.assertEqual(RULE_SETS, ("3.0",))
        self.assertEqual(rule_set_for({"uw_version": "3.0"}), "3.0")

    def test_validation_names_the_rule_set_it_applied(self):
        self.assertEqual(validate(parse(HEADER))["rule_set"], "3.0")

    def test_a_model_declaring_an_unkept_version_is_refused(self):
        for declared in ("3.1", "2.0", 3.0, None):
            document = copy.deepcopy(parse(HEADER))
            if declared is None:
                document.frontmatter.value.pop("uw_version")
            else:
                document.frontmatter.value["uw_version"] = declared
            with self.assertRaises(ReaderError) as raised:
                validate(document)
            self.assertEqual(raised.exception.code, "UNSUPPORTED_FORMAT_VERSION")


if __name__ == "__main__":
    unittest.main()
