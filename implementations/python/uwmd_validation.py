"""Developing structural-validation API; the complete capability remains gated.

This module composes one ValidationResult and the separate Protocol V.12 union.
It is not a claimed complete validator while remaining owning families are
being implemented. It never writes source or recomputes financial models.
"""
import copy

from uwmd_replacement_funding import _check as _binding_check, _verify as _binding_verify
from uwmd_validation_core import Ledger, basic_rules, stage_readiness
from uwmd_validation_cross import cross_checks, financial_thresholds
from uwmd_validation_series import series_rules, bed_rules
from uwmd_size_contract import size_rules
from uwmd_validation_tax_capex import tax_rules, capex_rules
from uwmd_validation_lease import lease_rules
from uwmd_validation_structure import composition_rules, waterfall_rules
from uwmd_validation_builtins import builtin_rules
from uwmd_validation_external import composition_assessment
from uwmd_validation_selection import is_externalized
from uwmd_validation_optional_shapes import optional_shape_assessments
from uwmd_validation_payload_admission import payload_rules
from uwmd_validation_lease_up import _lease_up_assessment


async def validate_document(document, *, now=None, gap_staleness_days=14,
                            incomplete_policies=(), thresholds=None):
    """Assess the current canonical Document model, never stale source bytes."""
    return await _validate_document(document, now=now, gap_staleness_days=gap_staleness_days,
        incomplete_policies=incomplete_policies, thresholds=thresholds)


async def _validate_source(raw, *, filename=None, parts=None, **options):
    """Fresh SOURCE operation; supplied fragment bytes resolve without I/O."""
    from uwmd_reader import parse
    document = parse(raw, filename=filename)
    resolution = None
    if parts is not None:
        from uwmd_composition import index_parts, resolve_composition
        resolution = resolve_composition(document, index_parts(parse(source) for source in parts))
        document = resolution.document
    result = await _validate_document(document, _source_order=True, **options)
    if resolution is not None:
        result["composition_assessment"] = dict(status=resolution.status,
            externalized=list(resolution.externalized), issues=list(resolution.issues))
    return result


async def _validate_document(document, *, now=None, gap_staleness_days=14,
                             incomplete_policies=(), thresholds=None, _source_order=False):
    """Snapshot once before any await; return detached structural/binding results.

    Existing standalone reports retain their own scopes. Integration selects
    registered findings explicitly, never relabels local shape findings as new
    codes, and never merges async HDG-09 into synchronous errors.
    """
    snapshot = copy.deepcopy(document)
    ledger = Ledger(snapshot)
    metadata = basic_rules(ledger, now=now, gap_staleness_days=gap_staleness_days,
                incomplete_policies=incomplete_policies, _source_order=_source_order)
    cross_checks(ledger,defer_summaries=True)
    financial_thresholds(ledger, thresholds)
    lease_up = series_rules(ledger)
    bed_rules(ledger)
    size_rules(ledger)
    tax_rules(ledger)
    capex_rules(ledger)
    recovery_shapes = lease_rules(ledger)
    composition_rules(ledger)
    waterfall_rules(ledger)
    builtin_rules(ledger)
    composition = composition_assessment(snapshot)
    check = _binding_check(snapshot)
    # A LOCAL unperformed boundary, never an extra accepted V.12 union state.
    # Do not turn unavailable external payload into absent/malformed hedge data.
    if any(is_externalized(block) for block in check.consulted):
        binding = None
    else:
        ledger.issues.extend(i for i in check.issues if i["code"].startswith(("HDG-", "ESC-")))
        binding = await _binding_verify(check, None)
    payload_rules(ledger)
    lease_up=_lease_up_assessment(snapshot,ledger.issues)
    ledger.coverage_summaries()
    issues = copy.deepcopy(ledger.issues)
    partitions = {severity: [i for i in issues if i["severity"] == severity]
                  for severity in ("error", "warning", "info")}
    status = "errors" if partitions["error"] else "warnings" if partitions["warning"] else "clean"
    flags = snapshot.frontmatter.value.get("blocking_flags")
    # The reference: blocking when blocking_flags has a positive length (a
    # non-empty list or string); a number or mapping is not a flag list.
    if isinstance(flags, (list, str)) and len(flags) > 0:
        status = "blocking"
    return dict(overall_status=status, stage_readiness=stage_readiness(snapshot),
                issues=issues, errors=partitions["error"], warnings=partitions["warning"],
                info=partitions["info"], coverage=copy.deepcopy(ledger.coverage),
                replacement_funding_verification=copy.deepcopy(binding),
                composition_assessment=copy.deepcopy(composition),
                metadata_assessment=copy.deepcopy(metadata),
                section_assessment={"lease_up_schedule": copy.deepcopy(lease_up),
                                    **copy.deepcopy(optional_shape_assessments(
                                        snapshot, registered_recovery_shapes=recovery_shapes,
                                        registered_recovery_issues=ledger.issues))})
