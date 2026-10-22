"""Local unresolved-composition assessment for the developing validation API.

Uses accepted UW_COMPOSITION 3/6/8 status/error meanings and the exported
CompositionResolution status/externalized/issues shape. This is no resolver,
not the full resolution result, and not a new normative ValidationResult field.
No parts are fetched, merged or substituted; original bytes/identities remain.
"""
from uwmd_binding_sources import finite
from uwmd_validation_selection import current_blocks, is_externalized


def composition_assessment(document):
    current = []
    for section in dict.fromkeys(b.section for b in document.source.blocks):
        current.extend(b for b in current_blocks(document, section, include_external=True)
                       if is_externalized(b))
    current.sort(key=lambda block: block.fence_span.start)
    externalized, issues = [], []
    physical = {id(block): index for index, block in enumerate(document.source.blocks)}
    for block in current:
        if block.section not in externalized:
            externalized.append(block.section)
        pointer = "source.blocks[" + str(physical[id(block)]) + "].parsed.value.external"
        def issue(code, message):
            issues.append(dict(category="validate", code=code, message=message, pointer=pointer))
        directive = block.parsed.value.get("external")
        valid = isinstance(directive, dict)
        if valid:
            parts, count = directive.get("parts"), directive.get("part_count")
            valid_parts = (isinstance(parts, list) and bool(parts)
                           and all(isinstance(part, str) and bool(part) for part in parts))
            valid_count = finite(count) and count >= 1 and int(count) == count
            valid = (valid_parts and valid_count and
                     set(directive) <= {"parts", "part_count", "collection_key", "collection_path"})
            if valid_parts and len(set(parts)) != len(parts):
                issue("COMP-DUP-KEY", "External parts name the same part_id more than once")
            if valid_count and isinstance(parts, list) and count != len(parts):
                issue("COMP-COUNT-MISMATCH", "Declared part_count does not match the stated parts array")
            paired = ("collection_key" in directive) == ("collection_path" in directive)
            valid = valid and paired and all(
                key not in directive or isinstance(directive[key], str) and bool(directive[key])
                for key in ("collection_key", "collection_path"))
        if not valid:
            issue("COMP-DIRECTIVE-MALFORMED", "Marked external section has an invalid directive shape")
        # Collection membership is unknown without the parts. Do not infer
        # whole-section/collection merge rules or pretend partial rows resolve.
        issue("COMP-UNRESOLVED", block.section + " is externalized; this API does not resolve package parts")
    return dict(status="unresolved" if current else "resolved",
                externalized=externalized, issues=issues)
