"""Accepted composition fixtures and independent source/read-only controls."""
import copy
import hashlib
import json
from pathlib import Path
import unittest

from test_reader import HEADER
from test_source_metadata_optional import body as metadata_body
from uwmd_composition import CompositionError, index_parts, parse_part, resolve_composition
from uwmd_document_sources import metadata_blocks
from uwmd_envelope import semantic_envelope, source_digest
from uwmd_reader import parse
from uwmd_validation_selection import ValidationUnavailable

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "conformance/composition"


def fence(section, value, attrs=""):
    return ("~~~json uw:section=" + section + attrs + "\n" + json.dumps(value, ensure_ascii=True) + "\n~~~\n").encode()


def part(identity, value, section="rent_roll", collection=True):
    raw = ("---\nuw_version: \"3.0\"\nuwpart_version: \"1.0\"\npart_id: " + identity +
           "\nsection: " + section + "\ncollection_member: " + str(collection).lower() + "\n---\n").encode()
    return parse(raw + fence(section, value))


def external(ids, *, collection=True):
    value = metadata_body(); value["_meta"]["section"] = "rent_roll"
    value["external"] = dict(parts=ids, part_count=len(ids))
    if collection: value["external"].update(collection_key="unit_id", collection_path="units")
    return parse(HEADER + fence("rent_roll", value, " external=true"))


def load(folder):
    root = parse((folder / "record.uwx.md").read_bytes())
    sources = [parse(path.read_bytes()) for path in sorted((folder / "parts").glob("*.uwpart.md"))]
    return root, index_parts(sources)


