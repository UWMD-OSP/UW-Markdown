"""First creation only; default/--check compares bytes and never writes."""
import argparse
import hashlib
import json
from pathlib import Path
from codec import canonical, digest, encode_csv, encode_xml, encode_zip, stamped
from inputs import models

HERE = Path(__file__).resolve().parent


def artifacts():
    result = {}
    cases = []
    for name, raw_model in models().items():
        model = stamped(raw_model)
        files = encode_csv(model)
        data = {"model.json": (json.dumps(model, ensure_ascii=True, indent=2) + "\n").encode(), "subject.jcs": canonical({k: v for k, v in model.items() if k not in {"generated_at", "generator", "semantic_digest"}}).encode("utf8"), "document.xml": encode_xml(model).encode("utf8"), "bundle.zip": encode_zip(files)}
        data.update({"csv/" + k: v.encode("utf8") for k, v in files.items()})
        inventory = []
        for path, value in data.items():
            result[f"fixtures/{name}/{path}"] = value
            inventory.append({"path": path, "bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()})
        cases.append({"case": name, "semantic_digest": digest(model), "artifacts": sorted(inventory, key=lambda item: item["path"])})
    old_matrix = HERE.parent / "codec-examples/matrix.json"
    manifest = {"status": "UNAPPROVED RFC0089 CODEC STUDY / NOT CONFORMANCE OR AUTHENTICATION", "base_commit": "0a6e0489025f072f3fde6bab02de76296783fe3e", "tokens": {"envelope": "E_NEXT", "subject": "C_NEXT", "bundle": "B_NEXT", "xml": "urn:uwmd:unaccepted:rfc0089:json-lexical"}, "zip_profile": "research-only canonical STORE; fixed1980 metadata; 6 payload files; 1MiB cap; no deflate/ZIP64", "preserved_original_matrix_sha256": hashlib.sha256(old_matrix.read_bytes()).hexdigest(), "cases": cases}
    result["fixtures/manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--create", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.create and args.check: parser.error("choose create or check")
    values = artifacts()
    if args.create:
        if (HERE / "fixtures").exists(): raise SystemExit("Refusing to overwrite frozen codec-study fixtures")
        for path, value in values.items():
            target = HERE / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(value)
        print("First creation: unapproved codec-study fixtures")
    else:
        actual = {p.relative_to(HERE).as_posix() for p in (HERE / "fixtures").rglob("*") if p.is_file()}
        assert actual == set(values), "missing/unlisted evidence"
        for path, value in values.items(): assert (HERE / path).read_bytes() == value, path
        print(f"Read-only frozen codec study agrees: {len(values)} artifacts / 2 cases")


if __name__ == "__main__": main()
