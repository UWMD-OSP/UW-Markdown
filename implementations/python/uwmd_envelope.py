"""Independent Envelope 1.0 semantic projection (RFC 0014, Receipt 3.1).

Distinct from the II.6a Reader projection and from document authentication.
No signature, receipt issuance/verification, or representation capability.
"""
import hashlib
import re

from uwmd_jcs import CanonicalizationError, canonicalize
from uwmd_reader import APPEND, PARALLEL, _superseded
from uwmd_text import trim


class EnvelopeError(ValueError):
    pass


def semantic_envelope(document):
    raw = document.source.raw
    closing = re.match(rb"---(?:\r\n|\r|\n|$)", raw[document.source.frontmatter_span.end:])
    if closing is None:
        raise EnvelopeError("frontmatter boundary unavailable")
    cursor = document.source.frontmatter_span.end + closing.end()
    result = dict(envelope_version="1.0", format_version="3.0", frontmatter=document.frontmatter.value,
                  sections={}, pipeline_log=[], custom_calculations=[], custom_scenarios=[],
                  extensions={}, superseded={})
    active = [block for block in document.source.blocks if not _superseded(block)]
    roles = {block.section for block in active if "_role" in block.parsed.value}
    variants = {block.section for block in active if "variant" in dict(block.attributes)}
    parallel = PARALLEL | (roles & variants)
    for block in document.source.blocks:
        annotation = {}
        for key, value in block.attributes:
            key = "section" if key == "uw:section" else key
            if key == "v":
                if re.fullmatch(r"[0-9]+", value) is None:
                    raise EnvelopeError("invalid annotation revision")
                try:
                    value = float(value)
                except (ValueError, OverflowError) as error:
                    raise EnvelopeError("unrepresentable annotation revision") from error
            elif key == "superseded":
                if value not in ("true", "false"):
                    raise EnvelopeError("invalid annotation lifecycle")
                value = value == "true"
            if key in annotation:
                raise EnvelopeError("annotation mapping collision")
            annotation[key] = value
        projected = dict(annotation=annotation, content=block.parsed.value)
        prose = trim(raw[cursor:block.fence_span.start].decode("utf-8").replace("\r\n", "\n").replace("\r", "\n"))
        if prose:
            projected["prose"] = prose
        cursor = block.fence_span.end
        section = block.section
        if _superseded(block):
            result["superseded"].setdefault(section, []).append(projected)
        elif section.startswith("x_"):
            if section in parallel:
                raise EnvelopeError("extension variant map is not representable by Envelope 1.0")
            result["extensions"][section] = projected
        elif section in APPEND:
            result[section].append(projected)
        elif section in parallel:
            result["sections"].setdefault(section, {})[dict(block.attributes).get("variant", "default")] = projected
        else:
            result["sections"][section] = projected
    return result


def envelope_digest(envelope):
    semantic = {key: value for key, value in envelope.items()
                if key not in ("generated_at", "generator", "semantic_digest")}
    return "sha256:" + hashlib.sha256(canonicalize(semantic).encode("utf-8")).hexdigest()


def source_digest(document):
    return envelope_digest(semantic_envelope(document))
