"""Local metadata assessment and accepted incomplete-data policy selection.

Schema conditions do not allocate ordinary-validator diagnostics. Preserve
unallocated metadata findings without inventing codes, severity or new states.
Existing SRC/ROLE/META-01 and five completeness paths stay with their owners.
"""
import copy

from uwmd_binding_sources import finite
from uwmd_source_validation import (_metadata_routing, _metadata_shape_predicates,
    _metadata_leaf_predicates, _timestamp_t1b, _metadata_optional_predicates,
    _metadata_reference_predicates)
from uwmd_reader import APPEND
from uwmd_validation_selection import current_blocks

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
    """Accepted RFC0094 T1B, shared with source admission; no alternate parser."""
    return _timestamp_t1b(value)


def metadata_assessment(document, source_inventory, *, missing_meta_blocks=(),
                        missing_field_owners=(),
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
        for path, message in _metadata_reference_predicates(block.parsed.value):
            if path != "_meta.provenance.agent_id":  # Existing inventory owns this exact presence evidence.
                malformed(path.removeprefix("_meta.provenance."), message)
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
    # RFC0094 owns only its three present-invalid predicates. Actual emitted
    # same-reference errors cannot consume an absent/other/current-valid leaf.
    leaf_owners = set()
    for issue in source_inventory["issues"]:
        if issue.get("code") != "META-04" or issue.get("severity") != "error":
            continue
        index = issue.get("context", {}).get("block_index")
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(document.source.blocks)):
            continue
        block = document.source.blocks[index]
        if issue.get("section") != block.section or not isinstance(block.parsed.value, dict):
            continue
        fields = {path for path, _ in _metadata_leaf_predicates(block.parsed.value)}
        if issue.get("field") in fields:
            leaf_owners.add((index, issue["field"]))
    # Local evidence is private and open-ended: the same path alone must not
    # stand in for an unrelated conditional/temporal/annotation requirement.
    leaf_requirements = {
        "_meta.quality.confidence": {"An admitted confidence is required."},
        "_meta.lifecycle.revision": {"A positive JSON integer is required; no sequence order is inferred."},
        "_meta.provenance.timestamp": {"A string is required.",
            "Timestamp must have the admitted calendar/date-time shape"},
    }
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
    # RFC0095 consumes only the same current closed predicate, physical
    # reference, canonical field and local requirement. No generic META owner.
    allocated_owners = {}
    for issue in source_inventory["issues"]:
        code = issue.get("code")
        if code not in ("META-05", "META-06") or issue.get("severity") != "error":
            continue
        index = issue.get("context", {}).get("block_index")
        if type(index) is not int or not 0 <= index < len(document.source.blocks):
            continue
        block = document.source.blocks[index]
        if issue.get("section") != block.section:
            continue
        predicate = _metadata_optional_predicates if code == "META-05" else _metadata_reference_predicates
        for field, message in predicate(block.parsed.value):
            if issue.get("field") == field:
                allocated_owners[index, field, message] = code
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
        elif (finding["context"]["block_index"], field, finding.get("message")) in allocated_owners:
            handled.append(dict(**finding, registered_code=allocated_owners[
                finding["context"]["block_index"], field, finding["message"]],
                disposition="represented_by_registered_optional_metadata_predicate"))
        elif ((finding["context"]["block_index"], field) in leaf_owners
                and finding["section"] == document.source.blocks[
                    finding["context"]["block_index"]].section
                and finding.get("message") in leaf_requirements.get(field, ())):
            handled.append(dict(**finding, registered_code="META-04",
                disposition="represented_by_registered_present_invalid_metadata_leaf"))
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
