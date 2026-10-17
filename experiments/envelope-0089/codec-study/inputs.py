"""Independently specified synthetic inputs, not derived by an encoder."""
from copy import deepcopy


def block(section, variant=None, history=False, extra=True):
    a = {"section": section}
    if variant is not None: a["variant"] = variant
    if history: a["superseded"] = True
    b = {"annotation": a, "content": {"_meta": {"section": section, "lifecycle": {"revision": 1, "superseded": history}}, "content": {"literal": True}, "empty": {}, "null": None}, "prose": "exact CR\rLF\nTAB\t <&>"}
    if extra: b.update({"x_extra": {"null": None, "empty_object": {}, "empty_array": [], "a/~b": [False, 1.5, ""]}, "x_absent_control": None})
    return b


def models():
    value = {"envelope_version": "E_NEXT", "format_version": "3.0", "frontmatter": {"uw_version": "3.0", "deal_id": "independent-codec-research"}, "sections": {"property": block("property"), "operating_statement": {"t12": block("operating_statement", "t12")}}, "pipeline_log": [block("pipeline_log")], "custom_calculations": [block("custom_calculations")], "custom_scenarios": [block("custom_scenarios")], "extensions": {"x_review": {"mode": "variants", "blocks": [{"variant": None, "block": block("x_review")}, {"variant": "default", "block": block("x_review", "default")}]}, "x_single": {"mode": "single", "block": block("x_single")}}, "superseded": {"x_review": [block("x_review", history=True), block("x_review", "default", history=True)]}, "x_outer": {"empty": [], "null": None, "content": "not a block"}}
    value["extensions"]["x_review"]["blocks"][0]["block"]["content"]["_role"] = "primary"
    other = deepcopy(value)
    other["frontmatter"]["deal_id"] = "json-lexical-domain"
    other["x_outer"].update({"nul\u0000name": "NUL\u0000 U+FFFE\ufffe U+FFFF\uffff pair\U0001f600", "member": "quote\"slash\\", "\ue000": "BMP", "\U0001f600": "supplementary", "not_normalized": "e\u0301"})
    other["extensions"]["x_single"]["block"]["x_extra"]["nul\u0000"] = "\r\n\t\u0000\ufffe\uffff"
    return {"all-block-extras": value, "xml-lexical-domain": other}
