"""UNACCEPTED narrow D2 source projection and explicit reissuance examples.

Uses the unchanged Reader scanner; this is not a replacement Reader or migration
shim. Only the explicitly illustrated extension-only source domain is supported.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path

from candidate_codec import E, EMPTY, REQUIRED, VOLATILE, Refusal, identity, order, require, stamp, validate
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "implementations/python"))
from uwmd_reader import parse


def project_source(raw):
    doc = parse(raw)
    require(doc.source.blocks and all(b.section.startswith("x_") for b in doc.source.blocks), "lab extension-only source")
    model = {"envelope_version": E, "format_version": "3.0", "frontmatter": copy.deepcopy(doc.frontmatter.value), **copy.deepcopy(EMPTY), "extensions": {}, "superseded": {}}
    active, accounting = {}, []
    previous = raw.index(b"\n", doc.source.frontmatter_span.end) + 1
    for ordinal, scanned in enumerate(doc.source.blocks):
        attrs = dict(scanned.attributes)
        require(set(attrs) <= {"uw:section", "variant", "superseded"}, "lab source annotation domain")
        annotation = {"section": scanned.section}
        if "variant" in attrs: annotation["variant"] = attrs["variant"]
        body = copy.deepcopy(scanned.parsed.value)
        require(next(iter(body), None) == "_meta", "source _meta must be first")
        historical = body["_meta"]["lifecycle"]["superseded"]
        if "superseded" in attrs:
            require(attrs["superseded"] in ("true", "false"), "fence lifecycle scalar")
            annotation["superseded"] = attrs["superseded"] == "true"
            require(annotation["superseded"] is historical, "source lifecycle disagreement")
        block = {"annotation": annotation, "content": body}
        prose = raw[previous:scanned.fence_span.start].decode("utf-8").strip()
        if prose: block["prose"] = prose
        previous = scanned.fence_span.end
        if historical: model["superseded"].setdefault(scanned.section, []).append(block)
        else: active.setdefault(scanned.section, []).append(block)
        accounting.append({"source_ordinal": ordinal, "section": scanned.section,
            "variant": identity(block), "state": "superseded" if historical else "current",
            "source_body_sha256": hashlib.sha256(scanned.body_span.extract(raw)).hexdigest()})
    require(not raw[previous:].strip(), "lab trailing prose unavailable in model")
    for section, blocks in active.items():
        opted = any("_role" in b["content"] for b in blocks) and any("variant" in b["annotation"] for b in blocks)
        if opted:
            # Candidate mixed-null grouping, explicitly not an accepted rule.
            current = {}
            for block in blocks: current[identity(block)] = block
            model["extensions"][section] = {"mode": "variants", "blocks": [{"variant": v, "block": current[v]} for v in sorted(current, key=order)]}
        else: model["extensions"][section] = {"mode": "single", "block": blocks[-1]}
    # No fixture has unmarked overwritten active revisions: account every block.
    accounted = sum(1 if e["mode"] == "single" else len(e["blocks"]) for e in model["extensions"].values()) + sum(map(len, model["superseded"].values()))
    require(accounted == len(accounting), "lab source current-revision loss refused")
    return stamp(model), accounting


def source_bytes(model):
    validate(model)
    require(set(model) <= REQUIRED | set(VOLATILE), "model-only top-level members have no Markdown carrier")
    # Existing restricted YAML supports these scalar example frontmatter values.
    require(all(v is None or isinstance(v, (str, bool, int, float)) for v in model["frontmatter"].values()), "lab frontmatter scalar source domain")
    text = "---\n" + "".join(k + ": " + json.dumps(v, ensure_ascii=False) + "\n" for k, v in model["frontmatter"].items()) + "---\n\n"
    blocks = [b for history in model["superseded"].values() for b in history]
    for entry in model["extensions"].values():
        blocks.extend([entry["block"]] if entry["mode"] == "single" else [r["block"] for r in entry["blocks"]])
    for block in blocks:
        a = block["annotation"]
        require(set(a) <= {"section", "variant", "superseded"}, "lab annotation source domain")
        if "prose" in block: text += block["prose"] + "\n\n"
        text += "```json uw:section=" + a["section"]
        if "variant" in a:
            require(a["variant"] and not any(c.isspace() or c in "`=\"'" for c in a["variant"]), "lab fence-label source spelling")
            text += " variant=" + a["variant"]
        if "superseded" in a: text += " superseded=" + ("true" if a["superseded"] else "false")
        body = {"_meta": block["content"]["_meta"], **{k: v for k, v in block["content"].items() if k != "_meta"}}
        text += "\n" + json.dumps(body, ensure_ascii=False, indent=2) + "\n```\n\n"
    text = text.rstrip("\n") + "\n"
    projected, _ = project_source(text.encode("utf-8"))
    expected = {k: v for k, v in model.items() if k not in VOLATILE}
    actual = {k: v for k, v in projected.items() if k not in VOLATILE}
    require(actual == expected, "candidate Markdown conversion would change mode/identity/content")
    return text.encode("utf-8")


def reissue_from_source(original):
    require(original is not None, "ORIGINAL_SOURCE_OR_COMPLETE_ATTRIBUTABLE_ARCHIVE_REQUIRED")
    model, accounting = project_source(original)
    return model, {"status": "UNACCEPTED REISSUANCE PLAN / NOT AUTHENTICATION",
        "original_sha256": hashlib.sha256(original).hexdigest(), "new_source_digest": model["semantic_digest"],
        "canonicalization_version": "C_NEXT", "source_accounting": accounting,
        "old_artifacts": "retain exact bytes/subjects; never relabel or rehash as historical proof",
        "new_attestations": "separately authorize and issue new receipt/signature/plan when needed; none created here",
        "authentication_domain": "V13 repeated/superseded-extension guards retained; these sources may remain ineligible"}
