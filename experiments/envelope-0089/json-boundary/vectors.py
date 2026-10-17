"""Disposable raw JSON mutations of preserved model/CSV-manifest bytes."""
import hashlib
import json
from pathlib import Path
import re
HERE = Path(__file__).resolve().parent

def key_escape(key):
    return '"\\u%04x%s"' % (ord(key[0]), key[1:])

def vectors():
    result = []
    for case in ("all-block-extras", "xml-lexical-domain"):
        base = HERE.parent / "codec-study/fixtures" / case
        files = {f.name: f.read_bytes().decode("utf8") for f in (base / "csv").iterdir()}
        model = json.loads((base / "model.json").read_bytes())
        for carrier in ("model-json", "csv-manifest"):
            text = (base / "model.json").read_bytes().decode("utf8") if carrier == "model-json" else files["manifest.json"]
            key = "envelope_version" if carrier == "model-json" else "bundle_version"
            literal = json.dumps(key)
            top = re.search(re.escape(literal) + r'\s*:\s*("[^"\\]*")', text)
            assert top is not None
            nested_key = "section" if carrier == "model-json" else "path"
            nested = re.search(json.dumps(nested_key) + r'\s*:\s*("[^"\\]*")', text)
            assert nested is not None
            def duplicate(match, escaped=False, conflicting=False):
                prefix_key = key_escape(key if match is top else nested_key) if escaped else json.dumps(key if match is top else nested_key)
                prefix_value = '"discarded-conflicting-value"' if conflicting else match[1]
                return text[:match.start()] + prefix_key + ":" + prefix_value + "," + text[match.start():]
            spellings = [
                ("original", text, True),
                ("escaped-unique-name", text[:top.start()] + key_escape(key) + text[top.start()+len(literal):], True),
                ("duplicate-identical", duplicate(top), False),
                ("duplicate-conflicting", duplicate(top, conflicting=True), False),
                ("escaped-duplicate-conflicting", duplicate(top, escaped=True, conflicting=True), False),
                ("nested-duplicate-identical", duplicate(nested), False),
                ("nested-escaped-duplicate-conflicting", duplicate(nested, escaped=True, conflicting=True), False),
            ]
            for name, raw, accepted in spellings:
                assert name == "original" or raw != text
                assert json.loads(raw) == json.loads(text)
                result.append(dict(case=case, carrier=carrier, vector=name, text=raw, files=files, model=model, expected_strict=accepted))
    for name, raw, accepted in [
        ("normalization-distinct-keys", '{"e\\u0301":1,"\\u00e9":2}', True),
        ("escaped-alias-duplicate", '{"a":1,"\\u0061":2}', False),
        ("case-distinct-keys", '{"A":1,"a":2}', True),
        ("string-delimiters", '{"text":"{\\\"x\\\":1}","slash":"\\/"}', True),
        ("trailing-input", '{}true', False),
        ("trailing-comma", '{"a":1,}', False),
        ("number-spellings", '[-0,1e0,1.25E+2]', True),
        ("overflowing-number", '1e999', False),
    ]:
        result.append(dict(case="syntax-only", carrier="json-data", vector=name, text=raw, expected_strict=accepted))
    for row in result:
        row["input_sha256"] = hashlib.sha256(row["text"].encode("utf8")).hexdigest()
    return result
