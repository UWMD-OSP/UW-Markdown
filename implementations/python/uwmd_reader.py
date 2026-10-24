"""Independent, read-only Format 3.0 structured Markdown Reader foundation.

Carrier scanning and JSON tokens come from uwmd_source; there is no second
character-offset scanner or model generation. Protocol II.1/II.6a.6, Format II.
"""
from dataclasses import dataclass
import re

from uwmd_frontmatter import FrontmatterSource, parse_frontmatter
from uwmd_source import ScannedSource, SourceError, StructuredBlock, scan_source
from uwmd_source_lifecycle import source_superseded as _superseded


class ReaderError(SourceError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


PARALLEL = frozenset(("operating_statement", "stress_tests", "due_diligence",
                      "lease_up_schedule", "cash_flow_series", "distribution_waterfall", "reserve_accounts"))
APPEND = frozenset(("pipeline_log", "custom_calculations", "custom_scenarios"))


def _projection(block: StructuredBlock) -> dict:
    body = block.parsed.value
    projected = {"content": {key: value for key, value in body.items() if key not in ("_meta", "_notes")}}
    if "_meta" in body:
        projected["meta"] = body["_meta"]
    for source, destination in (("_role", "role"), ("_overrides", "overrides")):
        if source in body:
            projected[destination] = body[source]
    return projected


@dataclass(frozen=True)
class Document:
    source: ScannedSource
    frontmatter: FrontmatterSource
    # Composition keeps original root/consumed fragment sources separate from
    # the assembled financial view. Empty for an ordinary parsed record.
    _retained_sources: tuple[ScannedSource, ...] = ()
    # Rebased collection number pointers retain their original token byte origin.
    _number_origins: tuple[tuple[object, ScannedSource], ...] = ()

    def projection(self) -> dict:
        output = dict(frontmatter=self.frontmatter.value, sections={}, superseded={},
                      pipeline_log=[], custom_calculations=[], custom_scenarios=[], extensions={}, prose={})
        active = [block for block in self.source.blocks if not _superseded(block)]
        role_sections = {block.section for block in active if "_role" in block.parsed.value}
        variant_sections = {block.section for block in active if "variant" in dict(block.attributes)}
        parallel = PARALLEL | (role_sections & variant_sections)
        # RFC 0089: exact extension modes/nullable identities and physical-event
        # history order; no metadata or annotation mutation to label history.
        for block in self.source.blocks:
            section, projected = block.section, _projection(block)
            if section in APPEND:
                output[section].append(block.parsed.value if section == "pipeline_log" else projected)
            elif _superseded(block):
                output["superseded"].setdefault(section, []).append(projected)
            elif section.startswith("x_"):
                current = output["extensions"].get(section)
                if section in parallel:
                    identity = dict(block.attributes).get("variant")
                    if current is None:
                        current = {"mode": "variants", "blocks": []}
                        output["extensions"][section] = current
                    prior = next((item for item in current["blocks"] if item["variant"] == identity), None)
                    if prior is not None:
                        output["superseded"].setdefault(section, []).append(prior["block"])
                        current["blocks"].remove(prior)
                    current["blocks"].append({"variant": identity, "block": projected})
                    current["blocks"].sort(key=lambda item: (item["variant"] is not None, (item["variant"] or "").encode("utf-16-be")))
                else:
                    if current is not None:
                        output["superseded"].setdefault(section, []).append(current["block"])
                    output["extensions"][section] = {"mode": "single", "block": projected}
            elif section in parallel:
                variants = output["sections"].setdefault(section, {})
                key = dict(block.attributes).get("variant", "default")
                if key in variants:
                    output["superseded"].setdefault(section, []).append(variants[key])
                variants[key] = projected
            else:
                if section in output["sections"]:
                    output["superseded"].setdefault(section, []).append(output["sections"][section])
                output["sections"][section] = projected
        return output


_UWX_FENCE = re.compile(rb"(?:^|(?<=\r))```json[ \t]+uw:section=\S+", re.M)


def parse(raw: bytes, *, filename: str | None = None, require_structured: bool = False) -> Document:
    # The representation is decided before the version, as the reference
    # decides it, from a structured fence opening any line of the source.
    body = raw.removeprefix(b"\xef\xbb\xbf")
    name = filename.lower() if filename is not None else None
    structured = _UWX_FENCE.search(body) is not None
    if name is not None and name.endswith(".uw.md") and structured:
        raise ReaderError("SOURCE_CONTENT_MISMATCH", "structured records require .uwx.md")
    # The reference's parse and validate commands refuse a .uwx.md with no
    # structured fence; its other commands read it. Callers opt in.
    if require_structured and name is not None and name.endswith(".uwx.md") and not structured:
        raise ReaderError("SOURCE_CONTENT_MISMATCH", "a .uwx.md file must contain UWX structured section fences")
    if re.match(rb"---(?:\r\n|\r|\n|$)", body) is None:
        raise ReaderError("UNSUPPORTED_FORMAT_VERSION", "declared uw_version is absent; supported value is '3.0'")
    source = scan_source(raw)
    frontmatter = parse_frontmatter(source.frontmatter_span.extract(raw),
                                   byte_offset=source.frontmatter_span.start)
    if frontmatter.value.get("uw_version") != "3.0":
        raise ReaderError("UNSUPPORTED_FORMAT_VERSION",
                          "declared uw_version is " + repr(frontmatter.value.get("uw_version"))
                          + "; supported value is '3.0'")
    return Document(source, frontmatter)
