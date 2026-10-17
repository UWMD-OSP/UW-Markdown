"""Disposable namespace mutations of existing actual lexical-XML bytes."""
import hashlib
import json
from pathlib import Path
import re
HERE = Path(__file__).resolve().parent
NS = "urn:uwmd:unaccepted:rfc0089:json-lexical"
XML = "http://www.w3.org/XML/1998/namespace"


def vectors():
    output = []
    for case in ("all-block-extras", "xml-lexical-domain"):
        base = HERE.parent / "codec-study/fixtures" / case
        raw = (base / "document.xml").read_text(encoding="utf8")
        model = json.loads((base / "model.json").read_bytes())
        leaf = re.search(r'<uw:member name-json="&quot;envelope_version&quot;" type="string">[^<]*</uw:member>', raw)
        assert leaf is not None
        leaf = leaf.group()
        alias = raw.replace("xmlns:uw=", "xmlns:p=").replace("<uw:", "<p:").replace("</uw:", "</p:")
        default = raw.replace("xmlns:uw=", "xmlns=").replace("<uw:", "<").replace("</uw:", "</")
        scoped = leaf.replace("<uw:member", '<p:member xmlns:p="'+NS+'" xmlns:uw="urn:foreign"').replace("</uw:member>", "</p:member>")
        values = [
            ("original", raw, True), ("renamed-prefix", alias, True),
            ("default-namespace", default, True),
            ("scoped-prefix-shadow-restores-parent", raw.replace(leaf, scoped), True),
            ("normalized-namespace-uri", raw.replace(NS, NS.replace(":", "&#58;", 1), 1), True),
            ("unbound-prefix", raw.replace("<uw:", "<q:").replace("</uw:", "</q:"), False),
            ("wrong-root-uri", raw.replace(NS, "urn:foreign", 1), False),
            ("wrong-child-rebinding", raw.replace(leaf, leaf.replace("<uw:member", '<uw:member xmlns:uw="urn:foreign"')), False),
            ("default-undeclaration", default.replace(leaf.replace("uw:", ""), leaf.replace("uw:", "").replace("<member", '<member xmlns=""')), False),
            ("reserved-xml-binding", raw.replace('<uw:value ', '<uw:value xmlns:xml="urn:foreign" ', 1), False),
            ("reserved-uri-other-prefix", raw.replace('<uw:value ', '<uw:value xmlns:q="'+XML+'" ', 1), False),
            ("reserved-xmlns-prefix", raw.replace('<uw:value ', '<uw:value xmlns:xmlns="'+NS+'" ', 1), False),
            ("empty-prefixed-binding", raw.replace('xmlns:uw="'+NS+'"', 'xmlns:uw=""', 1), False),
            ("qualified-mapping-attribute", raw.replace('type="object"', 'p:type="object" xmlns:p="'+NS+'"', 1), False),
            ("duplicate-restored-key", raw.replace(leaf, leaf+leaf), False),
            ("noncanonical-string-escape", raw.replace(leaf, leaf.replace('"E_NEXT"', '"\\u0045_NEXT"')), False),
            ("surrogate-string", raw.replace(leaf, leaf.replace('"E_NEXT"', '"\\ud800"')), False),
            ("doctype", raw.replace('<uw:value ', '<!DOCTYPE value []><uw:value ', 1), False),
        ]
        for name, text, accepted in values:
            assert name == "original" or text != raw, name
            output.append(dict(case=case, vector=name, text=text, expected_accepted=accepted,
                               input_sha256=hashlib.sha256(text.encode("utf8")).hexdigest(), model=model))
    return output
