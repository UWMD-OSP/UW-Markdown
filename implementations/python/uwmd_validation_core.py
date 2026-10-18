"""Independent validation orchestration state and accepted basic Format rules.

No declared validate capability: the orchestrator is being completed against
all owning families before CLI/discovery promotion. Source is never rewritten.
"""
import copy
from datetime import datetime, timezone
import re

from uwmd_binding_sources import finite
from uwmd_currency import inspect_document_currency
from uwmd_reader import APPEND
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import (metadata_assessment, incomplete_policy,
                                        market_data_accepted, missing_market_reference)
from uwmd_validation_selection import active_blocks, current_blocks, select_section, field

STAGES = ("scope", "screening", "term_sheet", "full_underwrite",
          "credit_approval", "closing", "monitoring")
_BASE = (
    ("property",),
    ("property", "debt_structure", "validation"),
    ("property", "debt_structure", "validation", "rent_roll", "borrower_sponsor", "preliminary_sizing"),
)
_FULL = (*_BASE[2], "operating_statement", "noi_model", "valuation", "sources_uses", "market_analysis")
_CREDIT = (*_FULL, "dcf", "stress_tests", "risk_assessment", "compliance", "assumptions")
REQUIRED = dict(zip(STAGES, (*_BASE, _FULL, _CREDIT, (*_CREDIT, "due_diligence"), (*_CREDIT, "due_diligence"))))
BUILTINS = ("multifamily", "office", "retail", "industrial", "self_storage", "hospitality",
            "mixed_use", "senior_housing", "student_housing", "land", "data_center", "manufactured_housing")
SCENARIOS = ("stabilized_acquisition", "ground_up_development", "value_add", "lease_up",
             "house_flip", "commercial_flip", "property_conversion", "land_banking")
NAMESPACE = re.compile(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}\Z")
CC_IDS = tuple("CC-" + str(i).zfill(2) for i in range(1, 16))


class Ledger:
    def __init__(self, document):
        self.document = document
        self.issues = []
        self.coverage = {}
        self._reads = {}
        self._unresolved = {}

    def issue(self, code, severity, section, path, message, **evidence):
        item = dict(code=code, severity=severity, section=section, field=path, message=message)
        item.update(copy.deepcopy(evidence))
        self.issues.append(item)

    def read(self, check, section, **selection):
        result = select_section(self.document, section, **selection)
        self._reads.setdefault(check, []).append((section, result))
        if result.reason == "variant_unresolvable":
            self._unresolved.setdefault(section, set()).add(check)
        return result.block.parsed.value if result.block is not None else None

    def cover(self, check, evaluated=False, reason=None, detail=None):
        reads = self._reads.get(check, ())
        resolutions = {section: result.evidence for section, result in reads if result.evidence is not None}
        if evaluated:
            entry = {"status": "evaluated"}
        else:
            if reason is None:
                refused = next((r for _, r in reads if r.reason == "variant_unresolvable"), None)
                absent = next((r for _, r in reads if r.reason is not None), None)
                result = refused or absent
                reason = result.reason if result is not None else "field_absent"
                detail = result.detail if result is not None else "Required stated comparison fields are absent"
            entry = dict(status="skipped", reason=reason, detail=detail or "Check is not applicable")
        if resolutions:
            entry["resolutions"] = copy.deepcopy(resolutions)
        self.coverage[check] = entry

    def finish_coverage(self):
        if set(self.coverage) != set(CC_IDS):
            raise ValueError("All registered CC rules must report actual coverage")
        for section, checks in sorted(self._unresolved.items()):
            self.issue("CC-16", "info", section, "", "Property statement is unresolvable for " + ", ".join(sorted(checks)))


def sections_required(stage, asset_class):
    source = REQUIRED[stage]
    if asset_class == "land":
        return tuple(s for s in source if s not in ("rent_roll", "operating_statement"))
    if asset_class == "mixed_use":
        return tuple(dict.fromkeys("components" if s in ("rent_roll", "operating_statement") else s for s in source))
    return source


def _section_presence(document):
    """Format 5.1 counts active presence, including unresolved external refs."""
    return {block.section for block in active_blocks(document)}


