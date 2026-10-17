"""Independent Format 2.7/2.8 and 5.3 current-source selection for validation.

Selection does not infer roles or aggregate peers. The retained Reader projection
is deliberately not used: source identity/lifecycle are checked before reduction.
"""
from dataclasses import dataclass

from uwmd_reader import PARALLEL
from uwmd_source_lifecycle import source_superseded
from uwmd_source_validation import BLOCK_ROLES


class ValidationUnavailable(ValueError):
    """Local unsupported source boundary, not a registered validation issue."""


@dataclass(frozen=True)
class Selection:
    block: object = None
    reason: str | None = None
    detail: str = ""
    evidence: dict | None = None
    externalized: bool = False


def active_blocks(document, section=None):
    return tuple(b for b in document.source.blocks
                 if (section is None or b.section == section) and not source_superseded(b))


def is_externalized(block):
    """The accepted Composition 3 marker, not an arbitrary payload key."""
    return dict(block.attributes).get("external") == "true"


def current_blocks(document, section, *, include_external=False):
    blocks = active_blocks(document, section)
    parallel = section in PARALLEL or (
        any("_role" in b.parsed.value for b in blocks)
        and any("variant" in dict(b.attributes) for b in blocks))
    if not parallel:
        blocks = blocks[-1:]
        return blocks if include_external else tuple(b for b in blocks if not is_externalized(b))
    current = {}
    for block in blocks:
        current[dict(block.attributes).get("variant")] = block
    return tuple(b for b in current.values() if include_external or not is_externalized(b))


def select_section(document, section, *, preferred_key=None, preferred_role=None,
                   lease_up_base=False):
    blocks = current_blocks(document, section, include_external=True)
    if not blocks:
        return Selection(reason="section_absent", detail=section + " is absent")
    role_bearing = any("_role" in b.parsed.value for b in blocks)
    parallel = section in PARALLEL or (role_bearing and
        any("variant" in dict(b.attributes) for b in blocks))
    def eligible(block):
        body = block.parsed.value
        return "_role" not in body or body["_role"] in BLOCK_ROLES[:-1]
    def found(block, via):
        evidence = {"via": via}
        if "variant" in dict(block.attributes):
            evidence["variant"] = dict(block.attributes)["variant"]
        if is_externalized(block):
            return Selection(reason="field_absent", detail=section + " is externalized and unresolved",
                             evidence=evidence if role_bearing else None, externalized=True)
        return Selection(block=block, evidence=evidence if role_bearing else None)
    def refused(detail, reason="variant_unresolvable"):
        return Selection(reason=reason, detail=section + ": " + detail)
    if not parallel:
        return found(blocks[0], "single") if eligible(blocks[0]) else refused("no eligible property statement")
    by_identity = {dict(b.attributes).get("variant"): b for b in blocks}
    if None in by_identity and "default" in by_identity:
        # The existing source/portable default-key representation does not settle
        # this collision. Do not silently choose a peer or invent a new mapping.
        raise ValidationUnavailable(section + ": unlabelled/literal-default source identity requires the projection decision")
    available = {("default" if k is None else k): b
                 for k, b in by_identity.items() if eligible(b)}
    if lease_up_base:
        for key in ("base", "default"):
            if key in available:
                return found(available[key], key)
        if len(available) == 1:
            return found(next(iter(available.values())), "sole")
        return refused("no base/default/sole lease-up scenario", "not_applicable")
    if preferred_key in available:
        return found(available[preferred_key], "preference")
    for role in (preferred_role, "primary"):
        if role is None:
            continue
        matches = [b for b in available.values() if b.parsed.value.get("_role") == role]
        if len(matches) > 1:
            return refused("consulted role " + role + " has multiple claimants")
        if matches:
            return found(matches[0], "role" if role == preferred_role else "primary")
    for key in ("default", "base"):
        if key in available:
            return found(available[key], key)
    if len(available) == 1:
        return found(next(iter(available.values())), "sole")
    return refused("no unique eligible variant")


def field(payload, path):
    """Read own JSON object members only; missing/null never becomes zero."""
    value = payload
    for key in path.split("."):
        if key in ("constructor", "prototype", "__proto__") or not isinstance(value, dict):
            return None
        value = value.get(key)
    return value
