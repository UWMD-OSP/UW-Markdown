"""Integrated Format 4.25 family: allocated LU rules and local payload shape.

No trajectory, aggregate, occupancy or financial model is reproduced. A schema
condition without an allocated LU diagnostic remains uncoded local evidence.
Universal metadata, roles, leaf annotations and notes retain their own owners.
"""
import re

from uwmd_binding_sources import finite, calendar_period
from uwmd_source_lifecycle import source_superseded
from uwmd_payload_admission import _PayloadView,_payload_admission
from uwmd_validation_selection import active_blocks, current_blocks, is_externalized

_PERIOD = re.compile(r"[0-9]{4}-(?:Q[1-4]|0[1-9]|1[0-2])\Z")
_UNIVERSAL = frozenset(("_meta", "_role", "_overrides", "_notes"))
_TOP = frozenset(("model_type", "period_granularity", "schedule",
                  "stabilization_target", "assumptions", "stabilized_summary"))
_ROW = {
    "occupied_sf": (0, None), "leased_sf": (0, None),
    "in_place_rent_psf": (0, None), "market_rent_psf": (0, None),
    "vacancy_rate": (0, 1), "rent_revenue": (None, None),
    "concessions": (None, None), "ti_lc_capex": (None, None),
    "net_cash_flow": (None, None),
}
_ASSUMPTIONS = {
    "monthly_turnover_rate": (0, 1), "market_rent_psf_at_stabilization": (0, None),
    "vacancy_during_lease_up": (0, 1), "concession_months_per_lease": (0, None),
    "tenant_improvement_psf": (0, None), "leasing_commission_rate": (0, 1),
}
_SUMMARY = {
    "occupied_sf": (0, None), "occupancy_rate": (0, 1),
    "annualized_egi": (None, None), "annualized_noi": (None, None),
}


def _payload_shape(payload):
    """Explicit accepted new predicates plus the original LU01/03 owners."""
    findings=[dict(field=issue["field"],message=issue["message"],_owner_predicate="LU-05")
              for issue in _payload_admission([_PayloadView("lease_up_schedule",payload)])]
    cadence=payload.get("period_granularity")
    if cadence not in ("monthly","quarterly"):
        findings.append(dict(field="period_granularity",message="Cadence is missing or invalid",_owner_predicate="cadence"))
    rows=payload.get("schedule")
    if not isinstance(rows,list) or not rows:
        findings.append(dict(field="schedule",message="A nonempty schedule is required",_owner_predicate="schedule"))
    if isinstance(rows,list):
        for index,row in enumerate(rows):
            path="schedule["+str(index)+"]"
            if not isinstance(row,dict):
                findings.append(dict(field=path,message="A row object with its required period is needed",_owner_predicate="row_period"))
            elif calendar_period(row.get("period"),cadence) is None:
                findings.append(dict(field=path+".period",message="Period is missing or invalid for the current cadence",_owner_predicate="period"))
    return findings


def lease_up_rules(ledger):
    document = ledger.document
    physical = {id(block): index for index, block in enumerate(document.source.blocks)}
    for block in current_blocks(document, "lease_up_schedule"):
        payload = block.parsed.value
        def issue(code, path, message, severity="error"):
            ledger.issue(code, severity, "lease_up_schedule", path, message,
                         context=dict(block_index=physical[id(block)],
                                      variant=dict(block.attributes).get("variant")))
        cadence, rows = payload.get("period_granularity"), payload.get("schedule")
        first, previous = None, None
        if cadence not in ("monthly", "quarterly"):
            issue("LU-01", "period_granularity", "Schedule cadence is invalid")
        if not isinstance(rows, list) or not rows:
            issue("LU-03", "schedule", "A nonempty schedule is required")
        else:
            for index, row in enumerate(rows):
                identity = calendar_period(row.get("period"), cadence) if isinstance(row, dict) else None
                path = "schedule[" + str(index) + "].period"
                if identity is None:
                    issue("LU-01", path, "Period does not match the declared cadence")
                    continue
                if first is None:
                    first = identity
                if previous is not None and identity != previous + 1:
                    issue("LU-02", path, "Periods must be strictly increasing and gap-free")
                previous = identity
        target = payload.get("stabilization_target")
        if target is not None:
            identity = calendar_period(target, cadence)
            if identity is not None and first is not None and identity < first:
                issue("LU-03", "stabilization_target", "Target precedes the schedule")
        if payload.get("model_type") == "natural_turnover" and not active_blocks(document, "rent_roll"):
            issue("LU-04", "model_type", "Turnover has no stated rent roll", "warning")
    return _lease_up_assessment(document, ledger.issues)


