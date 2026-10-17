"""Unapproved RFC0089 research codec; new mapping only, never production.

Python writer/reader uses previous lab JCS and typed-row primitives. The Node
reader is separately authored and shares no reconstruction code. Bounds and
ZIP STORE profile are experiment controls, not newly selected standard limits.
"""
import copy
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from candidate_codec import canonical, load_json, flatten, unflatten, rows, table, esc, require, Refusal

E, C, B = "E_NEXT", "C_NEXT", "B_NEXT"
NS = "urn:uwmd:unaccepted:rfc0089:json-lexical"
COLLECTIONS = ("sections", "pipeline_log", "custom_calculations", "custom_scenarios", "extensions", "superseded")
VOLATILE = {"generated_at", "generator", "semantic_digest"}
REQUIRED = {"envelope_version", "format_version", "frontmatter", *COLLECTIONS}
DOC = ["envelope_version", "format_version", "generated_at_json", "generator_json", "semantic_digest", "deal_id_json", "deal_name_json", "extra_json"]
BLOCK = ["block_ref", "collection", "section_json", "variant_json", "ordinal", "state", "extension_mode"]
VALUES = ["block_ref", "scope", "pointer", "json_type", "value_json"]
PROSE = ["prose_ref", "scope", "block_ref", "prose_json"]
FILES = {"document.csv", "frontmatter.csv", "blocks.csv", "block_values.csv", "prose.csv", "manifest.json"}
SCOPES = ("annotation", "meta", "content", "block-extra")
MAX_BYTES = 1048576


def digest(model):
    return "sha256:" + hashlib.sha256(canonical({k: v for k, v in model.items() if k not in VOLATILE}).encode("utf8")).hexdigest()


def stamped(model):
    value = copy.deepcopy(model)
    value["semantic_digest"] = digest(value)
    return validate(value)


def blocks(model):
    result = []
    def add(ref, collection, section, variant, ordinal, state, mode, block):
        require(isinstance(block, dict) and {"annotation", "content"} <= block.keys(), "block fields")
        a, body = block["annotation"], block["content"]
        require(isinstance(a, dict) and isinstance(body, dict) and isinstance(body.get("_meta"), dict), "block objects")
        require(a.get("section") == section == body["_meta"].get("section"), "block section")
        require("variant" not in a or isinstance(a["variant"], str), "variant string or absent")
        require(body["_meta"].get("lifecycle", {}).get("superseded") is (state == "superseded"), "history placement")
        require("prose" not in block or isinstance(block["prose"], str), "prose type")
        result.append(([ref, collection, canonical(section), canonical(variant), ordinal, state, mode], block))
    for section in sorted(model["sections"], key=lambda k: k.encode("utf-16-be")):
        entry = model["sections"][section]
        if "annotation" in entry and "content" in entry:
            add("/sections/" + esc(section), "sections", section, entry["annotation"].get("variant"), "", "current", "", entry)
        else:
            require(entry, "lab empty builtin variant map unsupported")
            for variant in sorted(entry, key=lambda k: k.encode("utf-16-be")):
                add("/sections/" + esc(section) + "/" + esc(variant), "sections", section, variant, "", "current", "", entry[variant])
    for collection in ("pipeline_log", "custom_calculations", "custom_scenarios"):
        for i, block in enumerate(model[collection]):
            add(f"/{collection}/{i}", collection, block["annotation"]["section"], None, str(i), "current", "", block)
    for section in sorted(model["extensions"], key=lambda k: k.encode("utf-16-be")):
        entry = model["extensions"][section]
        require(section.startswith("x_") and isinstance(entry, dict), "extension entry")
        if entry.get("mode") == "single":
            require(set(entry) == {"mode", "block"}, "closed singleton")
            add("/extensions/" + esc(section) + "/block", "extensions", section, entry["block"]["annotation"].get("variant"), "", "current", "single", entry["block"])
        else:
            require(set(entry) == {"mode", "blocks"} and entry.get("mode") == "variants" and entry["blocks"], "closed variants")
            identities = []
            for i, record in enumerate(entry["blocks"]):
                require(set(record) == {"variant", "block"}, "closed record")
                variant = record["variant"]
                require(variant is None or isinstance(variant, str), "nullable variant")
                require(variant == record["block"]["annotation"].get("variant"), "variant annotation")
                identities.append(variant)
                add(f"/extensions/{esc(section)}/blocks/{i}/block", "extensions", section, variant, str(i), "current", "variants", record["block"])
            order = lambda v: (0, b"") if v is None else (1, v.encode("utf-16-be"))
            require(len(set(identities)) == len(identities) and identities == sorted(identities, key=order), "duplicate/order identity")
    for section in sorted(model["superseded"], key=lambda k: k.encode("utf-16-be")):
        require(model["superseded"][section], "lab empty history slot unsupported")
        for i, block in enumerate(model["superseded"][section]):
            add(f"/superseded/{esc(section)}/{i}", "superseded", section, None, str(i), "superseded", "", block)
    return result


