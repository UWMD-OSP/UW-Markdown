"""UNACCEPTED RFC0089 executable codec example; never production or conformance.

Lab covers extension-only models with existing empty builtin collections, JSON
values handled by the existing independent JCS primitive, and XML1-compatible
strings. It refuses unsupported block extras/collections rather than dropping
content. Tokens are design placeholders, not allocated standard versions.
"""
import copy
import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("rfc0089_jcs", ROOT / "implementations/python/uwmd_jcs.py")
_jcs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_jcs)
canonical = _jcs.canonicalize
E, C, B, NS = "E_NEXT", "C_NEXT", "B_NEXT", "urn:uwmd:unaccepted:rfc0089"
EMPTY = {"sections": {}, "pipeline_log": [], "custom_calculations": [], "custom_scenarios": []}
VOLATILE = ("generated_at", "generator", "semantic_digest")
REQUIRED = {"envelope_version", "format_version", "frontmatter", *EMPTY, "extensions", "superseded"}
BLOCK_COLUMNS = ["block_ref", "collection", "section_json", "variant_json", "ordinal", "state", "extension_mode"]
DOC_COLUMNS = ["envelope_version", "format_version", "generated_at_json", "generator_json", "semantic_digest", "deal_id_json", "deal_name_json", "extra_json"]


class Refusal(ValueError):
    pass


def require(test, reason):
    if not test:
        raise Refusal(reason)


def load_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate decoded JSON key")
            result[key] = value
        return result
    try:
        return json.loads(text, object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(Refusal("nonfinite JSON")))
    except (ValueError, RecursionError) as error:
        raise Refusal("invalid JSON: " + str(error)) from error


def order(value):
    return (0, b"") if value is None else (1, value.encode("utf-16-be"))


def identity(block):
    annotation = block["annotation"]
    return annotation["variant"] if "variant" in annotation else None


def block_ok(block, section, historical=False):
    require(isinstance(block, dict) and {"annotation", "content"} <= block.keys(), "block fields")
    require(block.keys() <= {"annotation", "content", "prose"}, "lab unsupported block extra member")
    a, body = block["annotation"], block["content"]
    require(isinstance(a, dict) and isinstance(body, dict), "block object types")
    require(a.get("section") == section and isinstance(body.get("_meta"), dict)
            and body["_meta"].get("section") == section, "section identity disagreement")
    require(all(isinstance(v, (str, bool, int, float)) and v is not None for v in a.values()), "annotation scalar")
    require("variant" not in a or isinstance(a["variant"], str), "annotation variant is string or absent")
    require(not any(k in ("__proto__", "constructor", "prototype") for k in a), "unsafe annotation key")
    require(identity(block) not in ("__proto__", "constructor", "prototype"), "unsafe variant")
    lifecycle = body["_meta"].get("lifecycle")
    require(isinstance(lifecycle, dict) and isinstance(lifecycle.get("superseded"), bool), "lifecycle shape")
    require(lifecycle["superseded"] == historical, "active/history placement")
    if "superseded" in a:
        require(a["superseded"] is historical, "fence lifecycle disagreement")
    require("prose" not in block or isinstance(block["prose"], str), "prose type")