def _shape_owner(payload, path, predicate):
    """Recheck only the already allocated grammar/nonempty predicates."""
    cadence = payload.get("period_granularity")
    if predicate == "LU-05":
        return "LU-05" if any(issue["field"]==path for issue in _payload_admission(
            [_PayloadView("lease_up_schedule",payload)])) else None
    if predicate == "row_period":
        match=re.fullmatch(r"schedule\[(0|[1-9][0-9]*)\]",path)
        rows=payload.get("schedule")
        if match and isinstance(rows,list) and int(match[1])<len(rows) and not isinstance(rows[int(match[1])],dict):
            return "LU-01"
        return None
    if predicate == "cadence" and path == "period_granularity":
        return "LU-01" if cadence not in ("monthly", "quarterly") else None
    if predicate == "schedule" and path == "schedule":
        rows = payload.get("schedule")
        return "LU-03" if not isinstance(rows, list) or not rows else None
    if predicate != "period":
        return None
    match = re.fullmatch(r"schedule\[(0|[1-9][0-9]*)\]\.period", path)
    rows = payload.get("schedule")
    if not match or not isinstance(rows, list) or int(match[1]) >= len(rows):
        return None
    row = rows[int(match[1])]
    if isinstance(row, dict) and calendar_period(row.get("period"), cadence) is None:
        return "LU-01"
    return None


def _lease_up_assessment(document, issues):
    """Retain local evidence; consume only same-source actual LU-01/LU-03."""
    current = {id(block) for block in current_blocks(document, "lease_up_schedule", include_external=True)}
    result = dict(shape_findings=[], blocks_checked=[], external_blocks_skipped=[])
    for index, block in enumerate(document.source.blocks):
        if block.section != "lease_up_schedule":
            continue
        context = dict(block_index=index, variant=dict(block.attributes).get("variant"),
                       body_byte_start=block.body_span.start, body_byte_end=block.body_span.end,
                       superseded=source_superseded(block), current=id(block) in current)
        evidence = dict(section=block.section, **context)
        if is_externalized(block):
            result["external_blocks_skipped"].append(evidence)
            continue
        result["blocks_checked"].append(evidence)
        for finding in _payload_shape(block.parsed.value):
            predicate = finding.pop("_owner_predicate", None)
            code = _shape_owner(block.parsed.value, finding["field"], predicate)
            owner_field=finding["field"]+".period" if predicate=="row_period" else finding["field"]
            owner = context["current"] and code and any(
                issue.get("code") == code and issue.get("severity") == "error"
                and issue.get("section") == block.section
                and issue.get("field") == owner_field
                and type(issue.get("context", {}).get("block_index")) is int
                and issue["context"]["block_index"] == index for issue in issues)
            evidence = dict(section=block.section, **finding, context=dict(context))
            if not context["current"]:
                # Retain private history/overwritten evidence without widening
                # ordinary payload validation beyond current canonical variants.
                result.setdefault("inactive_shape_findings", []).append(evidence)
            elif owner:
                result.setdefault("handled_shape_findings", []).append(dict(
                    **evidence, registered_code=code,
                    disposition="represented_by_registered_lease_up_finding"))
            else:
                result["shape_findings"].append(evidence)
    return result
