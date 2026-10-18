"""Independent bounded portable minimum proof, not a current Reader capability.

No production codec, old-regime verifier, historical inventory or generated
expectation is used. Node's existing helper and this Python implementation
receive equal JSON values through an actual subprocess transport.
"""
import copy
import json
import subprocess
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAB = HERE.parent


def block_minimum(block):
    body = block["content"]
    result = {"content": {key: copy.deepcopy(value) for key, value in body.items()
                          if key != "_meta" and key != "_notes"}}
    if "_meta" in body:
        result["meta"] = copy.deepcopy(body["_meta"])
    return result


def project(model):
    extensions = {}
    for name, entry in model["extensions"].items():
        if entry["mode"] == "single":
            extensions[name] = {"mode": "single", "block": block_minimum(entry["block"])}
        else:
            extensions[name] = {"mode": "variants", "blocks": [
                {"variant": record["variant"], "block": block_minimum(record["block"])}
                for record in entry["blocks"]]}
    return {"extensions": extensions,
            "superseded": {name: [block_minimum(block) for block in blocks]
                           for name, blocks in model["superseded"].items()}}


def node(models):
    run = subprocess.run(["node", str(HERE / "node-projection.mjs")],
                         input=json.dumps(models, ensure_ascii=True).encode("ascii"),
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    if run.stderr:
        raise AssertionError(run.stderr.decode("utf-8"))
    return json.loads(run.stdout.decode("utf-8"))


def block(body, **extras):
    return {"annotation": {"section": "x_review"}, "content": body, **extras}


def single(body):
    return {"extensions": {"x_review": {"mode": "single", "block": block(body)}},
            "superseded": {}}


class PortableMinimum(unittest.TestCase):
    def agree(self, models, expected):
        before = copy.deepcopy(models)
        self.assertEqual([project(model) for model in models], expected)
        self.assertEqual(node(models), expected)
        self.assertEqual(models, before, "input models remain unchanged")

    def test_seven_existing_complete_values(self):
        paths = [LAB / "codec-examples" / name / "document.uw.json" for name in
                 ("single", "one-peer", "mixed-null-default", "ordered-history", "direct-model-unknown")]
        paths += [LAB / "codec-study" / "fixtures" / name / "model.json" for name in
                  ("all-block-extras", "xml-lexical-domain")]
        models = [json.loads(path.read_text(encoding="utf-8")) for path in paths]
        # Existing models supply values, not authority for a normative baseline.
        expected = [project(model) for model in models]
        self.agree(models, expected)
        self.assertEqual(len(expected), 7)

    def test_absent_null_and_arbitrary_metadata(self):
        models = [single({"ordinary": 1}), single({"_meta": None, "ordinary": 1}),
                  single({"_meta": {"actor": "  "}, "ordinary": 1})]
        expected = [
            {"extensions": {"x_review": {"mode": "single", "block": {"content": {"ordinary": 1}}}}, "superseded": {}},
            {"extensions": {"x_review": {"mode": "single", "block": {"meta": None, "content": {"ordinary": 1}}}}, "superseded": {}},
            {"extensions": {"x_review": {"mode": "single", "block": {"meta": {"actor": "  "}, "content": {"ordinary": 1}}}}, "superseded": {}},
        ]
        self.agree(models, expected)
        # Projection of an invalid/partial value is not validation or admission.

    def test_exact_payload_members_without_echo_or_default(self):
        body = {"_meta": {"x": None}, "_notes": "minimum excludes this",
                "content": {"_notes": "nested remains"}, "_role": "primary",
                "_overrides": {}, "a/~b": [None, {}, [], "\u0000", "\ufffd", "\U00010000"]}
        model = single(body)
        model["extensions"]["x_review"]["block"].update(
            {"prose": "outside minimum", "x_extra": {"unknown": True}})
        expected_body = {key: value for key, value in body.items() if key not in ("_meta", "_notes")}
        expected = {"extensions": {"x_review": {"mode": "single", "block": {
            "meta": {"x": None}, "content": expected_body}}}, "superseded": {}}
        self.agree([model], [expected])

    def test_nullable_default_utf16_and_one_peer_mode(self):
        labels = [None, "default", "\U00010000", "\ue000"]
        records = []
        for i, label in enumerate(labels):
            value = block({"index": i})
            if label is not None:
                value["annotation"]["variant"] = label
            records.append({"variant": label, "block": value})
        models = [{"extensions": {"x_review": {"mode": "variants", "blocks": records}}, "superseded": {}},
                  {"extensions": {"x_review": {"mode": "variants", "blocks": records[1:2]}}, "superseded": {}}]
        expected_records = [{"variant": label, "block": {"content": {"index": i}}}
                            for i, label in enumerate(labels)]
        expected = [{"extensions": {"x_review": {"mode": "variants", "blocks": expected_records}}, "superseded": {}},
                    {"extensions": {"x_review": {"mode": "variants", "blocks": expected_records[1:2]}}, "superseded": {}}]
        self.agree(models, expected)

    def test_history_keeps_order_and_explicit_empty_slot(self):
        model = {"extensions": {}, "superseded": {"x_review": [
            block({"value": "physically-first", "_meta": {"revision": 9}}),
            block({"value": "physically-last", "_meta": {"revision": 1}})], "x_empty": []}}
        expected = {"extensions": {}, "superseded": {"x_review": [
            {"meta": {"revision": 9}, "content": {"value": "physically-first"}},
            {"meta": {"revision": 1}, "content": {"value": "physically-last"}}], "x_empty": []}}
        self.agree([model], [expected])


if __name__ == "__main__":
    unittest.main(verbosity=2)
