"""Local metadata assessment and accepted incomplete-data policy selection.

Schema conditions do not allocate ordinary-validator diagnostics. Preserve
unallocated metadata findings without inventing codes, severity or new states.
Existing SRC/ROLE/META-01 and five completeness paths stay with their owners.
"""
import copy
import re

from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date, _ordinal
from uwmd_source_validation import _metadata_routing, _metadata_shape_predicates
from uwmd_reader import APPEND
from uwmd_validation_selection import current_blocks

_TIMESTAMP = re.compile(r"([0-9]{4}-[0-9]{2}-[0-9]{2})[Tt]([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?([Zz]|[+-][0-9]{2}:[0-9]{2})\Z")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
# Published incomplete-data declarations, including non-halt entries because
# their specificity can defeat a broader adopter halt. Actions are never run.
_DEFAULTS = (
    ("rent_roll",None,"scope","substitute","asset_class_default"),
    ("rent_roll",None,"screening","degrade",None),
    ("rent_roll",None,"full_underwrite","halt",None),
    ("noi_model","expense_ratio","scope","substitute","asset_class_default"),
    ("noi_model",None,"scope","substitute","asset_class_default"),
    ("noi_model",None,"screening","degrade",None),
    ("noi_model",None,"full_underwrite","halt",None),
    ("debt_structure",None,"scope","substitute","asset_class_default"),
    ("debt_structure",None,"screening","substitute","investor_profile"),
    ("debt_structure",None,"term_sheet","halt",None),
    ("valuation",None,"scope","substitute","asset_class_default"),
    ("valuation",None,"full_underwrite","halt",None),
    ("borrower_sponsor",None,"screening","defer",None),
    ("borrower_sponsor",None,"credit_approval","halt",None),
    ("compliance",None,"closing","halt",None),
)


def timestamp_shape(value):
    """Normative block schema date-time: RFC3339 5.6/5.7, not host parsing.

    Accept structural UTC month-end leap slots, including shifted local offsets;
    no IERS bulletin fetch or assertion that the recorded event actually occurred.
    https://www.rfc-editor.org/rfc/rfc3339.html#section-5.6
    """
    if not isinstance(value, str):
        return False
    match = _TIMESTAMP.fullmatch(value)
    if match is None or not calendar_date(match[1]):
        return False
    hour, minute, second = (int(match[i]) for i in (2,3,4))
    if hour > 23 or minute > 59 or second > 60:
        return False
    zone = match[5]
    offset = 0
    if zone not in ("Z","z"):
        hh, mm = int(zone[1:3]), int(zone[4:6])
        if hh > 23 or mm > 59:
            return False
        offset = (hh * 60 + mm) * (1 if zone[0] == "+" else -1)
    if second < 60:
        return True
    year, month, day = map(int, match[1].split("-"))
    utc_minute = _ordinal((year,month,day)) * 1440 + hour * 60 + minute - offset
    utc_day, minutes = divmod(utc_minute,1440)
    if minutes != 1439:
        return False
    return any(utc_day == _ordinal((y + (m == 12), 1 if m == 12 else m+1, 1))-1
               for y in (year-1,year,year+1) for m in range(1,13))


def market_data_accepted(body):
    """RFC0022 promotion includes a stated block or leaf resolution tag."""
    meta = body.get("_meta")
    provenance = meta.get("provenance") if isinstance(meta, dict) else None
    overrides = body.get("_overrides")
    return (isinstance(provenance, dict) and provenance.get("resolution") == "market_data_accepted"
            or isinstance(overrides, list) and any(isinstance(entry, dict)
                and entry.get("resolution") == "market_data_accepted" for entry in overrides))


def missing_market_reference(body):
    """Published DQ-06 presence test; object/array shape is assessed separately.

    Empty objects/arrays are present JSON values, unlike null, false, zero or
    the exact empty string. Never apply Python container truthiness here.
    """
    meta = body.get("_meta")
    provenance = meta.get("provenance") if isinstance(meta, dict) else None
    reference = provenance.get("market_data_ref") if isinstance(provenance, dict) else None
    return (reference is None or reference is False or reference == ""
            or finite(reference) and reference == 0)