def validate(model):
    require(isinstance(model, dict) and REQUIRED <= model.keys(), "required collections")
    require(model["envelope_version"] == E and model["format_version"] == "3.0" and model["frontmatter"].get("uw_version") == "3.0", "unsupported regime")
    require(all(isinstance(model[k], dict) for k in ("sections", "extensions", "superseded")), "map collections")
    require(all(isinstance(model[k], list) for k in ("pipeline_log", "custom_calculations", "custom_scenarios")), "array collections")
    blocks(model)
    require(model.get("semantic_digest") == digest(model), "semantic digest mismatch")
    return model


def encode_csv(model):
    validate(model)
    fm = model["frontmatter"]
    extra = {k: v for k, v in model.items() if k not in REQUIRED | VOLATILE}
    files = {"document.csv": table(DOC, [[E, "3.0", canonical(model.get("generated_at")), canonical(model.get("generator")), model["semantic_digest"], canonical(fm.get("deal_id")), canonical(fm.get("deal_name")), canonical(extra)]]), "frontmatter.csv": table(["pointer", "json_type", "value_json"], flatten(fm))}
    descriptors, values, prose = [], [], []
    for descriptor, block in blocks(model):
        descriptors.append(descriptor)
        ref = descriptor[0]
        parts = (block["annotation"], block["content"]["_meta"], {k: v for k, v in block["content"].items() if k != "_meta"}, {k: v for k, v in block.items() if k not in {"annotation", "content", "prose"}})
        for scope, part in zip(SCOPES, parts):
            values.extend([[ref, scope, *r] for r in flatten(part)])
        if "prose" in block:
            prose.append([ref + "/prose", "block", ref, canonical(block["prose"])])
    files["blocks.csv"] = table(BLOCK, descriptors)
    files["block_values.csv"] = table(VALUES, values)
    files["prose.csv"] = table(PROSE, prose)
    inventory = [{"path": k, "bytes": len(v.encode("utf8")), "sha256": hashlib.sha256(v.encode("utf8")).hexdigest()} for k, v in sorted(files.items())]
    files["manifest.json"] = json.dumps({"status": "UNAPPROVED RFC0089 CODEC STUDY", "bundle_version": B, "envelope_version": E, "canonicalization_version": C, "format_version": "3.0", "semantic_digest": model["semantic_digest"], "inventory": inventory}, indent=2) + "\n"
    return files


def decode_csv(files):
    require(set(files) == FILES, "file set")
    manifest = load_json(files["manifest.json"])
    require(manifest.get("bundle_version") == B and manifest.get("envelope_version") == E and manifest.get("canonicalization_version") == C, "unsupported regime")
    inventory = manifest["inventory"]
    require(len(inventory) == 5 and {x["path"] for x in inventory} == FILES - {"manifest.json"}, "inventory set")
    for item in inventory:
        raw = files[item["path"]].encode("utf8")
        require(item["bytes"] == len(raw) and item["sha256"] == hashlib.sha256(raw).hexdigest(), "inventory hash")
    document = rows(files["document.csv"], DOC)
    require(len(document) == 1, "document cardinality")
    d = document[0]
    fm = unflatten(rows(files["frontmatter.csv"], ["pointer", "json_type", "value_json"]))
    require(canonical(fm.get("deal_id")) == d[5] and canonical(fm.get("deal_name")) == d[6], "frontmatter identity")
    extra = load_json(d[7])
    require(isinstance(extra, dict) and not (set(extra) & (REQUIRED | VOLATILE)), "document extras")
    model = {**extra, "envelope_version": d[0], "format_version": d[1], "semantic_digest": d[4], "frontmatter": fm, "sections": {}, "extensions": {}, "superseded": {}, "pipeline_log": [], "custom_calculations": [], "custom_scenarios": []}
    for i, key in [(2, "generated_at"), (3, "generator")]:
        if load_json(d[i]) is not None: model[key] = load_json(d[i])
    descriptors = rows(files["blocks.csv"], BLOCK)
    refs = [r[0] for r in descriptors]
    require(len(refs) == len(set(refs)), "duplicate block ref")
    scoped = {}
    for ref, scope, *row in rows(files["block_values.csv"], VALUES):
        require(ref in refs and scope in SCOPES, "scope/ref")
        scoped.setdefault((ref, scope), []).append(row)
    prose = {}
    for ref, scope, block_ref, lexical in rows(files["prose.csv"], PROSE):
        require(block_ref in refs and scope == "block" and ref == block_ref + "/prose" and block_ref not in prose, "prose ref")
        prose[block_ref] = load_json(lexical)
        require(isinstance(prose[block_ref], str), "prose string")
    for descriptor in descriptors:
        ref, collection, section_json, variant_json, ordinal, state, mode = descriptor
        section, variant = load_json(section_json), load_json(variant_json)
        parts = {}
        for scope in SCOPES:
            require((ref, scope) in scoped, "missing scope")
            parts[scope] = unflatten(scoped[(ref, scope)])
            require(isinstance(parts[scope], dict), "scope object")
        require(not (set(parts["block-extra"]) & {"annotation", "content", "prose"}) and "_meta" not in parts["content"], "reserved overlap")
        block = {**parts["block-extra"], "annotation": parts["annotation"], "content": {"_meta": parts["meta"], **parts["content"]}}
        if ref in prose: block["prose"] = prose[ref]
        if collection == "sections":
            prefix = "/sections/" + esc(section)
            if ref == prefix: require(section not in model["sections"], "duplicate section"); model["sections"][section] = block
            else:
                require(isinstance(variant, str) and ref == prefix + "/" + esc(variant), "section pointer")
                target = model["sections"].setdefault(section, {})
                require(variant not in target, "duplicate section variant"); target[variant] = block
        elif collection == "extensions":
            if mode == "single":
                require(section not in model["extensions"], "duplicate extension"); model["extensions"][section] = {"mode": "single", "block": block}
            else:
                require(mode == "variants", "extension mode")
                target = model["extensions"].setdefault(section, {"mode": "variants", "blocks": []})
                require(target["mode"] == "variants" and ordinal == str(len(target["blocks"])), "extension ordinal")
                target["blocks"].append({"variant": variant, "block": block})
        else:
            require(collection in ("superseded", "pipeline_log", "custom_calculations", "custom_scenarios"), "collection")
            target = model["superseded"].setdefault(section, []) if collection == "superseded" else model[collection]
            require(ordinal == str(len(target)), "array ordinal"); target.append(block)
    require([d for d, _ in blocks(model)] == descriptors, "descriptor agreement")
    require(manifest.get("semantic_digest") == model["semantic_digest"] and manifest.get("format_version") == model["format_version"], "manifest model")
    return validate(model)


