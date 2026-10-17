"""Developing independent complete-validation API; CLI/discovery remain gated.

This module composes one ValidationResult and the separate Protocol V.12 union.
It is not a claimed complete validator while remaining owning families are
being implemented. It never writes source or recomputes financial models.
"""
import copy

from uwmd_replacement_funding import replacement_funding_report
from uwmd_validation_core import Ledger, basic_rules, stage_readiness
from uwmd_validation_cross import cross_checks, financial_thresholds
from uwmd_validation_series import series_rules, bed_rules


async def validate_document(document, *, now=None, gap_staleness_days=14,
                            incomplete_policies=(), thresholds=None):
    """Snapshot once before any await; return detached structural/binding results.

    Existing standalone reports retain their own scopes. Integration selects
    registered findings explicitly, never relabels local shape findings as new
    codes, and never merges async HDG-09 into synchronous errors.
    """
    snapshot = copy.deepcopy(document)
    ledger = Ledger(snapshot)
    basic_rules(ledger, now=now, gap_staleness_days=gap_staleness_days,
                incomplete_policies=incomplete_policies)
    cross_checks(ledger)
    financial_thresholds(ledger, thresholds)
    series_rules(ledger)
    bed_rules(ledger)
    binding = await replacement_funding_report(snapshot)
    # Currency and each current cash series are already checked globally;
    # V.12 still retains its exact source prerequisites in its separate union.
    ledger.issues.extend(i for i in binding["structural_issues"]
                         if i["code"].startswith(("HDG-", "ESC-")))
    issues = copy.deepcopy(ledger.issues)
    partitions = {severity: [i for i in issues if i["severity"] == severity]
                  for severity in ("error", "warning", "info")}
    status = "errors" if partitions["error"] else "warnings" if partitions["warning"] else "clean"
    if snapshot.frontmatter.value.get("blocking_flags"):
        status = "blocking"
    return dict(overall_status=status, stage_readiness=stage_readiness(snapshot),
                issues=issues, errors=partitions["error"], warnings=partitions["warning"],
                info=partitions["info"], coverage=copy.deepcopy(ledger.coverage),
                replacement_funding_verification=copy.deepcopy(binding["replacement_funding_verification"]))
