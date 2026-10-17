"""First-generation-only UNACCEPTED artifacts; --check is read-only."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from candidate_codec import canonical, digest, encode_csv, encode_json, encode_xml, stamp
from source_examples import source_bytes, reissue_from_source

HERE = Path(__file__).resolve().parent


def examples():
    old = {v["name"]: v["semantic_value"] for v in json.loads((HERE / "candidate-preimages.json").read_text())["vectors"]}
    models = {"single": copy.deepcopy(old["candidate-single"]), "one-peer": copy.deepcopy(old["candidate-one-peer"]), "mixed-null-default": copy.deepcopy(old["candidate-mixed"])}
    models["one-peer"]["extensions"]["x_review"]["blocks"][0]["block"]["content"]["_role"] = "primary"
    history = copy.deepcopy(models["mixed-null-default"])
    records = history["extensions"]["x_review"]["blocks"]
    records[0]["variant"] = "base"; records[0]["block"]["annotation"]["variant"] = "base"
    records[1]["variant"] = "detail/~"; records[1]["block"]["annotation"]["variant"] = "detail/~"
    records[0]["block"]["content"]["_meta"]["lifecycle"]["revision"] = 3
    history["superseded"]["x_review"] = []
    for revision in (1, 2):
        block = copy.deepcopy(records[0]["block"])
        block["annotation"]["superseded"] = True
        block["content"]["_meta"]["lifecycle"] = {"revision": revision, "superseded": True}
        block["content"]["note"] = "retained historical revision " + str(revision)
        history["superseded"]["x_review"].append(block)
    models["ordered-history"] = history
    for name, model in models.items():
        model["frontmatter"]["deal_id"] = "rfc0089-" + name
        model["frontmatter"]["x_absent_vs_null"] = None
        blocks = []
        for entry in model["extensions"].values():
            blocks.extend([entry["block"]] if entry["mode"] == "single" else [r["block"] for r in entry["blocks"]])
        blocks.extend(b for history in model["superseded"].values() for b in history)
        for ordinal, block in enumerate(blocks):
            block["prose"] = "## Synthetic " + name + " / block " + str(ordinal) + "\n\nExact prose <&> with \"quotes\"."
            block["content"]["_meta"]["x_unknown_metadata"] = {"retained": [None, "", {"a/~b": True}]}
            block["content"]["content"] = {"unknown": {"a/~b": [None, {}, [], "", 1.5], "member": "<&> \"quoted\"", "item": "CR\rLF\nTAB\t", "emoji": "😀", "bmp": "\ue000"}}
            block["content"]["_notes"] = None
            block["content"]["_overrides"] = [{"path": "not_a_target", "note": "retained only; no inference"}]
    direct = copy.deepcopy(models["single"])
    direct["frontmatter"]["deal_id"] = "rfc0089-direct-model-unknown"
    direct["x_envelope_unknown"] = {"a/~b": [None, {}, [], ""], "member": "exact"}
    direct["extensions"]["x_review"]["block"]["annotation"]["x_unknown_annotation"] = "<&> exact"
    models["direct-model-unknown"] = direct
    return {name: stamp(model) for name, model in models.items()}


def documents():
    files, matrix = {}, []
    for name, model in examples().items():
        prefix = "codec-examples/" + name + "/"
        rendered = {"document.uw.json": encode_json(model), "document.uw.xml": encode_xml(model),
            "subject.jcs": canonical({k: v for k, v in model.items() if k not in ("generated_at", "generator", "semantic_digest")}),
            "digest.txt": digest(model) + "\n"}
        for path, text in encode_csv(model).items(): rendered["csv/" + path] = text
        if name != "direct-model-unknown":
            original = source_bytes(model)
            projected, plan = reissue_from_source(original)
            assert projected == model
            rendered["original.uwx.md"] = original.decode("utf-8")
            rendered["reissuance-plan.json"] = json.dumps(plan, ensure_ascii=False, indent=2) + "\n"
        else:
            rendered["origin.json"] = json.dumps({"kind": "directly-authored-candidate-model", "markdown_conversion": "refuse: no carrier for unknown Envelope member/annotation in this bounded prototype", "source_recovery": "no source completeness claim"}, indent=2) + "\n"
        inventory = []
        for path, text in rendered.items():
            raw = text.encode("utf-8"); files[prefix + path] = raw
            inventory.append({"path": path, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
        matrix.append({"case": name, "semantic_digest": model["semantic_digest"], "source_available": name != "direct-model-unknown", "artifacts": sorted(inventory, key=lambda i: i["path"])})
    files["codec-examples/matrix.json"] = (json.dumps({"status": "UNACCEPTED CANDIDATE CODEC EXAMPLES / NOT CONFORMANCE", "tokens": {"envelope": "E_NEXT", "canonicalization": "C_NEXT", "bundle": "B_NEXT", "xml_namespace": "urn:uwmd:unaccepted:rfc0089"}, "cases": matrix}, indent=2) + "\n").encode()
    return files


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--check", action="store_true"); args = parser.parse_args()
    values = documents()
    if args.check:
        for name, raw in values.items():
            if (HERE / name).read_bytes() != raw: raise SystemExit("Frozen artifact differs: " + name)
        actual = {str(p.relative_to(HERE)).replace("\\", "/") for p in (HERE / "codec-examples").rglob("*") if p.is_file()}
        if actual != set(values): raise SystemExit("Missing/unlisted frozen example artifact")
        print("Frozen candidate codec examples agree: 5 cases / " + str(len(values)) + " artifacts")
    else:
        if (HERE / "codec-examples").exists(): raise SystemExit("Refusing to overwrite existing frozen examples")
        for name, raw in values.items():
            target = HERE / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        print("Created first UNACCEPTED candidate codec examples")
