"""Independent bounded metadata/source/role inventory, not full Format validation.

Registered SRC/ROLE findings and pinned META-01 routing checks are separate from
local selected-shape diagnostics. No source resolution, inference or rewriting.
"""
import copy
import math
import re

from uwmd_source_lifecycle import source_superseded
from uwmd_document_sources import metadata_blocks, authored_source_reference, source_context
from uwmd_numeric import calendar_date
from uwmd_metadata_admission import _optional_predicates, _reference_predicates


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


def _metadata_routing(body):
    routing = []
    meta = body.get("_meta")
    if "_meta" not in body:
        pass  # Whole-missing metadata belongs to completeness, not actor admission.
    elif not isinstance(meta, dict):
        routing.append("A nested _meta object is required.")
    else:
        if not isinstance(meta.get("provenance"), dict) or not isinstance(meta.get("lifecycle"), dict):
            routing.append("Nested provenance and lifecycle objects are required.")
    if "section_id" in body:
        routing.append("A top-level section_id wrapper is not admitted.")
    return routing



def _array_index_name(name):
    # RFC0093 D7 shares ECMAScript's exact array-index spelling domain.
    return (isinstance(name, str) and len(name) <= 10
            and re.fullmatch(r"(?:0|[1-9][0-9]*)", name) is not None
            and int(name) <= 4294967294)


def _metadata_shape_predicates(body, section, *, _source_order=False):
    """Only RFC0093 P1/P2/P3; never a parent-admission suppression rule."""
    if _metadata_routing(body) or "_meta" not in body:
        return ()
    meta = body["_meta"]
    names = list(body) if _source_order else [
        name for name in body if isinstance(name, str) and not _array_index_name(name)]
    failed = []
    if names and names[0] != "_meta":
        failed.append(("_meta", "Block _meta must be the first block member."))
    if ("section" in meta and (not isinstance(meta["section"], str)
            or not meta["section"] or meta["section"] != section)):
        failed.append(("_meta.section", "Block _meta.section must exactly match the annotated section."))
    if not isinstance(meta.get("quality"), dict):
        failed.append(("_meta.quality", "Block _meta.quality must be the required object."))
    return tuple(failed)


_TIMESTAMP_T1B = re.compile(
    r"([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?Z\Z")


def _timestamp_t1b(value):
    """RFC0094 exact UTC-Z spelling/calendar, independent of host date parsing."""
    if not isinstance(value, str):
        return False
    matched = _TIMESTAMP_T1B.fullmatch(value)
    return (matched is not None and calendar_date(matched[1])
            and int(matched[2]) <= 23 and int(matched[3]) <= 59
            and int(matched[4]) <= 59)


def _metadata_leaf_predicates(body):
    """Only accepted RFC0094 present-invalid leaves, in their complete pass order."""
    if "_meta" not in body or _metadata_routing(body):
        return ()
    meta = body["_meta"]
    failed = []
    quality = meta.get("quality")
    if (isinstance(quality, dict) and "confidence" in quality
            and (not isinstance(quality["confidence"], str) or quality["confidence"] not in CONFIDENCE)):
        failed.append(("_meta.quality.confidence", "Present confidence must be exactly high, medium or low."))
    lifecycle = meta["lifecycle"]
    if "revision" in lifecycle:
        try:
            valid = _integer(lifecycle["revision"])
        except OverflowError:
            valid = False
        if not valid:
            failed.append(("_meta.lifecycle.revision", "Present revision must be a finite positive JSON integer."))
    provenance = meta["provenance"]
    if "timestamp" in provenance and not _timestamp_t1b(provenance["timestamp"]):
        failed.append(("_meta.provenance.timestamp", "Present timestamp must use exact Gregorian YYYY-MM-DDTHH:mm:ss[.digits]Z."))
    return tuple(failed)


def _metadata_optional_predicates(body):
    meta = body["_meta"] if "_meta" in body and not _metadata_routing(body) else None
    return _optional_predicates(body, meta)


