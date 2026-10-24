"""Whole-envelope digest evidence, without receipt/signature verification claims."""
import copy
import json
from pathlib import Path
import unittest

from test_reader import HEADER, block
from uwmd_envelope import EnvelopeError, envelope_digest, semantic_envelope, source_digest
from uwmd_reader import parse

ROOT = Path(__file__).resolve().parents[2]


class EnvelopeTests(unittest.TestCase):
    def test_frozen_independent_subject_digests(self):
        for directory, baseline in [("receipts/issue/01-uwx-multifamily", "expected-receipt.json"),
                                    ("document-signatures/01-valid", "signature.json"),
                                    ("document-signatures/07-cosmetic", "signature.json")]:
            folder = ROOT / "conformance" / directory
            expected = json.loads((folder / baseline).read_text(encoding="utf-8"))["subject"]["digest"]
            self.assertEqual(source_digest(parse((folder / "deal.uwx.md").read_bytes())), expected)

    def test_frozen_subject_mutations_change_digest_without_signature_claim(self):
        for name in ("02-relabel", "03-flip", "04-splice", "05-delete-history", "06-frontmatter", "15-retained-prose"):
            directory = ROOT / "conformance/document-signatures" / name
            expected = json.loads((directory / "signature.json").read_text(encoding="utf-8"))["subject"]["digest"]
            self.assertNotEqual(source_digest(parse((directory / "deal.uwx.md").read_bytes())), expected)

    def test_all_collections_complete_content_annotations_and_prose(self):
        raw = HEADER + b"# Retained\n" + block("property", {"content": {"n": 1}, "_notes": "notes"})
        raw += block("property", {"n": 0}, superseded=True)
        raw += block("pipeline_log", {"entries": []}) + block("custom_calculations", {"id": "x"})
        raw += block("custom_scenarios", {"id": "y"}) + block("x_opaque", {"n": None})
        raw += block("reserve_accounts", {"accounts": []}, variant="upside") + b"Trailing outside projection\n"
        document = parse(raw)
        before = copy.deepcopy(document)
        envelope = semantic_envelope(document)
        self.assertEqual(envelope["sections"]["property"]["content"]["content"], {"n": 1})
        self.assertEqual(envelope["sections"]["property"]["content"]["_notes"], "notes")
        self.assertEqual(envelope["sections"]["property"]["prose"], "# Retained")
        self.assertEqual(envelope["sections"]["reserve_accounts"]["upside"]["annotation"]["variant"], "upside")
        self.assertEqual(len(envelope["superseded"]["property"]), 1)
        self.assertEqual(len(envelope["pipeline_log"]), 1)
        self.assertEqual(len(envelope["custom_calculations"]), 1)
        self.assertEqual(len(envelope["custom_scenarios"]), 1)
        self.assertIn("x_opaque", envelope["extensions"])
        self.assertNotIn("prose", envelope["extensions"]["x_opaque"])
        self.assertEqual(document, before)
        self.assertEqual(source_digest(document), source_digest(parse(raw.replace(b"\n", b"\r\n"))))

    def test_only_top_level_volatile_members_are_excluded(self):
        envelope = semantic_envelope(parse(HEADER + block("property", {"generator": "a", "generated_at": "b", "semantic_digest": "c"})))
        original = envelope_digest(envelope)
        with_top = dict(envelope, generator="ignored", generated_at="ignored", semantic_digest="ignored")
        self.assertEqual(envelope_digest(with_top), original)
        for key in ("generator", "generated_at", "semantic_digest"):
            mutated = copy.deepcopy(envelope)
            mutated["sections"]["property"]["content"][key] = "changed"
            self.assertNotEqual(envelope_digest(mutated), original)
        mutated = copy.deepcopy(envelope)
        mutated["sections"]["property"]["content"]["new"] = None
        self.assertNotEqual(envelope_digest(mutated), original)

    def test_annotation_metadata_prose_history_all_remain_bound(self):
        raw = HEADER + block("property", {"n": 0}, superseded=True) + block("property", {"n": 1})
        original = source_digest(parse(raw))
        for changed in (raw.replace(b'"n": 0', b'"n": 2'), raw.replace(b'"revision": 1', b'"revision": 2'),
                        raw.replace(b"uw:section=property", b"uw:section=property custom=kept", 1),
                        raw.replace(b"```json", b"Prose\n```json", 1)):
            self.assertNotEqual(source_digest(parse(changed)), original)
        extension = parse(HEADER + block("x_opaque", {"n": 0}, superseded=True)
                          + block("x_opaque", {"n": 1}) + block("x_opaque", {"n": 2}))
        envelope = semantic_envelope(extension)
        self.assertEqual(envelope["superseded"]["x_opaque"][0]["content"]["n"], 0)
        self.assertEqual(envelope["extensions"]["x_opaque"]["block"]["content"]["n"], 2)
        with self.assertRaises(EnvelopeError):
            semantic_envelope(parse(HEADER + block("property").replace(b"uw:section=property", b"uw:section=property section=erased")))
        peers=semantic_envelope(parse(HEADER + block("x_opaque", variant="a", role="primary")
                                    + block("x_opaque", variant="b")))
        self.assertEqual(peers["extensions"]["x_opaque"]["mode"],"variants")
        self.assertEqual([row["variant"] for row in peers["extensions"]["x_opaque"]["blocks"]],["a","b"])


if __name__ == "__main__":
    unittest.main()
