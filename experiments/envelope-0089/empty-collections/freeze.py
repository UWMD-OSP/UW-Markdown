"""First creation only; default/--check compares this new carrier's frozen bytes."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from codec import canonical, encode_csv, encode_zip, stamped
HERE = Path(__file__).resolve().parent


def models():
    absent = dict(envelope_version="E_NEXT", format_version="3.0", frontmatter=dict(uw_version="3.0", deal_id="empty-carrier"), sections={}, superseded={}, extensions={}, pipeline_log=[], custom_calculations=[], custom_scenarios=[])
    empty = copy.deepcopy(absent)
    empty["sections"] = {"valuation": {}, "literal/~slot": {}}
    empty["superseded"] = {"x_history": [], "literal/~slot": []}
    mixed = json.loads((HERE.parent / "codec-study/fixtures/all-block-extras/model.json").read_bytes())
    mixed["sections"].update(valuation={}, **{"literal/~slot": {}})
    mixed["superseded"].update(valuation=[], **{"literal/~slot": []})
    return {name: stamped(model) for name, model in (("absent-slots", absent), ("empty-slots", empty), ("mixed-complete-blocks", mixed))}


def artifacts():
    result = {}
    cases = []
    for name, model in models().items():
        files = encode_csv(model)
        data = {"model.json": (json.dumps(model, ensure_ascii=True, indent=2) + "\n").encode(), "subject.jcs": canonical({k: v for k, v in model.items() if k not in {"generated_at", "generator", "semantic_digest"}}).encode("utf8"), "bundle.zip": encode_zip(files)}
        data.update({"csv/" + k: v.encode("utf8") for k, v in files.items()})
        inventory = []
        for path, value in data.items():
            result[f"fixtures/{name}/{path}"] = value
            inventory.append(dict(path=path, bytes=len(value), sha256=hashlib.sha256(value).hexdigest()))
        cases.append(dict(case=name, semantic_digest=model["semantic_digest"], artifacts=sorted(inventory, key=lambda item: item["path"])))
    manifest = dict(status="UNAPPROVED EMPTY-COLLECTION CARRIER; NOT SCHEMA OR AUTHENTICATION", source_inputs={"../codec-study/fixtures/all-block-extras/model.json": hashlib.sha256((HERE.parent / "codec-study/fixtures/all-block-extras/model.json").read_bytes()).hexdigest()}, cases=cases)
    result["fixtures/manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    return result


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--create", action="store_true")
    group.add_argument("--check", action="store_true")
    args = parser.parse_args()
    values = artifacts()
    if args.create:
        if (HERE / "fixtures").exists(): raise SystemExit("Refusing frozen artifact overwrite")
        for path, value in values.items():
            target = HERE / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(value)
    else:
        actual = {p.relative_to(HERE).as_posix() for p in (HERE / "fixtures").rglob("*") if p.is_file()}
        assert actual == set(values)
        for path, value in values.items(): assert (HERE / path).read_bytes() == value, path
    print(f"PASS {len(values)} frozen artifacts / 3 models; empty carrier unapproved")


if __name__ == "__main__": main()