def lexical(value):
    # Chosen candidate spelling, distinct from JCS subject bytes: ASCII JSON token.
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"))


def encode_xml(model):
    validate(model)
    ET.register_namespace("uw", NS)
    def node(value, key=None):
        attrs = {} if key is None else {"name-json": lexical(key)}
        element = ET.Element("{" + NS + "}" + ("value" if key is None else "member"), attrs)
        if isinstance(value, dict):
            element.set("type", "object")
            for k in sorted(value, key=lambda s: s.encode("utf-16-be")): element.append(node(value[k], k))
        elif isinstance(value, list):
            element.set("type", "array")
            for item in value: element.append(node(item))
        else:
            kind = "null" if value is None else "boolean" if isinstance(value, bool) else "number" if isinstance(value, (int, float)) else "string"
            element.set("type", kind)
            element.text = lexical(value) if kind == "string" else canonical(value)
        return element
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(node(model), encoding="unicode") + "\n"


def decode_xml(text):
    require(len(text.encode("utf8")) <= MAX_BYTES and "<!" not in text and text.isascii(), "XML declaration/domain")
    def string(text):
        value = load_json(text)
        require(isinstance(value, str) and lexical(value) == text, "XML lexical spelling")
        canonical(value)
        return value
    try: root = ET.fromstring(text)
    except ET.ParseError as error: raise Refusal("XML syntax") from error
    def decode(element, member=False, depth=0):
        require(depth < 64 and element.tag == "{" + NS + "}" + ("member" if member else "value"), "XML namespace/depth")
        require(set(element.attrib) == ({"name-json", "type"} if member else {"type"}), "XML attributes")
        kind, children, text = element.attrib["type"], list(element), element.text or ""
        if kind in ("object", "array"):
            require(not text and all(not child.tail for child in children), "XML mixed content")
            if kind == "array": return [decode(child, False, depth + 1) for child in children]
            result = {}
            for child in children:
                key = string(child.attrib.get("name-json", ""))
                require(key not in result, "XML duplicate decoded name")
                result[key] = decode(child, True, depth + 1)
            return result
        require(not children, "XML scalar children")
        if kind == "string": return string(text)
        value = load_json(text)
        require((kind == "null" and value is None) or (kind == "boolean" and type(value) is bool) or (kind == "number" and type(value) in (int, float)), "XML type")
        require(canonical(value) == text, "XML scalar spelling")
        return value
    return validate(decode(root))


def encode_zip(files):
    require(set(files) == FILES, "ZIP file set")
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3; info.external_attr = 0o100644 << 16
            archive.writestr(info, files[name].encode("utf8"))
    return stream.getvalue()


def decode_zip(raw):
    require(len(raw) <= MAX_BYTES and raw[-22:-18] == b"PK\x05\x06", "ZIP size/end")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        info = archive.infolist()
        require(len(info) == 6 and [x.filename for x in info] == sorted(FILES), "ZIP names/order/duplicates")
        result = {}
        for item in info:
            require(item.flag_bits == 0 and item.compress_type == 0 and not item.extra and not item.comment, "ZIP flags/method/extra")
            require(item.date_time == (1980, 1, 1, 0, 0, 0) and item.external_attr >> 16 == 0o100644, "ZIP deterministic metadata/symlink")
            require(item.file_size == item.compress_size <= MAX_BYTES, "ZIP limits")
            try: result[item.filename] = archive.read(item).decode("utf8", errors="strict")
            except (zipfile.BadZipFile, UnicodeDecodeError) as error: raise Refusal("ZIP content") from error
    require(encode_zip(result) == raw, "ZIP noncanonical/local-central discrepancy")
    return decode_csv(result)
