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
from uwmd_validation_tax_capex import tax_rules, capex_rules
from uwmd_validation_lease import lease_rules
from uwmd_validation_structure import composition_rules, waterfall_rules
from uwmd_validation_builtins import builtin_rules
from uwmd_validation_external import composition_assessment
from uwmd_validation_selection import is_externalized


async def validate_document(document, *, now=None, gap_staleness_days=14,
                            incomplete_policies=(), thresholds=None):
    """Snapshot once before any await; return detached structural/binding results.

    Existing standalone reports retain their own scopes. Integration selects
    registered findings explicitly, never relabels local shape findings as new
    codes, and never merges async HDG-09 into synchronous errors.
    """
    snapshot = copy.deepcopy(document)
    ledger = Ledger(snapshot)
    metadata = basic_rules(ledger, now=now, gap_staleness_days=gap_staleness_days,
                incomplete_policies=incomplete_policies)
    cross_checks(ledger)
    financial_thresholds(ledger, thresholds)
    lease_up = series_rules(ledger)
    bed_rules(ledger)
    tax_rules(ledger)
    capex_rules(ledger)
    lease_rules(ledger)
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
    issues = copy.deepcopy(ledger.issues)
    partitions = {severity: [i for i in issues if i["severity"] == severity]
                  for severity in ("error", "warning", "info")}
    status = "errors" if partitions["error"] else "warnings" if partitions["warning"] else "clean"
    if snapshot.frontmatter.value.get("blocking_flags"):
        status = "blocking"
    return dict(overall_status=status, stage_readiness=stage_readiness(snapshot),
                issues=issues, errors=partitions["error"], warnings=partitions["warning"],
                info=partitions["info"], coverage=copy.deepcopy(ledger.coverage),
                replacement_funding_verification=copy.deepcopy(binding),
                composition_assessment=copy.deepcopy(composition),
                metadata_assessment=copy.deepcopy(metadata),
                section_assessment={"lease_up_schedule": copy.deepcopy(lease_up)})
