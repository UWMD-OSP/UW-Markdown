"""Independent read-only UW Composition 1.0 fragment resolution.

No network, directory I/O, modelling, package graph walk or receipt verification.
Original root/consumed source inventories remain distinct from assembled blocks.
"""
import copy
import re
from dataclasses import dataclass, replace

from uwmd_binding_sources import finite
from uwmd_document_sources import number_source
from uwmd_source import JSONSource, NumberToken
from uwmd_validation_selection import current_blocks, is_externalized, ValidationUnavailable

# Accepted Protocol standard-section vocabulary, not a new closed record reader.
_SECTIONS = frozenset("deal_context property ownership rent_roll operating_statement noi_model valuation debt_structure sources_uses dcf stress_tests market_analysis borrower_sponsor due_diligence risk_assessment compliance assumptions validation pipeline_log custom_calculations custom_scenarios gaps components capital_stack lease_up_schedule cash_flow_series distribution_waterfall reserve_accounts dc_capacity dc_power dc_revenue mhc_sites hotel_metrics hotel_brand hotel_food_beverage".split())


class CompositionError(ValueError):
    def __init__(self, code, message, pointer=None):
        super().__init__(message); self.code = code; self.pointer = pointer

    def projection(self):
        result = dict(category="validate", code=self.code, message=str(self))
        if self.pointer is not None: result["pointer"] = self.pointer
        return result


@dataclass(frozen=True)
class Part:
    part_id: str
    section: str
    collection_member: bool
    document: object
    blocks: tuple


@dataclass(frozen=True)
class Resolution:
    status: str
    document: object
    externalized: tuple
    issues: tuple
    consumed_parts: tuple


def _text(value):
    return isinstance(value, str) and len(value) > 0


def parse_part(document):
    fm = document.frontmatter.value
    if (not _text(fm.get("uwpart_version")) or not _text(fm.get("part_id"))
            or not _text(fm.get("section")) or "deal_id" in fm
            or "collection_member" in fm and not isinstance(fm["collection_member"], bool)):
        raise CompositionError("COMP-PART-MALFORMED", "Fragment frontmatter is malformed or carries deal_id")
    section = fm["section"]
    if (re.fullmatch(r"[a-z][a-z0-9_]{0,127}", section) is None
            or section not in _SECTIONS and not section.startswith("x_")):
        raise CompositionError("COMP-PART-MALFORMED", "Fragment section is not registered or an extension")
    if not document.source.blocks:
        raise CompositionError("COMP-PART-MALFORMED", "Fragment carries no section block")
    for block in document.source.blocks:
        if block.section != section:
            raise CompositionError("COMP-SECTION-MISMATCH", "Fragment blocks must target its declared section")
        if is_externalized(block):
            raise CompositionError("COMP-PART-MALFORMED", "A fragment must not itself externalize a section")
    blocks = current_blocks(document, section, include_external=True)
    if not blocks:
        raise CompositionError("COMP-PART-MALFORMED", "Fragment carries no current section block")
    return Part(fm["part_id"], section, fm.get("collection_member") is True, document, blocks)


def index_parts(documents):
    parts = {}
    for document in documents:
        part = parse_part(document)
        if part.part_id in parts:
            raise CompositionError("COMP-DUP-KEY", "Package repeats a fragment part_id")
        parts[part.part_id] = part
    return parts


def _directive(value):
    errors = []
    def error(code, field, message):
        errors.append(CompositionError(code, message, field).projection())
    if not isinstance(value, dict):
        error("COMP-DIRECTIVE-MALFORMED", "external", "External directive must be an object")
        return errors
    parts = value.get("parts")
    if not isinstance(parts, list) or not parts or any(not _text(item) for item in parts):
        error("COMP-DIRECTIVE-MALFORMED", "external.parts", "A nonempty array of part identities is required")
    else:
        seen = set()
        for part in parts:
            if part in seen: error("COMP-DUP-KEY", "external.parts", "External directive repeats a part identity")
            seen.add(part)
    count = value.get("part_count")
    if not finite(count) or int(count) != count or count < 1:
        error("COMP-DIRECTIVE-MALFORMED", "external.part_count", "Part count must be a positive integer")
    elif isinstance(parts, list) and count != len(parts):
        error("COMP-COUNT-MISMATCH", "external.part_count", "Part count differs from the declared part identities")
    for field in ("collection_key", "collection_path"):
        if field in value and not _text(value[field]):
            error("COMP-DIRECTIVE-MALFORMED", "external." + field, "Collection member names must be nonempty strings")
    if ("collection_key" in value) != ("collection_path" in value):
        error("COMP-DIRECTIVE-MALFORMED", "external", "Collection key and path must be declared together")
    if any(key not in ("parts", "part_count", "collection_key", "collection_path") for key in value):
        error("COMP-DIRECTIVE-MALFORMED", "external", "External directive has an unknown member")
    return errors