def validate(model, stamped=True):
    require(isinstance(model, dict) and REQUIRED <= model.keys(), "required model fields")
    require(model["envelope_version"] == E, "candidate version unsupported")
    require(model["format_version"] == "3.0" and isinstance(model["frontmatter"], dict)
            and model["frontmatter"].get("uw_version") == "3.0", "format relationship")
    for key, empty in EMPTY.items():
        require(model[key] == empty, "lab unsupported nonempty builtin collection")
    require(isinstance(model["extensions"], dict) and isinstance(model["superseded"], dict), "collection shape")
    for section, entry in model["extensions"].items():
        require(section.startswith("x_") and isinstance(entry, dict), "extension id/entry")
        mode = entry.get("mode")
        if mode == "single":
            require(set(entry) == {"mode", "block"}, "closed single wrapper")
            block_ok(entry["block"], section)
        else:
            require(mode == "variants" and set(entry) == {"mode", "blocks"}, "closed variants wrapper")
            records = entry["blocks"]
            require(isinstance(records, list) and len(records) > 0, "nonempty variants")
            ids = []
            for record in records:
                require(isinstance(record, dict) and set(record) == {"variant", "block"}, "closed variant record")
                require(record["variant"] is None or isinstance(record["variant"], str), "nullable identity")
                block_ok(record["block"], section)
                require(record["variant"] == identity(record["block"]), "variant annotation disagreement")
                ids.append(record["variant"])
            require(len(set(ids)) == len(ids), "duplicate exact identity")
            require(ids == sorted(ids, key=order), "noncanonical identity ordering")
    for section, history in model["superseded"].items():
        require(section.startswith("x_") and isinstance(history, list) and len(history) > 0, "lab history domain/nonempty slot")
        for block in history:
            block_ok(block, section, True)
    for key in ("generated_at", "generator"):
        require(key not in model or isinstance(model[key], str), "lab optional transport member string")
    canonical(model)  # Existing JCS primitive rejects invalid Unicode/nonfinite values.
    if stamped:
        require(model.get("semantic_digest") == digest(model), "semantic digest mismatch")
    return model


def digest(model):
    value = {k: v for k, v in model.items() if k not in VOLATILE}
    return "sha256:" + hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def stamp(model):
    value = copy.deepcopy(model)
    validate(value, False)
    value["semantic_digest"] = digest(value)
    return value