def _scope_missing_fields(prop):
    """Published scope presence: absent/null/exact empty string, no trimming."""
    def missing(path):
        value = field(prop, path)
        return value is None or value == ""
    paths = [path for path in ("address", "asset_class") if missing(path)]
    if all(missing(path) for path in ("units", "asking_price")):
        paths.append("units|asking_price")
    return paths


def stage_readiness(document):
    present = _section_presence(document)
    result = {s: set(sections_required(s, document.frontmatter.value.get("asset_class"))) <= present for s in STAGES}
    selected = select_section(document, "property")
    prop = selected.block.parsed.value if selected.block is not None else {}
    result["scope"] = (result["scope"] and selected.block is not None
                       and not _scope_missing_fields(prop))
    return result


def basic_rules(ledger, *, now=None, gap_staleness_days=14, incomplete_policies=()):
    """Metadata/scenario/stage/source rules, independently applied to source.

    Warning/info defaults and 14-day freshness are published implementation
    precedent; no new severity or financial convention is chosen.
    """
    document, fm = ledger.document, ledger.document.frontmatter.value
    source = inspect_source_roles(document)
    ledger.issues.extend(source["issues"])
    missing_meta_blocks = set()
    missing_field_owners = []
    physical = {id(block): index for index, block in enumerate(document.source.blocks)}
    ledger.issues.extend(inspect_document_currency(document)["issues"])
    if "locale" in fm and fm["locale"] not in ("en-US", "en-GB", "de-DE", "fr-FR", "ja-JP", "zh-CN"):
        ledger.issue("LOC-01", "error", "frontmatter", "locale", "Locale is outside the registered vocabulary", value=fm["locale"])
    asset = fm.get("asset_class")
    if asset is not None and asset not in BUILTINS:
        if not isinstance(asset, str) or NAMESPACE.fullmatch(asset) is None:
            ledger.issue("INVALID-ASSET-CLASS-001", "error", "frontmatter", "asset_class", "Invalid asset-class identifier", value=asset)
        elif asset.rsplit(".", 1)[-1] in BUILTINS:
            ledger.issue("INVALID-ASSET-CLASS-002", "error", "frontmatter", "asset_class", "Namespaced identifiers must not shadow a builtin", value=asset)
        elif not isinstance(fm.get("modules"), list) or not any(isinstance(m, dict) and isinstance(m.get("id"), str) for m in fm["modules"]):
            ledger.issue("MOD-DEPENDENCY-UNDECLARED", "warning", "frontmatter", "modules", "A custom class must name its declaring module")
    scenario = fm.get("scenario")
    if scenario is not None and (not isinstance(scenario, str) or (scenario not in SCENARIOS and NAMESPACE.fullmatch(scenario) is None)):
        ledger.issue("DQ-07", "warning", "frontmatter", "scenario", "Unrecognized business-plan identity", value=scenario)
    selected = select_section(document, "property")
    prop = selected.block.parsed.value if selected.block is not None else {}
    front_subtype, prop_subtype = fm.get("asset_subtype"), prop.get("asset_subtype")
    if front_subtype == "build_to_rent" or prop_subtype == "build_to_rent":
        if front_subtype is not None and prop_subtype is not None and front_subtype != prop_subtype:
            ledger.issue("DQ-08", "warning", "property", "asset_subtype", "BTR subtype carriers disagree")
        if asset != "multifamily":
            ledger.issue("DQ-09", "warning", "frontmatter", "asset_class", "BTR identity is scoped to multifamily")
    gap_selection = select_section(document, "gaps")
    gaps = field(gap_selection.block.parsed.value, "items") if gap_selection.block is not None else []
    gaps = gaps if isinstance(gaps, list) else []
    stage = fm.get("deal_stage")
    for block in active_blocks(document):
        body, section = block.parsed.value, block.section
        meta = body.get("_meta")
        if "_meta" not in body:
            ledger.issue("META_MISSING", "warning", section, "_meta", "Block provenance metadata is absent")
            missing_meta_blocks.add(physical[id(block)])
            continue
        if not isinstance(meta, dict):
            continue  # Present malformed shape already has the registered META-01.
        required = (("SECTION", "section"), ("VERSION", "lifecycle.revision"),
                    ("SOURCE", "provenance.source"), ("TIMESTAMP", "provenance.timestamp"),
                    ("CONFIDENCE", "quality.confidence"))
        for suffix, path in required:
            cursor, exists = meta, True
            for part in path.split("."):
                if not isinstance(cursor, dict) or part not in cursor:
                    exists = False
                    break
                cursor = cursor[part]
            if not exists:
                code, canonical = "META_FIELD_MISSING_" + suffix, "_meta." + path
                ledger.issue(code, "warning", section, canonical, "Required provenance field is absent")
                missing_field_owners.append((physical[id(block)], canonical, code))
        quality = meta.get("quality")
        if not isinstance(quality, dict):
            continue
        overrides = body.get("_overrides")
        low_leaf = isinstance(overrides,list) and any(
            isinstance(entry,dict) and entry.get("confidence")=="low" for entry in overrides)
        if (quality.get("confidence") == "low" or low_leaf) and quality.get("human_review_required") is not True:
            ledger.issue("META_LOW_CONFIDENCE_NO_REVIEW_FLAG", "info", section, "_meta.quality.human_review_required", "Low confidence requires a review disclosure")
        if quality.get("partial") is True and not (isinstance(body.get("_overrides"), list) and body["_overrides"]):
            ledger.issue("DQ-03", "warning", section, "_overrides", "Partial data requires a field annotation inventory")
        if quality.get("provisional") is True:
            if not any(isinstance(g, dict) and g.get("section") == section for g in gaps):
                ledger.issue("DQ-01", "warning", section, "_meta.quality.provisional", "Provisional block has no matching gap")
            paths = {None}
            paths.update(p["field_path"] for p in incomplete_policies
                         if isinstance(p,dict) and p.get("section")==section and isinstance(p.get("field_path"),str))
            actions = [incomplete_policy(section,path,stage,incomplete_policies) for path in paths]
            halts = [policy for policy in actions if policy is not None
                     and isinstance(policy.get("action"),dict) and policy["action"].get("kind")=="halt"]
            if halts:
                ledger.issue("DQ-02", "error", section, "_meta.quality.provisional",
                             "Declared stage requires observed rather than provisional data",
                             value={"policy_fields": sorted({p.get("field_path","") for p in halts})})
    # Preserve published checkDataQuality's current sections population for
    # RFC0022 DQ-06/error, distinct from declared-stage DQ-06/info below.
    # Inspect every current variant, never only the selected financial role.
    # Physical active peers excluded here retain local reference assessment.
    for section in dict.fromkeys(b.section for b in active_blocks(document)):
        if section in APPEND or section.startswith("x_"):
            continue
        for block in current_blocks(document, section, include_external=True):
            if market_data_accepted(block.parsed.value) and missing_market_reference(block.parsed.value):
                ledger.issue("DQ-06", "error", section, "_meta.provenance.market_data_ref",
                             "A market_data_accepted value must identify its observation set, vintage and digest")
    present = _section_presence(document)
    if stage in STAGES:
        for section in sections_required(stage, asset):
            if section != "property" and section not in present:
                ledger.issue("DQ-06", "info", section, "", "Declared stage requires this section")
        if stage == "scope" and not selected.externalized:
            for path in _scope_missing_fields(prop):
                message = ("Scope requires stated units or asking price" if path == "units|asking_price"
                           else "Scope-stage property field is absent")
                ledger.issue("DQ-04", "error", "property", path, message)
    if now is None:
        instant = datetime.now(timezone.utc)
    elif isinstance(now, datetime):
        instant = now
    else:
        instant = datetime.fromisoformat(now.replace("Z", "+00:00"))
    if instant.tzinfo is None:
        raise ValueError("Validation freshness time must have a timezone")
    for index, gap in enumerate(gaps):
        if not isinstance(gap, dict) or not isinstance(gap.get("last_checked"), str):
            continue
        try:
            checked = datetime.fromisoformat(gap["last_checked"].replace("Z", "+00:00"))
            stale = checked.tzinfo is not None and (instant - checked).total_seconds() > gap_staleness_days * 86400
        except ValueError:
            continue
        if stale:
            ledger.issue("DQ-05", "info", "gaps", "items[" + str(index) + "].last_checked", "Gap exceeds the disclosed freshness threshold")
    return metadata_assessment(document, source, missing_meta_blocks=missing_meta_blocks,
                               missing_field_owners=missing_field_owners)
