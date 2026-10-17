"""Integrated Format 2.4-2.6 shape and incomplete-data policy obligations.

No new code names, provenance defaults, inference, mutation or integrity claim.
META-01 owns malformed present nested shape; exactly five absent fields keep
their separate completeness warnings in the orchestrator.
"""
import re

from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date, _ordinal

_COMPLETE = frozenset(("_meta.section", "_meta.lifecycle.revision",
    "_meta.provenance.source", "_meta.provenance.timestamp", "_meta.quality.confidence"))
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


def _present(body, path):
    value = body
    for key in path.split("."):
        if not isinstance(value, dict) or key not in value:
            return False, None
        value = value[key]
    return True, value


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


def metadata_shape(ledger, source_inventory):
    grouped = {}
    for finding in source_inventory["shape_findings"]:
        index, path = finding["context"]["block_index"], finding["field"]
        body = ledger.document.source.blocks[index].parsed.value
        exists = _present(body,path)[0]
        if "_meta" not in body or path in _COMPLETE and not exists:
            continue
        if path == "_meta.provenance.actor" and not exists:
            # Current frozen complete validate projections explicitly remain
            # clean without actor, despite the Format/schema required field.
            # No ACTOR completeness suffix is registered. Do not manufacture one
            # or relabel missing provenance as malformed present META-01.
            continue
        # Actor grammar/resolution errors are already owned by SRC-01/02/03.
        if path.endswith(".source") or path.endswith(".resolution"):
            continue
        grouped.setdefault(index,[]).append(dict(field=path,message=finding["message"]))
    active = {b["block_index"] for b in source_inventory["blocks"]}
    for index, block in enumerate(ledger.document.source.blocks):
        # Source inventory determines active physical admission; history is not
        # reclassified by new shape policies.
        if index not in active:
            continue
        meta = block.parsed.value.get("_meta")
        provenance = meta.get("provenance") if isinstance(meta,dict) else None
        if not isinstance(provenance,dict):
            continue
        def malformed(path, message):
            grouped.setdefault(index,[]).append(dict(field="_meta.provenance."+path,message=message))
        if isinstance(provenance.get("timestamp"),str) and not timestamp_shape(provenance["timestamp"]):
            malformed("timestamp","Timestamp must have the admitted calendar/date-time shape")
        for resolution, key, names in (
                ("market_data_accepted","market_data_ref",("document_id","as_of","digest")),
                ("inherited_assumption","inherited_from",("document_id","digest","distance"))):
            if key not in provenance and provenance.get("resolution") != resolution:
                continue
            reference = provenance.get(key)
            valid = isinstance(reference,dict)
            if valid:
                for name in names:
                    value = reference.get(name)
                    if name == "distance":
                        valid = valid and finite(value) and value >= 1 and int(value) == value
                    else:
                        valid = valid and isinstance(value,str)
                valid = valid and isinstance(reference.get("digest"),str) and _DIGEST.fullmatch(reference["digest"]) is not None
            if not valid:
                malformed(key,"Conditional provenance reference must satisfy its required shape")
    for index, findings in grouped.items():
        if not findings:
            continue
        existing = next((i for i in ledger.issues if i["code"]=="META-01"
                         and i.get("context",{}).get("block_index")==index),None)
        if existing is None:
            block = ledger.document.source.blocks[index]
            ledger.issue("META-01","error",block.section,findings[0]["field"],
                         "Present block metadata or leaf annotations violate the Format 3.0 shape",
                         value={"shape_findings":findings},
                         context={"block_index":index,"variant":dict(block.attributes).get("variant"),
                                  "body_byte_start":block.body_span.start,"body_byte_end":block.body_span.end})
        else:
            existing["value"] = {"shape_findings":findings}


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