def encode_json(model):
    validate(model)
    return json.dumps(model, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def decode_json(text):
    return validate(load_json(text))


def xml_string(text):
    require(all(c in "\t\n\r" or 0x20 <= ord(c) <= 0xD7FF or 0xE000 <= ord(c) <= 0xFFFD
                or 0x10000 <= ord(c) <= 0x10FFFF for c in text), "XML1 character unavailable")


def tag(name):
    return "{" + NS + "}" + name


def encode_xml(model):
    validate(model)
    ET.register_namespace("uw", NS)
    root = ET.Element(tag("document"), {"envelope-version": E, "format-version": model["format_version"]})
    def add(parent, name, value, member=False):
        element = ET.SubElement(parent, tag("member" if member else name), {"name": name} if member else {})
        if value is None:
            element.set(tag("type"), "null")
        elif isinstance(value, bool):
            element.set(tag("type"), "boolean"); element.text = "true" if value else "false"
        elif isinstance(value, str):
            xml_string(value); element.set(tag("type"), "string"); element.text = value
        elif isinstance(value, (int, float)):
            element.set(tag("type"), "number"); element.text = canonical(value)
        elif isinstance(value, list):
            element.set(tag("type"), "array")
            for item in value: add(element, "item", item)
        else:
            element.set(tag("type"), "object")
            for key in sorted(value, key=lambda s: s.encode("utf-16-be")):
                xml_string(key)
                add(element, key, value[key], not re.fullmatch(r"[A-Za-z_][A-Za-z0-9._-]*", key) or key in ("item", "member"))
    for key in sorted(set(model) - {"envelope_version", "format_version"}, key=lambda s: s.encode("utf-16-be")):
        xml_string(key)
        add(root, key, model[key], not re.fullmatch(r"[A-Za-z_][A-Za-z0-9._-]*", key) or key in ("item", "member"))
    # XML normalizes literal CR even inside strings; numeric references preserve it.
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode").replace("\r", "&#13;") + "\n"


def decode_xml(text):
    require(len(text.encode("utf-8")) <= 2 * 1024 * 1024 and "<!DOCTYPE" not in text.upper()
            and "<!ENTITY" not in text.upper(), "XML declarations/resource refusal")
    try: root = ET.fromstring(text)
    except ET.ParseError as error: raise Refusal("XML syntax") from error
    require(root.tag == tag("document") and set(root.attrib) == {"envelope-version", "format-version"}, "XML root")
    require(root.attrib["envelope-version"] == E, "candidate version unsupported")
    def member_name(element):
        require(element.tag.startswith("{" + NS + "}"), "XML member namespace")
        local = element.tag.removeprefix("{" + NS + "}")
        if local == "member":
            require("name" in element.attrib, "XML escaped member name")
            return element.attrib["name"]
        require(local not in ("item", "member") and re.fullmatch(r"[A-Za-z_][A-Za-z0-9._-]*", local) is not None, "XML object key escape")
        return local
    def value(element, depth=0):
        require(depth < 64 and element.tag.startswith("{" + NS + "}"), "XML depth/namespace")
        is_member = element.tag == tag("member")
        require(set(element.attrib) == ({tag("type"), "name"} if is_member else {tag("type")}), "XML value attributes")
        kind = element.get(tag("type"))
        children, text_value = list(element), element.text or ""
        if kind == "object":
            require(not text_value.strip() and all(not (c.tail or "").strip() for c in children), "XML object text")
            out = {}
            for child in children:
                key = member_name(child)
                require(key not in out and isinstance(key, str), "duplicate XML member")
                require(child.tag != tag("item"), "XML object item requires member escape")
                out[key] = value(child, depth + 1)
            return out
        if kind == "array":
            require(not text_value.strip() and all(c.tag == tag("item") and not (c.tail or "").strip() for c in children), "XML array shape")
            return [value(c, depth + 1) for c in children]
        require(not children, "XML scalar children")
        if kind == "string": return text_value
        if kind == "null": require(text_value == "", "XML null text"); return None
        if kind == "boolean": require(text_value in ("true", "false"), "XML boolean"); return text_value == "true"
        require(kind == "number", "XML type")
        number = load_json(text_value)
        require(type(number) in (int, float), "XML number")
        canonical(number)
        return number
    model = {"envelope_version": root.get("envelope-version"), "format_version": root.get("format-version")}
    require(not (root.text or "").strip(), "XML root text")
    for child in root:
        key = member_name(child)
        require(key not in model and not (child.tail or "").strip(), "duplicate XML root member")
        model[key] = value(child)
    return validate(model)


def esc(text): return text.replace("~", "~0").replace("/", "~1")


def flatten(value, pointer=""):
    kind = "null" if value is None else "boolean" if isinstance(value, bool) else "string" if isinstance(value, str) else "number" if isinstance(value, (int, float)) else "array" if isinstance(value, list) else "object"
    rows = [[pointer, kind, "" if kind in ("object", "array") else canonical(value)]]
    pairs = enumerate(value) if isinstance(value, list) else ((k, value[k]) for k in sorted(value, key=lambda s: s.encode("utf-16-be"))) if isinstance(value, dict) else []
    for key, item in pairs: rows.extend(flatten(item, pointer + "/" + esc(str(key))))
    return rows


def unflatten(rows):
    nodes = {}
    for pointer, kind, lexical in rows:
        require(pointer not in nodes and (pointer == "" or pointer.startswith("/")), "duplicate/invalid CSV pointer")
        parts = []
        for part in pointer.split("/")[1:]:
            require(re.search(r"~(?![01])", part) is None, "CSV pointer escape")
            decoded = part.replace("~1", "/").replace("~0", "~")
            require(esc(decoded) == part, "CSV pointer canonical escape")
            parts.append(decoded)
        path = tuple(parts)
        require(path not in nodes, "duplicate decoded CSV pointer")
        if kind in ("object", "array"):
            require(lexical == "", "CSV container lexical")
            item = {} if kind == "object" else []
        else:
            item = load_json(lexical)
            require(flatten(item) == [["", kind, lexical]], "CSV scalar type/canonical lexical")
        nodes[path] = (kind, item)
    require(() in nodes, "CSV root missing")
    def build(path):
        kind, item = nodes[path]
        children = [p for p in nodes if len(p) == len(path) + 1 and p[:-1] == path]
        if kind not in ("object", "array"):
            require(not children, "CSV scalar descendant"); return item
        if kind == "array":
            require({p[-1] for p in children} == {str(i) for i in range(len(children))}, "CSV array gaps")
            return [build(path + (str(i),)) for i in range(len(children))]
        return {p[-1]: build(p) for p in sorted(children)}
    for path in nodes:
        require(not path or path[:-1] in nodes, "CSV missing parent")
    return build(())


def table(header, rows):
    out = io.StringIO(newline="")
    writer = csv.writer(out, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(header); writer.writerows(rows)
    return out.getvalue()


def rows(text, header):
    require(text.endswith("\r\n"), "CSV final CRLF")
    parsed = list(csv.reader(io.StringIO(text, newline=""), strict=True))
    require(parsed and parsed[0] == header and all(len(r) == len(header) for r in parsed), "CSV header/width")
    return parsed[1:]


def enumerate_blocks(model):
    result = []
    for section in sorted(model["extensions"], key=lambda s: s.encode("utf-16-be")):
        entry = model["extensions"][section]
        if entry["mode"] == "single":
            result.append((["/extensions/" + esc(section) + "/block", "extensions", canonical(section), canonical(identity(entry["block"])), "", "current", "single"], entry["block"]))
        else:
            for i, record in enumerate(entry["blocks"]):
                result.append((["/extensions/" + esc(section) + "/blocks/" + str(i) + "/block", "extensions", canonical(section), canonical(record["variant"]), str(i), "current", "variants"], record["block"]))
    for section in sorted(model["superseded"], key=lambda s: s.encode("utf-16-be")):
        for i, block in enumerate(model["superseded"][section]):
            result.append((["/superseded/" + esc(section) + "/" + str(i), "superseded", canonical(section), "null", str(i), "superseded", ""], block))
    return result


def encode_csv(model):
    validate(model)
    extra = {k: v for k, v in model.items() if k not in REQUIRED and k not in VOLATILE}
    fm = model["frontmatter"]
    files = {"document.csv": table(DOC_COLUMNS, [[E, model["format_version"], canonical(model.get("generated_at")), canonical(model.get("generator")), model["semantic_digest"], canonical(fm.get("deal_id")), canonical(fm.get("deal_name")), canonical(extra)]]),
             "frontmatter.csv": table(["pointer", "json_type", "value_json"], flatten(fm))}
    descriptors, values, prose = [], [], []
    for descriptor, block in enumerate_blocks(model):
        descriptors.append(descriptor)
        ref = descriptor[0]
        content = {k: v for k, v in block["content"].items() if k != "_meta"}
        for scope, part in (("annotation", block["annotation"]), ("meta", block["content"]["_meta"]), ("content", content)):
            values.extend([[ref, scope, *r] for r in flatten(part)])
        if "prose" in block: prose.append([ref + "/prose", "block", ref, canonical(block["prose"])])
    files["blocks.csv"] = table(BLOCK_COLUMNS, descriptors)
    files["block_values.csv"] = table(["block_ref", "scope", "pointer", "json_type", "value_json"], values)
    files["prose.csv"] = table(["prose_ref", "scope", "block_ref", "prose_json"], prose)
    inventory = [{"path": name, "bytes": len(text.encode("utf-8")), "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()} for name, text in sorted(files.items())]
    files["manifest.json"] = json.dumps({"status": "UNACCEPTED RFC0089 DIRECTORY EXAMPLE", "bundle_version": B, "envelope_version": E, "format_version": model["format_version"], "canonicalization_version": C, "semantic_digest": model["semantic_digest"], "normalized_value_encoding": "canonical-json", "csv_dialect": "rfc4180", "inventory": inventory}, indent=2) + "\n"
    return files


def decode_csv(files):
    required_files = {"manifest.json", "document.csv", "frontmatter.csv", "blocks.csv", "block_values.csv", "prose.csv"}
    require(set(files) == required_files, "CSV missing/unlisted payload")
    manifest = load_json(files["manifest.json"])
    require(manifest.get("bundle_version") == B and manifest.get("envelope_version") == E
            and manifest.get("canonicalization_version") == C, "candidate bundle/regime unsupported")
    inventory = manifest["inventory"]
    require(len(inventory) == 5 and {i["path"] for i in inventory} == required_files - {"manifest.json"}, "CSV inventory duplicates/missing")
    for item in inventory:
        raw = files[item["path"]].encode("utf-8")
        require(len(raw) == item["bytes"] and hashlib.sha256(raw).hexdigest() == item["sha256"], "CSV inventory hash/size")
    doc = rows(files["document.csv"], DOC_COLUMNS)
    require(len(doc) == 1 and doc[0][0] == E, "CSV document/version")
    d = doc[0]
    fm = unflatten(rows(files["frontmatter.csv"], ["pointer", "json_type", "value_json"]))
    require(canonical(fm.get("deal_id")) == d[5] and canonical(fm.get("deal_name")) == d[6], "CSV frontmatter identity")
    extra = load_json(d[7]); require(isinstance(extra, dict) and not (set(extra) & (REQUIRED | set(VOLATILE))), "CSV extra collision")
    model = {**copy.deepcopy(EMPTY), **extra, "envelope_version": d[0], "format_version": d[1], "frontmatter": fm, "semantic_digest": d[4], "extensions": {}, "superseded": {}}
    for i, key in ((2, "generated_at"), (3, "generator")):
        value = load_json(d[i])
        if value is not None: model[key] = value
    descriptors = rows(files["blocks.csv"], BLOCK_COLUMNS)
    refs = [r[0] for r in descriptors]; require(len(set(refs)) == len(refs), "duplicate CSV block_ref")
    scopes = {}
    for ref, scope, *typed in rows(files["block_values.csv"], ["block_ref", "scope", "pointer", "json_type", "value_json"]):
        require(ref in refs and scope in ("annotation", "meta", "content"), "CSV value block/scope")
        scopes.setdefault((ref, scope), []).append(typed)
    prose = {}
    for ref, scope, block_ref, lexical in rows(files["prose.csv"], ["prose_ref", "scope", "block_ref", "prose_json"]):
        require(block_ref in refs and scope == "block" and ref == block_ref + "/prose" and block_ref not in prose, "CSV prose identity")
        prose[block_ref] = load_json(lexical); require(isinstance(prose[block_ref], str), "CSV prose type")
    staging = {}
    for descriptor in descriptors:
        ref, collection, section_json, variant_json, ordinal, state, mode = descriptor
        section, variant = load_json(section_json), load_json(variant_json)
        require(isinstance(section, str) and (variant is None or isinstance(variant, str)), "CSV descriptor identity")
        parts = {}
        for scope in ("annotation", "meta", "content"):
            require((ref, scope) in scopes, "CSV missing block scope")
            parts[scope] = unflatten(scopes[(ref, scope)])
            require(isinstance(parts[scope], dict), "CSV block scope object")
        require("_meta" not in parts["content"], "CSV metadata duplicated in content")
        block = {"annotation": parts["annotation"], "content": {"_meta": parts["meta"], **parts["content"]}}
        if ref in prose: block["prose"] = prose[ref]
        if collection == "extensions" and state == "current" and mode == "single":
            require(ordinal == "" and section not in model["extensions"] and section not in staging, "CSV conflicting singleton")
            model["extensions"][section] = {"mode": "single", "block": block}
        else:
            require(re.fullmatch(r"0|[1-9][0-9]*", ordinal) is not None, "CSV ordinal")
            if collection == "extensions" and state == "current" and mode == "variants":
                require(section not in model["extensions"], "CSV conflicting mode")
                target = staging.setdefault(section, {})
                require(int(ordinal) not in target, "CSV duplicate ordinal")
                target[int(ordinal)] = {"variant": variant, "block": block}
            else:
                require(collection == "superseded" and state == "superseded" and mode == "" and variant is None, "CSV history descriptor")
                target = model["superseded"].setdefault(section, {})
                require(int(ordinal) not in target, "CSV duplicate history ordinal")
                target[int(ordinal)] = block
    for section, indexed in staging.items():
        require(set(indexed) == set(range(len(indexed))), "CSV variants ordinal gap")
        model["extensions"][section] = {"mode": "variants", "blocks": [indexed[i] for i in range(len(indexed))]}
    for section, indexed in model["superseded"].items():
        require(set(indexed) == set(range(len(indexed))), "CSV history ordinal gap")
        model["superseded"][section] = [indexed[i] for i in range(len(indexed))]
    # Validates pointer/mode/variant/ordinal agreement and deterministic descriptor order.
    require([d for d, _ in enumerate_blocks(model)] == descriptors, "CSV descriptor/pointer disagreement")
    require(manifest.get("format_version") == model["format_version"] and manifest.get("semantic_digest") == model["semantic_digest"], "CSV manifest/document disagreement")
    return validate(model)
