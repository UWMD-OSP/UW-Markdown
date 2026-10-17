"""UNACCEPTED example round-trips/negative controls, never live conformance."""
import copy
import csv
import hashlib
import io
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

from candidate_codec import E, C, B, NS, Refusal, decode_csv, decode_json, decode_xml, digest, encode_csv, encode_json, encode_xml, stamp, tag, validate
from freeze_codec_examples import examples
from source_examples import project_source, reissue_from_source, source_bytes, parse

HERE = Path(__file__).resolve().parent
CASES = HERE / "codec-examples"


def csv_case(name):
    return {p.name: p.read_bytes().decode("utf-8") for p in (CASES / name / "csv").iterdir()}


def alter_csv(files, filename, change):
    value = copy.deepcopy(files)
    rows = list(csv.reader(io.StringIO(value[filename], newline="")))
    change(rows)
    output = io.StringIO(newline=""); writer = csv.writer(output, quoting=csv.QUOTE_ALL, lineterminator="\r\n"); writer.writerows(rows)
    value[filename] = output.getvalue()
    manifest = json.loads(value["manifest.json"])
    for item in manifest["inventory"]:
        raw = value[item["path"]].encode("utf-8"); item.update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    value["manifest.json"] = json.dumps(manifest)
    return value


class CandidateCodecTests(unittest.TestCase):
    def test_five_complete_frozen_cross_codec_models(self):
        for name, expected in examples().items():
            with self.subTest(case=name):
                folder = CASES / name
                frozen = json.loads((folder / "document.uw.json").read_text(encoding="utf-8"))
                self.assertEqual(frozen, expected)
                self.assertEqual(decode_json((folder / "document.uw.json").read_text(encoding="utf-8")), expected)
                self.assertEqual(decode_xml((folder / "document.uw.xml").read_text(encoding="utf-8")), expected)
                files = csv_case(name); before = copy.deepcopy(files)
                self.assertEqual(decode_csv(files), expected)
                self.assertEqual(files, before)
                self.assertEqual("sha256:" + hashlib.sha256((folder / "subject.jcs").read_bytes()).hexdigest(), expected["semantic_digest"])

    def test_exact_null_literal_default_mode_and_unknown_values(self):
        models = examples()
        records = models["mixed-null-default"]["extensions"]["x_review"]["blocks"]
        self.assertEqual([r["variant"] for r in records], [None, "default"])
        self.assertNotIn("variant", records[0]["block"]["annotation"])
        self.assertEqual(records[1]["block"]["annotation"]["variant"], "default")
        for name, model in models.items():
            entry = model["extensions"]["x_review"]
            block = entry["block"] if entry["mode"] == "single" else entry["blocks"][0]["block"]
            self.assertEqual(block["content"]["content"]["unknown"]["a/~b"], [None, {}, [], "", 1.5])
            self.assertEqual(block["content"]["content"]["unknown"]["item"], "CR\rLF\nTAB\t")
            self.assertEqual(block["content"]["_meta"]["x_unknown_metadata"], {"retained": [None, "", {"a/~b": True}]})
        direct = models["direct-model-unknown"]
        self.assertEqual(direct["x_envelope_unknown"]["a/~b"], [None, {}, [], ""])
        self.assertEqual(direct["extensions"]["x_review"]["block"]["annotation"]["x_unknown_annotation"], "<&> exact")

    def test_sources_account_every_current_and_historical_block(self):
        for name in ("single", "one-peer", "mixed-null-default", "ordered-history"):
            raw = (CASES / name / "original.uwx.md").read_bytes(); original = bytes(raw)
            model, evidence = project_source(raw)
            self.assertEqual(model, examples()[name]); self.assertEqual(raw, original)
            self.assertEqual(len(evidence), len(parse(raw).source.blocks))
        history = examples()["ordered-history"]["superseded"]["x_review"]
        self.assertEqual([b["content"]["_meta"]["lifecycle"]["revision"] for b in history], [1, 2])
        changed = examples()["ordered-history"]; changed["superseded"]["x_review"].reverse()
        self.assertNotEqual(digest(changed), examples()["ordered-history"]["semantic_digest"])

    def test_peer_source_order_has_one_subject_without_selection_fallback(self):
        raw = (CASES / "mixed-null-default/original.uwx.md").read_bytes(); doc = parse(raw)
        offset = raw.index(b"\n", doc.source.frontmatter_span.end) + 1
        header = raw[:offset]; chunks = []
        for block in doc.source.blocks:
            chunks.append(raw[offset:block.fence_span.end]); offset = block.fence_span.end
        reversed_source = header + b"\n" + b"\n".join(reversed(chunks)) + raw[offset:]
        self.assertEqual(project_source(raw)[0], project_source(reversed_source)[0])

    def test_prospective_mixed_source_does_not_fix_existing_parse_wire(self):
        raw = (CASES / "mixed-null-default/original.uwx.md").read_bytes()
        document = parse(raw)
        self.assertEqual(len(document.source.blocks), 2)
        # Observational boundary only: mixed-source admission is not accepted.
        self.assertEqual(len(document.projection()["extensions"]["x_review"]), 1)
        candidate, _ = project_source(raw)
        self.assertEqual(len(candidate["extensions"]["x_review"]["blocks"]), 2)
        self.assertEqual(document.source.raw, raw)

    def test_direct_one_peer_intent_preserved_and_markdown_refuses(self):
        model = examples()["one-peer"]
        del model["extensions"]["x_review"]["blocks"][0]["block"]["content"]["_role"]
        model = stamp(model)
        self.assertEqual(decode_json(encode_json(model)), model)
        self.assertEqual(decode_xml(encode_xml(model)), model)
        self.assertEqual(decode_csv(encode_csv(model)), model)
        with self.assertRaisesRegex(Refusal, "change mode/identity/content"): source_bytes(model)
        with self.assertRaisesRegex(Refusal, "no Markdown carrier"): source_bytes(examples()["direct-model-unknown"])

    def test_null_absence_and_transport_metadata_have_separate_boundaries(self):
        model = examples()["single"]; changed = copy.deepcopy(model)
        del changed["extensions"]["x_review"]["block"]["content"]["_notes"]
        self.assertNotEqual(digest(changed), digest(model))
        transport = {**model, "generated_at": "2026-10-16T00:00:00Z", "generator": "UNACCEPTED-rfc0089-example"}
        self.assertEqual(digest(transport), digest(model))
        self.assertEqual(decode_csv(encode_csv(transport)), transport)
        self.assertEqual(decode_xml(encode_xml(transport)), transport)
        self.assertEqual(decode_json(encode_json(transport)), transport)
        crlf = copy.deepcopy(model)
        crlf["extensions"]["x_review"]["block"]["prose"] += "\r\nCRLF prose retained"
        crlf = stamp(crlf)
        self.assertEqual(decode_xml(encode_xml(crlf)), crlf)
        self.assertEqual(decode_csv(encode_csv(crlf)), crlf)

    def test_candidate_admission_rejects_legacy_stamps_and_duplicate_json(self):
        model = examples()["single"]
        old = copy.deepcopy(model); old["envelope_version"] = "1.0"
        with self.assertRaisesRegex(Refusal, "version unsupported"): decode_json(json.dumps(old))
        prior = json.loads((HERE / "candidate-preimages.json").read_text())["vectors"][0]["semantic_value"]
        with self.assertRaisesRegex(Refusal, "version unsupported"): decode_json(json.dumps(prior))
        xml = encode_xml(model).replace('envelope-version="E_NEXT"', 'envelope-version="1.0"')
        with self.assertRaisesRegex(Refusal, "version unsupported"): decode_xml(xml)
        files = encode_csv(model); manifest = json.loads(files["manifest.json"]); manifest["bundle_version"] = "1.0.0"; files["manifest.json"] = json.dumps(manifest)
        with self.assertRaisesRegex(Refusal, "unsupported"): decode_csv(files)
        with self.assertRaisesRegex(Refusal, "duplicate decoded JSON"): decode_json('{"envelope_version":"E_NEXT","envelope_version":"E_NEXT"}')

    def test_invalid_candidate_identity_shape_and_order(self):
        for change, reason in (
            (lambda m: m["extensions"]["x_review"]["blocks"].reverse(), "ordering"),
            (lambda m: m["extensions"]["x_review"]["blocks"].append(copy.deepcopy(m["extensions"]["x_review"]["blocks"][0])), "duplicate exact"),
            (lambda m: m["extensions"]["x_review"]["blocks"][0].update(variant="default"), "disagreement"),
            (lambda m: m["extensions"]["x_review"]["blocks"][0]["block"]["annotation"].update(variant=None), "annotation scalar"),
            (lambda m: m["extensions"]["x_review"].update(unknown=True), "closed variants"),
            (lambda m: m["extensions"]["x_review"].update(blocks=[]), "nonempty")):
            model = examples()["mixed-null-default"]; change(model)
            with self.subTest(reason=reason), self.assertRaisesRegex(Refusal, reason): validate(model, False)

    def test_received_digest_and_payload_mutation_refuse(self):
        model = examples()["single"]; model["extensions"]["x_review"]["block"]["content"]["note"] = "changed"
        with self.assertRaisesRegex(Refusal, "digest mismatch"): decode_json(json.dumps(model))
        xml = (CASES / "single/document.uw.xml").read_text(encoding="utf-8").replace('>synthetic<', '>changed<')
        with self.assertRaisesRegex(Refusal, "digest mismatch"): decode_xml(xml)
        def change(rows):
            row = next(r for r in rows[1:] if r[1] == "content" and r[2] == "/note"); row[4] = '"changed"'
        files = alter_csv(csv_case("single"), "block_values.csv", change)
        with self.assertRaisesRegex(Refusal, "digest mismatch"): decode_csv(files)

    def test_xml_duplicate_member_types_and_secure_refusals(self):
        text = (CASES / "single/document.uw.xml").read_text(encoding="utf-8")
        root = ET.fromstring(text); root.append(copy.deepcopy(root[0]))
        with self.assertRaisesRegex(Refusal, "duplicate XML root"): decode_xml(ET.tostring(root, encoding="unicode"))
        for altered in (text.replace('uw:type="object"', 'uw:type="unknown"', 1),
                        '<!DOCTYPE document [<!ENTITY e "unsafe">]>' + text):
            with self.assertRaises(Refusal): decode_xml(altered)
        root = ET.fromstring(text)
        element = next(e for e in root.iter() if e.get(tag("type")) == "null"); element.text = "null"
        with self.assertRaisesRegex(Refusal, "null text"): decode_xml(ET.tostring(root, encoding="unicode"))

    def test_csv_inventory_identity_pointer_and_row_negative_controls(self):
        files = csv_case("mixed-null-default")
        for change in (lambda r: r[1].__setitem__(0, "/extensions/x_review/blocks/9/block"),
                       lambda r: r[1].__setitem__(3, '"default"'),
                       lambda r: r[1].__setitem__(4, "9"),
                       lambda r: r[1].__setitem__(6, "single"),
                       lambda r: r.append(copy.deepcopy(r[1]))):
            with self.subTest(change=change), self.assertRaises(Refusal): decode_csv(alter_csv(files, "blocks.csv", change))
        missing = copy.deepcopy(files); del missing["prose.csv"]
        with self.assertRaisesRegex(Refusal, "missing/unlisted"): decode_csv(missing)
        unlisted = {**files, "unexpected.csv": ""}
        with self.assertRaisesRegex(Refusal, "missing/unlisted"): decode_csv(unlisted)
        corrupted = copy.deepcopy(files); corrupted["block_values.csv"] += "extra"
        with self.assertRaisesRegex(Refusal, "inventory hash/size"): decode_csv(corrupted)
        for change in (lambda r: r.append(copy.deepcopy(r[1])),
                       lambda r: r.__delitem__(next(i for i, row in enumerate(r) if i and row[2] == "" and row[1] == "meta"))):
            with self.assertRaises(Refusal): decode_csv(alter_csv(files, "block_values.csv", change))

    def test_xml_inexpressible_legal_json_is_explicit_refusal_not_domain_ban(self):
        for key, value in (("legal_json", "nul\x00retained"), ("nul\x00key", "retained")):
            model = examples()["single"]; model["extensions"]["x_review"]["block"]["content"][key] = value; model = stamp(model)
            self.assertEqual(decode_json(encode_json(model)), model)
            self.assertEqual(decode_csv(encode_csv(model)), model)
            with self.assertRaisesRegex(Refusal, "XML1 character unavailable"): encode_xml(model)

    def test_prototype_limits_refuse_without_silently_discarding_members(self):
        for change in (lambda m: m["extensions"]["x_review"]["block"].update(unknown_block_member={"retained": True}),
                       lambda m: m["sections"].update(property={"not": "implemented here"})):
            model = examples()["single"]; before = copy.deepcopy(model); change(model); changed = copy.deepcopy(model)
            with self.assertRaisesRegex(Refusal, "lab unsupported"): stamp(model)
            self.assertEqual(model, changed); self.assertNotEqual(model, before)

    def test_unicode_variant_order_and_exact_escaped_pointer_ids(self):
        model = examples()["mixed-null-default"]
        for record, label in zip(model["extensions"]["x_review"]["blocks"], ("😀", "\ue000")):
            record["variant"] = label; record["block"]["annotation"]["variant"] = label
        model = stamp(model)
        self.assertEqual(decode_xml(encode_xml(model)), model)
        self.assertEqual(decode_csv(encode_csv(model)), model)
        changed = copy.deepcopy(model); changed["extensions"]["x_review"]["blocks"].reverse()
        with self.assertRaisesRegex(Refusal, "ordering"): stamp(changed)
        escaped = examples()["single"]
        entry = escaped["extensions"].pop("x_review"); escaped["extensions"]["x_r/a~b"] = entry
        entry["block"]["annotation"]["section"] = "x_r/a~b"
        entry["block"]["content"]["_meta"]["section"] = "x_r/a~b"
        escaped = stamp(escaped); files = encode_csv(escaped)
        self.assertIn("/extensions/x_r~1a~0b/block", files["blocks.csv"])
        self.assertEqual(decode_csv(files), escaped)
        self.assertEqual(decode_xml(encode_xml(escaped)), escaped)

    def test_xml_member_name_escaping_preserves_control_whitespace(self):
        model = examples()["direct-model-unknown"]
        model["x_envelope_unknown"].update({"item": "reserved", "member": "also reserved", "a/\t\r\n~b": "exact"})
        model = stamp(model)
        self.assertEqual(decode_xml(encode_xml(model)), model)
        self.assertEqual(decode_csv(encode_csv(model)), model)

    def test_missing_original_blocks_reissuance_without_fabricating_attestations(self):
        with self.assertRaisesRegex(Refusal, "ORIGINAL_SOURCE_OR_COMPLETE_ATTRIBUTABLE_ARCHIVE_REQUIRED"): reissue_from_source(None)
        raw = (CASES / "ordered-history/original.uwx.md").read_bytes()
        model, plan = reissue_from_source(raw)
        self.assertEqual(plan["original_sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(plan["new_source_digest"], model["semantic_digest"])
        self.assertIn("none created here", plan["new_attestations"])
        self.assertIn("guards retained", plan["authentication_domain"])
        self.assertEqual(raw, (CASES / "ordered-history/original.uwx.md").read_bytes())


if __name__ == "__main__": unittest.main()