def metadata_assessment(document, source_inventory, *, missing_meta_blocks=(),
                        missing_field_owners=(), missing_market_reference_owners=(),
                        _source_order=False):
    """LOCAL sibling, not ValidationResult findings or full schema validation.

    Retain unallocated selected-shape inventory evidence plus bounded timestamp/
    reference checks. RFC0090 actor findings already belong to registered
    inventory issues, never duplicate local evidence or broader META-01 routing.
    Empty local findings alone do not prove full metadata/schema conformance.
    """
    # Consume only helper evidence already represented by the completeness
    # warning for this exact physical input. The same field path on a present
    # (for example late) _meta is still an unallocated requirement.
    covered_absence = {index for index in missing_meta_blocks
                       if isinstance(index, int) and not isinstance(index, bool)
                       and 0 <= index < len(document.source.blocks)
                       and "_meta" not in document.source.blocks[index].parsed.value}
    findings = copy.deepcopy([
        finding for finding in source_inventory["shape_findings"]
        if not (finding.get("field") == "_meta"
                and finding.get("context", {}).get("block_index") in covered_absence)])
    active = {entry["block_index"] for entry in source_inventory["blocks"]}
    for index, block in enumerate(document.source.blocks):
        if index not in active:
            continue
        meta = block.parsed.value.get("_meta")
        provenance = meta.get("provenance") if isinstance(meta, dict) else None
        if not isinstance(provenance, dict):
            continue

        def malformed(path, message):
            findings.append(dict(section=block.section,
                field="_meta.provenance." + path, message=message,
                context=dict(block_index=index, variant=dict(block.attributes).get("variant"),
                             body_byte_start=block.body_span.start,
                             body_byte_end=block.body_span.end)))

        if isinstance(provenance.get("timestamp"), str) and not timestamp_shape(provenance["timestamp"]):
            malformed("timestamp", "Timestamp must have the admitted calendar/date-time shape")
        for resolution, key, names in (
                ("market_data_accepted", "market_data_ref", ("document_id", "as_of", "digest")),
                ("inherited_assumption", "inherited_from", ("document_id", "digest", "distance"))):
            required = (market_data_accepted(block.parsed.value) if key == "market_data_ref"
                        else provenance.get("resolution") == resolution)
            if key not in provenance and not required:
                continue
            reference = provenance.get(key)
            valid = isinstance(reference, dict)
            if valid:
                for name in names:
                    value = reference.get(name)
                    if name == "distance":
                        valid = valid and finite(value) and value >= 1 and int(value) == value
                    else:
                        valid = valid and isinstance(value, str)
                valid = (valid and isinstance(reference.get("digest"), str)
                         and _DIGEST.fullmatch(reference["digest"]) is not None)
            if not valid:
                malformed(key, "Conditional provenance reference must satisfy its required shape")
            if (key == "market_data_ref" and isinstance(reference, dict)
                    and "rationale" in reference and not isinstance(reference["rationale"], str)):
                malformed(key + ".rationale", "A stated market-data rationale must be a string")
    # RFC0081/0090 reject these containers before descendant admission. Actor-
    # only META-01 and otherwise-shaped late/mismatched metadata do not qualify.
    # Preserve the original local evidence separately instead of reallocating it
    # to META-01 or discarding independent leaf-annotation requirements.
    rejected_containers = {
        issue["context"]["block_index"] for issue in source_inventory["issues"]
        if issue["code"] == "META-01" and issue.get("field") == "_meta"
        and _metadata_routing(document.source.blocks[issue["context"]["block_index"]].parsed.value)}
    # RFC0093 owns only its exact current predicate on this physical input.
    # A META-01 actor/other block/container or stale model cannot consume it.
    shape_owners = set()
    for issue in source_inventory["issues"]:
        if issue.get("code") != "META-01" or issue.get("severity") != "error":
            continue
        index = issue.get("context", {}).get("block_index")
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(document.source.blocks)):
            continue
        block = document.source.blocks[index]
        if issue.get("section") != block.section:
            continue
        fields = {path for path, _ in _metadata_shape_predicates(
            block.parsed.value, block.section, _source_order=_source_order)}
        if issue.get("field") in fields:
            shape_owners.add((index, issue["field"]))
    flag_owners = {}
    for issue in source_inventory["issues"]:
        target = {"META-02": ("quality", "human_review_required"),
                  "META-03": ("lifecycle", "superseded")}.get(issue["code"])
        if target is None or issue.get("severity") != "error":
            continue
        index = issue.get("context", {}).get("block_index")
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(document.source.blocks)):
            continue
        group, name = target
        field = "_meta." + group + "." + name
        body = document.source.blocks[index].parsed.value
        meta = body.get("_meta")
        parent = meta.get(group) if isinstance(meta, dict) else None
        if (issue.get("field") == field and not _metadata_routing(body)
                and isinstance(parent, dict) and not isinstance(parent.get(name), bool)):
            flag_owners[index, field] = issue["code"]
    # Format 2.6 already assigns every authored nonstring source to SRC-01.
    # Consume only the identical local string-type condition; a source error
    # cannot stand in for another provenance field, parent or leaf annotation.
    typed_source_owners = set()
    for issue in source_inventory["issues"]:
        if (issue.get("code") != "SRC-01" or issue.get("severity") != "error"
                or issue.get("field") != "_meta.provenance.source"):
            continue
        index = issue.get("context", {}).get("block_index")
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(document.source.blocks)):
            continue
        block = document.source.blocks[index]
        body = block.parsed.value
        if not isinstance(body, dict):
            continue  # Ownership proof cannot admit a nonobject mutable payload.
        meta = body.get("_meta")
        parent = meta.get("provenance") if isinstance(meta, dict) else None
        if (issue.get("section") == block.section and not _metadata_routing(body)
                and isinstance(parent, dict) and "source" in parent
                and not isinstance(parent["source"], str)):
            typed_source_owners.add((index, "_meta.provenance.source"))
    # Protocol III.6a owns these exact absent leaves with completeness warnings.
    # Ownership is supplied only when basic_rules actually emitted that warning
    # for this physical block. A null leaf or missing/nonobject parent is not the
    # same condition; neither can consume a local typed/container requirement.
    completeness_paths = {
        "_meta.section": "META_FIELD_MISSING_SECTION",
        "_meta.lifecycle.revision": "META_FIELD_MISSING_VERSION",
        "_meta.provenance.source": "META_FIELD_MISSING_SOURCE",
        "_meta.provenance.timestamp": "META_FIELD_MISSING_TIMESTAMP",
        "_meta.quality.confidence": "META_FIELD_MISSING_CONFIDENCE",
    }
    absent_owners = {}
    for index, path, code in missing_field_owners:
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(document.source.blocks)
                or completeness_paths.get(path) != code):
            continue
        parent = document.source.blocks[index].parsed.value
        names = path.split(".")
        for name in names[:-1]:
            parent = parent.get(name) if isinstance(parent, dict) else None
        if isinstance(parent, dict) and names[-1] not in parent:
            absent_owners[index, path] = code
    # RFC0022 already assigns the missing promoted-reference obligation to
    # DQ-06/error. Only actual emitted owners for an absent member qualify.
    # Authored null/falsy scalars or malformed objects have independent type/
    # content requirements; this presence owner cannot consume those findings.
    market_absence_owners = set()
    for index, issue in missing_market_reference_owners:
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(document.source.blocks)):
            continue
        block = document.source.blocks[index]
        if (block.section in APPEND or block.section.startswith("x_")
                or not any(current is block for current in current_blocks(
                    document, block.section, include_external=True))):
            continue
        body = block.parsed.value
        meta = body.get("_meta") if isinstance(body, dict) else None
        parent = meta.get("provenance") if isinstance(meta, dict) else None
        if (issue.get("code") == "DQ-06" and issue.get("severity") == "error"
                and issue.get("field") == "_meta.provenance.market_data_ref"
                and issue.get("section") == block.section
                and isinstance(parent, dict) and "market_data_ref" not in parent
                and not _metadata_routing(body) and market_data_accepted(body)):
            market_absence_owners.add((index, "_meta.provenance.market_data_ref"))
    retained, handled = [], []
    for finding in findings:
        field = finding["field"]
        if (finding["context"]["block_index"] in rejected_containers
                and (field == "_meta" or field.startswith("_meta."))):
            handled.append(dict(**finding, registered_code="META-01",
                                disposition="blocked_by_registered_metadata_shape"))
        elif ((finding["context"]["block_index"], field) in shape_owners
                and finding["section"] == document.source.blocks[
                    finding["context"]["block_index"]].section):
            handled.append(dict(**finding, registered_code="META-01",
                disposition="represented_by_registered_metadata_shape"))
        elif ((finding["context"]["block_index"], field) in absent_owners
                and finding["section"] == document.source.blocks[
                    finding["context"]["block_index"]].section):
            handled.append(dict(**finding,
                registered_code=absent_owners[finding["context"]["block_index"], field],
                disposition="represented_by_registered_completeness_warning"))
        elif ((finding["context"]["block_index"], field) in typed_source_owners
                and finding["section"] == document.source.blocks[
                    finding["context"]["block_index"]].section):
            handled.append(dict(**finding, registered_code="SRC-01",
                disposition="represented_by_registered_source_type_error"))
        elif ((finding["context"]["block_index"], field) in market_absence_owners
                and finding["section"] == document.source.blocks[
                    finding["context"]["block_index"]].section):
            handled.append(dict(**finding, registered_code="DQ-06",
                disposition="represented_by_registered_missing_market_reference"))
        elif (finding["context"]["block_index"], field) in flag_owners:
            handled.append(dict(**finding,
                registered_code=flag_owners[finding["context"]["block_index"], field],
                disposition="represented_by_registered_metadata_flag"))
        else:
            retained.append(finding)
    result = dict(shape_findings=retained)
    if handled:
        result["handled_shape_findings"] = handled
    return result


def incomplete_policy(section, field_path, stage, policies=()):
    """Published specificity contract; no producer fallback action is executed.

    More specific field wins, then stage, then earlier declaration. Adopter
    declarations precede builtin defaults at equal specificity.
    """
    defaults = []
    for target,path,at,action,fallback in _DEFAULTS:
        policy = dict(section=target,stage=at,action={"kind":action})
        if path is not None:
            policy["field_path"] = path
        if fallback is not None:
            policy["action"]["fallback_source"] = fallback
        defaults.append(policy)
    best, rank = None, (-1,-1)
    for policy in (*policies,*defaults):
        if not isinstance(policy,dict) or policy.get("section") != section:
            continue
        if "field_path" in policy and policy["field_path"] != field_path:
            continue
        if "stage" in policy and policy["stage"] != stage:
            continue
        specificity = ("field_path" in policy, "stage" in policy)
        if specificity > rank:
            best, rank = policy, specificity
    return best