class CompositionTests(unittest.TestCase):
    def test_both_frozen_resolved_fixtures_equal_inline_canonical_forms_and_digests(self):
        for name in ("inline-vs-external", "collection-order"):
            folder = FIXTURES / "resolve" / name
            retained = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in folder.rglob("*") if path.is_file()}
            root, parts = load(folder); before = copy.deepcopy((root, parts))
            result = resolve_composition(root, parts)
            inline = parse((folder / "inline.uwx.md").read_bytes())
            self.assertEqual((result.status, result.externalized, result.issues), ("resolved", ("rent_roll",), ()))
            self.assertEqual(semantic_envelope(result.document), semantic_envelope(inline))
            self.assertEqual(source_digest(result.document), source_digest(inline))
            self.assertEqual((root, parts), before)
            self.assertEqual({p: hashlib.sha256(p.read_bytes()).hexdigest() for p in retained}, retained)
            self.assertEqual(len(result.document._retained_sources), 4)
            self.assertEqual(len(metadata_blocks(result.document)), 5)

    def test_frozen_reject_and_missing_fixtures_keep_existing_error_codes(self):
        for name, code in (("part-malformed", "COMP-PART-MALFORMED"), ("section-mismatch", "COMP-SECTION-MISMATCH")):
            with self.assertRaises(CompositionError) as caught: load(FIXTURES / "reject" / name)
            self.assertEqual(caught.exception.code, code)
        for folder, code in ((FIXTURES / "reject/count-mismatch", "COMP-COUNT-MISMATCH"),
                             (FIXTURES / "unresolved/missing-part", "COMP-UNRESOLVED")):
            root, parts = load(folder); result = resolve_composition(root, parts)
            self.assertEqual(result.status, "unresolved")
            self.assertIn(code, [i["code"] for i in result.issues])
            self.assertEqual(result.document.projection(), root.projection())
            self.assertEqual(result.consumed_parts, ())

    def test_whole_section_is_verbatim_with_normalized_root_annotation(self):
        payload = metadata_body(); payload["_meta"]["section"] = "property"; payload["total_units"] = 17
        fragment = part("whole", payload, "property", False)
        host = metadata_body(); host["_meta"]["section"] = "property"; host["external"] = dict(parts=["whole"], part_count=1)
        root = parse(HEADER + fence("property", host, " external=true v=1"))
        result = resolve_composition(root, index_parts([fragment]))
        self.assertEqual(result.status, "resolved")
        resolved = result.document.source.blocks[0]
        self.assertEqual(resolved.parsed.value, payload)
        self.assertNotIn("external", dict(resolved.attributes))
        self.assertEqual(dict(resolved.attributes)["v"], "1")
        self.assertEqual(result.document.source.raw, root.source.raw)

    def test_utf8_total_order_drops_only_row_meta_and_preserves_exact_tokens(self):
        keys = ["😀", "é", "z", "a"]
        inputs = []
        for index, key in enumerate(keys):
            item = dict(_meta=metadata_body()["_meta"], unit_id=key, _notes={"retained": True}, rent=1.23)
            document = part("p" + str(index), item)
            # Fresh authored numeric lexemes, not repr-derived precision.
            original = document.source.raw.replace(b'"rent": 1.23', b'"rent": 1.2300')
            inputs.append(parse(original))
        result = resolve_composition(external(["p0", "p1", "p2", "p3"]), index_parts(inputs))
        resolved = result.document.source.blocks[0]
        self.assertEqual([row["unit_id"] for row in resolved.parsed.value["units"]], ["a", "z", "é", "😀"])
        self.assertTrue(all("_meta" not in row and row["_notes"] == {"retained": True} for row in resolved.parsed.value["units"]))
        self.assertEqual([(token.pointer, token.lexeme) for token in resolved.parsed.numbers if token.pointer.endswith("/rent")],
                         [("/units/" + str(i) + "/rent", "1.2300") for i in range(4)])

    def test_duplicate_missing_and_unusable_keys_never_yield_smaller_collection(self):
        for rows, expected in (([dict(unit_id="a"), dict(unit_id="a")], "COMP-DUP-KEY"),
                               ([dict(unit_id="a"), dict(unit_id=None)], "COMP-DIRECTIVE-MALFORMED")):
            root = external(["a", "b"]); result = resolve_composition(root, index_parts([part("a", rows[0]), part("b", rows[1])]))
            self.assertEqual(result.status, "unresolved")
            self.assertEqual(result.document.projection(), root.projection())
            self.assertIn(expected, [i["code"] for i in result.issues])
        result = resolve_composition(external(["a", "a"]), index_parts([part("a", dict(unit_id="a"))]))
        self.assertEqual(result.issues[0]["code"], "COMP-DUP-KEY")

    def test_unused_available_parts_are_excluded_from_retained_operation_sources(self):
        used = part("used", dict(unit_id="a")); unused = part("unused", dict(unit_id="b", _overrides=[None]))
        result = resolve_composition(external(["used"]), index_parts([used, unused]))
        self.assertEqual([p.part_id for p in result.consumed_parts], ["used"])
        self.assertEqual(len(result.document._retained_sources), 2)
        self.assertFalse(any(b.parsed.value.get("unit_id") == "b" for b in metadata_blocks(result.document)))
        with self.assertRaises(CompositionError) as caught: index_parts([used, used])
        self.assertEqual(caught.exception.code, "COMP-DUP-KEY")

    def test_marker_literal_collection_field_and_ambiguous_whole_scope(self):
        root = external(["a"])
        root.source.blocks[0].parsed.value["external"].update(collection_path="a/b~c")
        result = resolve_composition(root, index_parts([part("a", dict(unit_id=" ", rent=1))]))
        self.assertIn("a/b~c", result.document.source.blocks[0].parsed.value)
        self.assertTrue(any(t.pointer == "/a~1b~0c/0/rent" for t in result.document.source.blocks[0].parsed.numbers))
        plain = parse(HEADER + fence("rent_roll", dict(external=dict(parts=["missing"], part_count=1))))
        self.assertEqual(resolve_composition(plain, {}).status, "resolved")
        self.assertEqual(resolve_composition(plain, {}).externalized, ())


if __name__ == "__main__":
    unittest.main()
