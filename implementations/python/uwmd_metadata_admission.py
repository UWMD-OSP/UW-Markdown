"""Closed accepted RFC0095 predicates; no fetching, defaults or schema fallback."""
import math
import re

_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


def _date_only(value):
    # Independent ASCII arithmetic; unrelated calendar and T1B domains stay put.
    if not isinstance(value, str) or len(value) != 10 or value[4] != "-" or value[7] != "-":
        return False
    digits = []
    for position in (0, 1, 2, 3, 5, 6, 8, 9):
        digit = ord(value[position]) - 48
        if not 0 <= digit <= 9:
            return False
        digits.append(digit)
    year = digits[0]*1000 + digits[1]*100 + digits[2]*10 + digits[3]
    month, day = digits[4]*10 + digits[5], digits[6]*10 + digits[7]
    if not 1 <= year <= 9999 or not 1 <= month <= 12:
        return False
    leap = year % 400 == 0 or year % 4 == 0 and year % 100 != 0
    days = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    return 1 <= day <= days[month-1]


def _positive_integer(value):
    try:
        return (not isinstance(value, bool) and isinstance(value, (int, float))
                and math.isfinite(value) and value >= 1 and int(value) == value)
    except OverflowError:
        return False


def _optional_predicates(body, meta):
    """meta is the admitted canonical parent or None; overrides are siblings."""
    failed = []
    if meta is not None:
        provenance = meta["provenance"]
        for name in ("agent_id", "agent_version", "notes"):
            if name in provenance and provenance[name] is not None and not isinstance(provenance[name], str):
                failed.append(("_meta.provenance." + name, "A string or null is required."))
        quality = meta.get("quality")
        if isinstance(quality, dict):
            if "flags" in quality:
                flags = quality["flags"]
                if not isinstance(flags, list):
                    failed.append(("_meta.quality.flags", "An array of strings is required."))
                else:
                    for index, flag in enumerate(flags):
                        if not isinstance(flag, str):
                            failed.append(("_meta.quality.flags[" + str(index) + "]", "A string flag is required."))
            for name in ("partial", "provisional"):
                if name in quality and not isinstance(quality[name], bool):
                    failed.append(("_meta.quality." + name, "A boolean is required."))
            if "field_overrides" in quality:
                failed.append(("_meta.quality.field_overrides", "Per-field annotations belong only in top-level _overrides."))
    if "_overrides" in body:
        overrides = body["_overrides"]
        if not isinstance(overrides, list):
            failed.append(("_overrides", "An array of field-annotation objects is required."))
        else:
            for index, entry in enumerate(overrides):
                root = "_overrides[" + str(index) + "]"
                if not isinstance(entry, dict):
                    failed.append((root, "A field-annotation object is required."))
                    continue
                if "path" not in entry or not isinstance(entry["path"], str):
                    failed.append((root + ".path", "A string path is required; no target lookup or new path grammar is applied."))
                for name, values in (("confidence", ("high", "medium", "low")),
                                     ("reason", ("illegible", "missing", "overridden", "estimated", "computed"))):
                    if name in entry and entry[name] not in values:
                        failed.append((root + "." + name, "Value is outside the admitted annotation vocabulary."))
                if "note" in entry and not isinstance(entry["note"], str):
                    failed.append((root + ".note", "A string note is required."))
    return failed


def _reference_predicates(body, meta, *, agent_source=False):
    failed = []
    provenance = meta["provenance"]
    if agent_source and "agent_id" not in provenance:
        failed.append(("_meta.provenance.agent_id", "Agent sources require the agent_id member; null remains admitted."))
    assertions = [provenance["resolution"]] if "resolution" in provenance else []
    overrides = body.get("_overrides")
    if isinstance(overrides, list):
        assertions.extend(entry["resolution"] for entry in overrides
                          if isinstance(entry, dict) and "resolution" in entry)
    for key, tag, children in (
            ("inherited_from", "inherited_assumption", ("document_id", "digest", "distance")),
            ("market_data_ref", "market_data_accepted", ("document_id", "as_of", "digest", "rationale"))):
        root = "_meta.provenance." + key
        if key not in provenance:
            if any(isinstance(assertion, str) and assertion == tag for assertion in assertions):
                failed.append((root, "A stated resolution assertion requires this reference carrier."))
            continue
        reference = provenance[key]
        if not isinstance(reference, dict):
            failed.append((root, "A non-null provenance-reference object is required."))
            continue
        for name in children:
            if name == "rationale" and name not in reference:
                continue
            value = reference.get(name)
            valid = (isinstance(value, str) if name in ("document_id", "rationale") else
                     isinstance(value, str) and _DIGEST.fullmatch(value) is not None if name == "digest" else
                     _date_only(value) if name == "as_of" else _positive_integer(value))
            if name not in reference or not valid:
                failed.append((root + "." + name, "A required reference child must satisfy its exact admitted domain."))
    return failed
