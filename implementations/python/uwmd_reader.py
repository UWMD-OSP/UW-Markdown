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

    def projection(self) -> dict:
        output = dict(frontmatter=self.frontmatter.value, sections={}, superseded={},
                      pipeline_log=[], custom_calculations=[], custom_scenarios=[], extensions={}, prose={})
        active = [block for block in self.source.blocks if not _superseded(block)]
        role_sections = {block.section for block in active if "_role" in block.parsed.value}
        variant_sections = {block.section for block in active if "variant" in dict(block.attributes)}
        parallel = PARALLEL | (role_sections & variant_sections)
        for block in self.source.blocks:
            section, projected = block.section, _projection(block)
            if _superseded(block):
                output["superseded"].setdefault(section, []).append(projected)
            elif section in APPEND:
                # Pipeline entries are complete append-only log objects. The
                # other two collections retain the II.6a wrapped block shape.
                output[section].append(block.parsed.value if section == "pipeline_log" else projected)
            elif section.startswith("x_"):
                if section in parallel:
                    output["extensions"].setdefault(section, {})[dict(block.attributes).get("variant", "default")] = projected
                else:
                    output["extensions"][section] = projected
            elif section in parallel:
                output["sections"].setdefault(section, {})[dict(block.attributes).get("variant", "default")] = projected
            else:
                output["sections"][section] = projected
        return output


def parse(raw: bytes, *, filename: str | None = None) -> Document:
    if re.match(rb"---(?:\r\n|\r|\n|$)", raw.removeprefix(b"\xef\xbb\xbf")) is None:
        raise ReaderError("UNSUPPORTED_FORMAT_VERSION", "declared uw_version is absent; supported value is '3.0'")
    source = scan_source(raw)
    frontmatter = parse_frontmatter(source.frontmatter_span.extract(raw),
                                   byte_offset=source.frontmatter_span.start)
    if frontmatter.value.get("uw_version") != "3.0":
        raise ReaderError("UNSUPPORTED_FORMAT_VERSION",
                          "declared uw_version is " + repr(frontmatter.value.get("uw_version"))
                          + "; supported value is '3.0'")
    if filename is not None and filename.endswith(".uw.md") and source.blocks:
        raise ReaderError("SOURCE_CONTENT_MISMATCH", "structured records require .uwx.md")
    return Document(source, frontmatter)
