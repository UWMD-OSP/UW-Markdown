"""Focused research controls; no current Envelope/CSV contract changes."""
import copy
import hashlib
import json
import unittest
from codec import DOC, Refusal, canonical, decode_csv, decode_zip, encode_csv, encode_zip, rows, table
from freeze import HERE, models


def carrier(files, value):
    changed = copy.deepcopy(files)
    row = rows(changed["document.csv"], DOC)[0]
    row[8] = canonical(value)
    changed["document.csv"] = table(DOC, [row])
    manifest = json.loads(changed["manifest.json"])
    manifest["inventory"] = [dict(path=k, bytes=len(v.encode("utf8")), sha256=hashlib.sha256(v.encode("utf8")).hexdigest()) for k, v in sorted(changed.items()) if k != "manifest.json"]
    changed["manifest.json"] = json.dumps(manifest)
    return changed


class EmptyCarrierTests(unittest.TestCase):
    def test_full_csv_zip_models_and_subjects_round_trip(self):
        for name, model in models().items():
            with self.subTest(case=name):
                before = copy.deepcopy(model)
                files = encode_csv(model)
                self.assertEqual(decode_csv(files), model)
                self.assertEqual(decode_zip(encode_zip(files)), model)
                self.assertEqual(model, before)
                self.assertEqual((HERE / "fixtures" / name / "bundle.zip").read_bytes(), encode_zip(files))

    def test_absence_and_empty_members_have_distinct_subjects_and_exact_carrier(self):
        values = models()
        self.assertNotEqual(values["absent-slots"]["semantic_digest"], values["empty-slots"]["semantic_digest"])
        self.assertNotIn("valuation", values["absent-slots"]["sections"])
        self.assertEqual(values["empty-slots"]["sections"]["valuation"], {})
        self.assertEqual(values["empty-slots"]["superseded"]["x_history"], [])
        entries = json.loads(rows(encode_csv(values["empty-slots"])["document.csv"], DOC)[0][8])
        self.assertEqual([e["path"] for e in entries], ["/sections/literal~1~0slot", "/sections/valuation", "/superseded/literal~1~0slot", "/superseded/x_history"])

    def test_closed_identity_kind_order_alias_and_overlap_refusals_after_inventory(self):
        files = encode_csv(models()["mixed-complete-blocks"])
        good = json.loads(rows(files["document.csv"], DOC)[0][8])
        cases = [None, {}, [good[0], good[0]], list(reversed(good)), [dict(path="/sections/valuation", kind="array")], [dict(path="/superseded/valuation", kind="object")], [dict(path="/extensions/x_empty", kind="object")], [dict(path="/sections/property", kind="object")], [dict(path="/superseded/x_review", kind="array")], [dict(path="/sections/bad~2", kind="object")], [dict(path="/sections/valuation/deep", kind="object")], [dict(path="/sections/valuation", kind="object", extra=True)]]
        for value in cases:
            with self.subTest(carrier=value):
                changed = carrier(files, value)
                with self.assertRaises(Refusal): decode_csv(changed)
                with self.assertRaises(Refusal): decode_zip(encode_zip(changed))

    def test_missing_carrier_entry_cannot_silently_erase_empty_subject_content(self):
        files = encode_csv(models()["empty-slots"])
        with self.assertRaisesRegex(Refusal, "semantic digest"): decode_csv(carrier(files, []))

    def test_zip_bom_with_valid_crc_and_sizes_still_refuses_original_inventory(self):
        files = encode_csv(models()["empty-slots"])
        files["document.csv"] = "\ufeff" + files["document.csv"]
        with self.assertRaisesRegex(Refusal, "inventory hash"): decode_zip(encode_zip(files))


if __name__ == "__main__": unittest.main()