def _metadata_reference_predicates(body):
    if "_meta" not in body or _metadata_routing(body):
        return []
    meta = body["_meta"]
    provenance = meta["provenance"]
    source = provenance.get("source")
    agent = "source" in provenance and source_code(source) is None and source.startswith("agent/")
    return _reference_predicates(body, meta, agent_source=agent)


def inspect_source_roles(document):
    """Assess the current canonical Document model; raw bytes are not authority."""
    return _inspect_source_roles(document)


def _inspect_source_roles_source(raw, *, filename=None):
    """Private fresh-source operation: decoded lexical JSON order is authoritative."""
    from uwmd_reader import parse
    return _inspect_source_roles(parse(raw, filename=filename), _source_order=True)


def _inspect_source_roles(document, *, _source_order=False):
    """Inspect physical metadata/actors and active source/role vocabulary.

    The current parsed-value model is authoritative; source spans identify its
    origins, not a certificate that mutable values still equal original bytes.
    History is actor/shape-checked but its roles/sources are not reclassified.
    This bounded wrapper remains separate from complete ValidationResult.
    """
    snapshot = copy.deepcopy(document)
    result = dict(scope="physical_metadata_and_active_source_provenance_and_roles", ok=True, issues=[],
                  shape_findings=[], blocks=[], history_blocks_skipped=0, blocks_checked=0)
    # RFC0090 actor admission: complete the existing metadata-shape pass
    # before actor admission, then retain active ROLE/SRC ordering below.
    eligible = []
    references = metadata_blocks(snapshot)
    model_references = {id(block) for block in snapshot.source.blocks}
    seen_metadata = set()
    for index, block in enumerate(references):
        if id(block) in seen_metadata:
            continue
        seen_metadata.add(id(block))
        body = block.parsed.value
        context = source_context(snapshot, index, block)
        routing = _metadata_routing(body)
        if routing:
            result["issues"].append(dict(code="META-01", severity="error", section=block.section,
                field="_meta", message=" ".join(routing), context=context))
        elif "_meta" in body:
            eligible.append((block, context))
    # RFC0093 is a separate complete pass. Placement/section do not reject
    # admitted actors or flags; missing quality suppresses only its child flag.
    checked_shapes = set()
    for block, context in eligible:
        if id(block) in checked_shapes:
            continue
        checked_shapes.add(id(block))
        for field, message in _metadata_shape_predicates(
                block.parsed.value, block.section,
                _source_order=_source_order and authored_source_reference(snapshot, block)):
            result["issues"].append(dict(code="META-01", severity="error",
                section=block.section, field=field, message=message,
                context=copy.deepcopy(context)))
    for block, context in eligible:
        actor = block.parsed.value["_meta"]["provenance"].get("actor")
        if not isinstance(actor, str) or actor == "":
            result["issues"].append(dict(code="META-01", severity="error", section=block.section,
                field="_meta.provenance.actor",
                message="Block _meta.provenance.actor must be a nonempty string.",
                remediation="State the actual author in _meta.provenance.actor as a nonempty string; do not infer an actor.",
                context=copy.deepcopy(context)))
    # Accepted RFC0091: all admitted physical references,
    # after every actor and before active role/source checks. Canonical JSON
    # flags are never inferred from fence attributes or projected routing.
    checked_flags = set()
    for block, context in eligible:
        if id(block) in checked_flags:
            continue
        checked_flags.add(id(block))
        meta = block.parsed.value["_meta"]
        for code, group, field in (("META-02", "quality", "human_review_required"),
                                   ("META-03", "lifecycle", "superseded")):
            parent = meta.get(group)
            if isinstance(parent, dict) and not isinstance(parent.get(field), bool):
                path = "_meta." + group + "." + field
                result["issues"].append(dict(code=code, severity="error", section=block.section,
                    field=path, message="Block " + path + " must be a boolean.",
                    remediation="State " + path + " explicitly as true or false; do not infer a flag.",
                    context=copy.deepcopy(context)))
    # RFC0094 is a distinct complete pass after every required boolean.
    # Existing shape-only/actor/flag errors do not suppress independent leaves.
    for block, context in eligible:
        for field, message in _metadata_leaf_predicates(block.parsed.value):
            result["issues"].append(dict(code="META-04", severity="error", section=block.section,
                field=field, message=message,
                remediation="State the actual " + field + " using its admitted value; do not infer or repair it.",
                context=copy.deepcopy(context)))
    # RFC0095 complete optional and reference passes precede old role/SRC.
    # Sibling overrides remain assessable even beneath rejected metadata.
    for code, predicate in (("META-05", _metadata_optional_predicates),
                            ("META-06", _metadata_reference_predicates)):
        checked = set()
        for index, block in enumerate(references):
            if id(block) in checked:
                continue
            checked.add(id(block))
            for field, message in predicate(block.parsed.value):
                result["issues"].append(dict(code=code, severity="error", section=block.section,
                    field=field, message=message,
                    context=source_context(snapshot, index, block)))
    for index, block in enumerate(references):
        if source_superseded(block):
            result["history_blocks_skipped"] += 1
            continue
        result["blocks_checked"] += 1
        body = block.parsed.value
        context = source_context(snapshot, index, block)
        evidence = dict(section=block.section, **context)
        result["blocks"].append(evidence)
        def issue(code, field, message):
            result["issues"].append(dict(code=code, severity="error", section=block.section,
                field=field, message=message, context=copy.deepcopy(context)))
        def shape(field, message):
            # Local completeness assessment retains the current financial view;
            # original consumed rows still receive every registered predicate.
            if id(block) not in model_references:
                return
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
        meta = body.get("_meta")
        if "_meta" not in body:
            shape("_meta", "Metadata is absent; provenance completeness is outside this partial command.")
        if isinstance(meta, dict):
            # Retain exact local evidence for the integrated owner's
            # same-predicate consumption. Absent section keeps completeness.
            for field, message in _metadata_shape_predicates(
                    body, block.section,
                    _source_order=_source_order and authored_source_reference(snapshot, block)):
                shape(field, message)
            if "section" not in meta:
                shape("_meta.section", "_meta.section must match the exact fence section.")
            provenance = meta.get("provenance")
            if isinstance(provenance, dict):
                vocabulary(provenance, "_meta.provenance")
                for field in ("source", "resolution"):
                    if field in provenance:
                        evidence[field] = copy.deepcopy(provenance[field])
                for field in ("source", "timestamp"):
                    if field not in provenance:
                        shape("_meta.provenance." + field, "Required provenance member is absent.")
                    elif not isinstance(provenance[field], str):
                        shape("_meta.provenance." + field, "A string is required.")
                if (source_code(provenance.get("source")) is None
                        and provenance["source"].startswith("agent/") and "agent_id" not in provenance):
                    shape("_meta.provenance.agent_id", "Agent sources require the agent_id member; null remains admitted.")
                for field in ("agent_id", "agent_version", "notes"):
                    if field in provenance and provenance[field] is not None and not isinstance(provenance[field], str):
                        shape("_meta.provenance." + field, "A string or null is required.")
            quality = meta.get("quality")
            if isinstance(quality, dict):
                if quality.get("confidence") not in CONFIDENCE:
                    shape("_meta.quality.confidence", "An admitted confidence is required.")
                for field in ("human_review_required", "partial", "provisional"):
                    if (field == "human_review_required" or field in quality) and not isinstance(quality.get(field), bool):
                        shape("_meta.quality." + field, "A boolean is required.")
                if "flags" in quality:
                    if not isinstance(quality["flags"], list):
                        shape("_meta.quality.flags", "An array of strings is required.")
                    else:
                        for flag_index, flag in enumerate(quality["flags"]):
                            if not isinstance(flag, str):
                                shape("_meta.quality.flags[" + str(flag_index) + "]", "A string flag is required.")
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
