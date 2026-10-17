"""Independent active-block source/role inventory, not full Format validation.

Registered SRC/ROLE findings and pinned META-01 routing checks are separate from
local selected-shape diagnostics. No source resolution, inference or rewriting.
"""
import copy
import math
import re

from uwmd_source_lifecycle import source_superseded


SOURCE_NAMESPACES = ("agent", "document", "system", "institution")
RESOLUTION_TAGS = (
    "user_input", "user_override", "inherited_assumption", "investor_profile",
    "market_data", "market_data_accepted", "ai_extracted", "agent_computed",
    "asset_class_default", "scenario_default", "global_default", "system_default",
)
BLOCK_ROLES = ("primary", "senior", "junior", "summary", "detail", "component")
CONFIDENCE = ("high", "medium", "low")
REASONS = ("illegible", "missing", "overridden", "estimated", "computed")
_SOURCE = re.compile(r"(?:manual|(?:agent|document|system|institution)/[A-Za-z0-9][A-Za-z0-9._-]*)\Z")


def source_code(value):
    """Exact authored value only: manual is an actor, every resolution tag is not."""
    if isinstance(value, str) and _SOURCE.fullmatch(value):
        return None
    if isinstance(value, str) and value in RESOLUTION_TAGS:
        return "SRC-02"
    return "SRC-01"


def _integer(value):
    return (not isinstance(value, bool) and isinstance(value, (int, float))
            and math.isfinite(value) and value >= 1 and int(value) == value)


def inspect_source_roles(document):
    """Inspect every active physical block without canonical-selection loss.

    Historical blocks are retained in the caller's Document and explicitly
    skipped by this bounded current-source inventory. No role is reclassified.
    The wrapper/shape diagnostics are local, not ValidationResult or new codes.
    """
    snapshot = copy.deepcopy(document)
    result = dict(scope="active_source_provenance_and_roles", ok=True, issues=[],
                  shape_findings=[], blocks=[], history_blocks_skipped=0, blocks_checked=0)
    for index, block in enumerate(snapshot.source.blocks):
        if source_superseded(block):
            result["history_blocks_skipped"] += 1
            continue
        result["blocks_checked"] += 1
        body = block.parsed.value
        context = dict(block_index=index, variant=dict(block.attributes).get("variant"),
                       body_byte_start=block.body_span.start, body_byte_end=block.body_span.end)
        evidence = dict(section=block.section, **context)
        result["blocks"].append(evidence)
        def issue(code, field, message):
            result["issues"].append(dict(code=code, severity="error", section=block.section,
                field=field, message=message, context=copy.deepcopy(context)))
        def shape(field, message):
            result["shape_findings"].append(dict(section=block.section, field=field,
                message=message, context=copy.deepcopy(context)))
        def vocabulary(container, field):
            if "source" in container:
                code = source_code(container["source"])
                if code:
                    issue(code, field + ".source", "Source must be an exact registered actor identifier, never a resolution method.")
            if "resolution" in container and container["resolution"] not in RESOLUTION_TAGS:
                issue("SRC-03", field + ".resolution", "Resolution must be a member of the closed vocabulary; manual is actor-only.")
        if "_role" in body:
            evidence["role"] = copy.deepcopy(body["_role"])
            if body["_role"] not in BLOCK_ROLES:
                issue("ROLE-01", "_role", "An active block role must be one admitted scalar role.")
        routing = []
        meta = body.get("_meta")
        if "_meta" not in body:
            # Absence belongs to the distinct provenance-completeness family.
            # Completeness findings belong to the full validator, not this inventory.
            shape("_meta", "Metadata is absent; provenance completeness is outside this partial command.")
        elif not isinstance(meta, dict):
            routing.append("A nested _meta object is required.")
        else:
            if next(iter(body), None) != "_meta":
                routing.append("_meta must be the first block member.")
            if meta.get("section") != block.section:
                routing.append("_meta.section must match the exact fence section.")
            if not isinstance(meta.get("provenance"), dict) or not isinstance(meta.get("lifecycle"), dict):
                routing.append("Nested provenance and lifecycle objects are required.")
        if "section_id" in body:
            routing.append("A top-level section_id wrapper is not admitted.")
        if routing:
            issue("META-01", "_meta", " ".join(routing))
        if isinstance(meta, dict):
            provenance = meta.get("provenance")
            if isinstance(provenance, dict):
                vocabulary(provenance, "_meta.provenance")
                for field in ("source", "resolution"):
                    if field in provenance:
                        evidence[field] = copy.deepcopy(provenance[field])
                for field in ("source", "actor", "timestamp"):
                    if field not in provenance:
                        shape("_meta.provenance." + field, "Required provenance member is absent.")
                    elif not isinstance(provenance[field], str):
                        shape("_meta.provenance." + field, "A string is required.")
                if isinstance(provenance.get("actor"), str) and not provenance["actor"]:
                    shape("_meta.provenance.actor", "Actor must have at least one character.")
                if (source_code(provenance.get("source")) is None
                        and provenance["source"].startswith("agent/") and "agent_id" not in provenance):
                    shape("_meta.provenance.agent_id", "Agent sources require the agent_id member; null remains admitted.")
                for field in ("agent_id", "agent_version", "notes"):
                    if field in provenance and provenance[field] is not None and not isinstance(provenance[field], str):
                        shape("_meta.provenance." + field, "A string or null is required.")
            quality = meta.get("quality")
            if not isinstance(quality, dict):
                shape("_meta.quality", "A quality object is required.")
            else:
                if quality.get("confidence") not in CONFIDENCE:
                    shape("_meta.quality.confidence", "An admitted confidence is required.")
                for field in ("human_review_required", "partial", "provisional"):
                    if (field == "human_review_required" or field in quality) and not isinstance(quality.get(field), bool):
                        shape("_meta.quality." + field, "A boolean is required.")
                if "flags" in quality and (not isinstance(quality["flags"], list)
                        or any(not isinstance(flag, str) for flag in quality["flags"])):
                    shape("_meta.quality.flags", "An array of strings is required.")
                if "field_overrides" in quality:
                    shape("_meta.quality.field_overrides", "Per-field annotations belong only in top-level _overrides.")
            lifecycle = meta.get("lifecycle")
            if isinstance(lifecycle, dict):
                try:
                    revision_valid = _integer(lifecycle.get("revision"))
                except OverflowError:
                    revision_valid = False
                if not revision_valid:
                    shape("_meta.lifecycle.revision", "A positive JSON integer is required; no sequence order is inferred.")
                if not isinstance(lifecycle.get("superseded"), bool):
                    shape("_meta.lifecycle.superseded", "A boolean is required.")
        if "_overrides" in body:
            overrides = body["_overrides"]
            if not isinstance(overrides, list):
                shape("_overrides", "An array of field-annotation objects is required.")
            else:
                evidence["overrides_checked"] = len(overrides)
                for ordinal, entry in enumerate(overrides):
                    field = "_overrides[" + str(ordinal) + "]"
                    if not isinstance(entry, dict):
                        shape(field, "A field-annotation object is required.")
                        continue
                    vocabulary(entry, field)
                    if not isinstance(entry.get("path"), str):
                        shape(field + ".path", "A string path is required; no target lookup or new path grammar is applied.")
                    for name, admitted in (("confidence", CONFIDENCE), ("reason", REASONS)):
                        if name in entry and entry[name] not in admitted:
                            shape(field + "." + name, "Value is outside the admitted annotation vocabulary.")
                    if "note" in entry and not isinstance(entry["note"], str):
                        shape(field + ".note", "A string note is required.")
    result["ok"] = not result["issues"] and not result["shape_findings"]
    return result
