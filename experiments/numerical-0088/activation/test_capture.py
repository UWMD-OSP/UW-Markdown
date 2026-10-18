"""Focused comparison controls: no production replay or old matrix run."""
import copy
import unittest
from capture import equal, compare_rows, normalized

class ComparisonControls(unittest.TestCase):
    def test_only_nan_payload_is_ignored(self):
        equal({"kind": "nan", "bits": "7ff8000000000000"}, {"kind": "nan", "bits": "fff8000000000001"}, "nan")
        for value in ({"kind": "infinity", "bits": "7ff0000000000000"}, {"kind": "finite", "bits": "0000000000000000"}):
            other = {**value, "bits": "8000000000000000"}
            with self.assertRaises(AssertionError): equal(value, other, "word mismatch")
    def test_result_refusal_and_reporting_are_independent_guards(self):
        want = [{"id": "a", "result": {"status": "returned", "raw": {"kind": "finite", "bits": "0000000000000000"}, "reporting": {"status": "reported", "bits": "0000000000000000"}}}]
        got = [{"id": "a", "result": {"status": "returned", "raw": want[0]["result"]["raw"], "quantized": {"bits": "0000000000000000"}}}]
        compare_rows(want, got)
        for field in ("raw", "quantized"):
            changed = copy.deepcopy(got); changed[0]["result"][field]["bits"] = "8000000000000000"
            with self.assertRaises(AssertionError): compare_rows(want, changed)
        refused = [{"id": "a", "result": {"status": "refused", "code": "CALC-IRR-DIVERGE"}}]
        with self.assertRaises(AssertionError): compare_rows(want, refused)
        changed = copy.deepcopy(refused); changed[0]["result"]["code"] = "CALC-TYPE-001"
        with self.assertRaises(AssertionError): compare_rows(refused, changed)

if __name__ == "__main__": unittest.main()
