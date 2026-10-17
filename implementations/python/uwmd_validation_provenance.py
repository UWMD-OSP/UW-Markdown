"""Local metadata assessment and accepted incomplete-data policy selection.

Schema conditions do not allocate ordinary-validator diagnostics. Preserve
unallocated metadata findings without inventing codes, severity or new states.
Existing SRC/ROLE/META-01 and five completeness paths stay with their owners.
"""
import copy
import re

from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date, _ordinal

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


def metadata_assessment(document, source_inventory, *, missing_meta_blocks=()):
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
            if key not in provenance and provenance.get("resolution") != resolution:
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
    return dict(shape_findings=findings)


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