def _pointer(name):
    return name.replace("~", "~0").replace("/", "~1")


def resolve_composition(document, parts):
    # One joint snapshot preserves aliases and protects all caller-owned models.
    document, parts = copy.deepcopy((document, parts))
    replacements, externalized, issues, consumed = {}, [], [], []
    seen_sources = set()
    number_origins = list(document._number_origins)
    current = {id(block) for section in dict.fromkeys(b.section for b in document.source.blocks)
               for block in current_blocks(document, section, include_external=True)}
    for block in document.source.blocks:
        if id(block) not in current or not is_externalized(block):
            continue
        section = block.section
        if section not in externalized: externalized.append(section)
        directive = block.parsed.value.get("external")
        failed = _directive(directive)
        if failed:
            issues.extend(failed); continue
        selected = []
        for identity in directive["parts"]:
            part = parts.get(identity)
            if part is None:
                failed.append(CompositionError("COMP-UNRESOLVED", "Named fragment is unavailable", section + ".external.parts").projection())
            elif part.section != section:
                failed.append(CompositionError("COMP-SECTION-MISMATCH", "Fragment section differs from its referencing section", section + ".external.parts").projection())
            else:
                selected.append(part)
        if failed:
            issues.extend(failed); continue
        kinds = {part.collection_member for part in selected}
        if len(kinds) != 1:
            issues.append(CompositionError("COMP-DIRECTIVE-MALFORMED", "Whole-section and collection fragments must not mix", section).projection()); continue
        if not selected[0].collection_member:
            if len(selected) != 1 or "collection_key" in directive or "collection_path" in directive:
                issues.append(CompositionError("COMP-DIRECTIVE-MALFORMED", "One whole-section fragment requires no collection declarations", section).projection()); continue
            if len(selected[0].blocks) != 1:
                raise ValidationUnavailable("Whole-section fragment has multiple current peers; no arbitrary peer is selected")
            parsed = selected[0].blocks[0].parsed
        else:
            if "collection_key" not in directive or "collection_path" not in directive:
                issues.append(CompositionError("COMP-DIRECTIVE-MALFORMED", "Collection fragments require their exact key and field", section).projection()); continue
            keyed = {}
            for part in selected:
                for row_block in part.blocks:
                    row = {key: value for key, value in row_block.parsed.value.items() if key != "_meta"}
                    key = row.get(directive["collection_key"])
                    if not _text(key):
                        failed.append(CompositionError("COMP-DIRECTIVE-MALFORMED", "Collection row has no nonempty string key", section).projection())
                    elif key in keyed:
                        failed.append(CompositionError("COMP-DUP-KEY", "Collection rows repeat the declared key", section).projection())
                    else:
                        keyed[key] = (row, row_block.parsed.numbers, part.document)
            if failed:
                issues.extend(failed); continue
            ordered = [keyed[key] for key in sorted(keyed, key=lambda key: key.encode("utf8"))]
            field = directive["collection_path"]
            content = {key: value for key, value in block.parsed.value.items() if key != "external"}
            content[field] = [row for row, _, _ in ordered]
            prefix = "/" + _pointer(field)
            numbers = [token for token in block.parsed.numbers
                       if token.pointer != "/external" and not token.pointer.startswith("/external/")
                       and token.pointer != prefix and not token.pointer.startswith(prefix + "/")]
            for index, (_, tokens, origin) in enumerate(ordered):
                for token in tokens:
                    if token.pointer != "/_meta" and not token.pointer.startswith("/_meta/"):
                        rebased = NumberToken(prefix + "/" + str(index) + token.pointer, token.lexeme, token.span)
                        numbers.append(rebased)
                        number_origins.append((rebased, number_source(origin, token)))
            parsed = JSONSource(content, tuple(numbers))
        inline = replace(block, attributes=tuple((key, value) for key, value in block.attributes if key != "external"), parsed=parsed)
        replacements[id(block)] = inline
        for part in selected:
            if id(part.document.source) not in seen_sources:
                seen_sources.add(id(part.document.source)); consumed.append(part)
    sources = document._retained_sources or (document.source,)
    sources = (*sources, *(part.document.source for part in consumed))
    assembled = replace(document, source=replace(document.source,
        blocks=tuple(replacements.get(id(block), block) for block in document.source.blocks)),
        _retained_sources=sources, _number_origins=tuple(number_origins))
    return Resolution("unresolved" if issues else "resolved", assembled, tuple(externalized), tuple(issues), tuple(consumed))
