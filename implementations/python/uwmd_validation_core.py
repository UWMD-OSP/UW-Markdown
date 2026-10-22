"""Independent validation orchestration state and accepted basic Format rules.

No declared validate capability: the orchestrator is being completed against
all owning families before CLI/discovery promotion. Source is never rewritten.
"""
import copy
from datetime import datetime, timezone
import re

from uwmd_binding_sources import finite
from uwmd_document_sources import metadata_blocks
from uwmd_instant import epoch_milliseconds, instant_milliseconds
from uwmd_currency import inspect_document_currency
from uwmd_reader import APPEND
from uwmd_source_validation import _inspect_source_roles, _metadata_routing
from uwmd_validation_provenance import metadata_assessment, incomplete_policy
from uwmd_validation_selection import active_blocks, current_blocks, select_section, field
from uwmd_spec_data import metric_dictionary

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
# CC-16 is the unresolvable-section diagnostic, not a check; CC-17 is RFC 0086.
CC_IDS = tuple("CC-" + str(i).zfill(2) for i in range(1, 16)) + ("CC-17",)


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

    def read(self, check, section, key=None, **selection):
        result = select_section(self.document, section, **selection)
        self._reads.setdefault(check, []).append((key or section, result))
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

    def finish_coverage(self, *, summaries=True):
        if set(self.coverage) != set(CC_IDS):
            raise ValueError("All registered CC rules must report actual coverage")
        if summaries:
            self.coverage_summaries()

    def coverage_summaries(self):
        for section, checks in sorted(self._unresolved.items()):
            self.issue("CC-16", "info", section, "", "Property statement is unresolvable for " + ", ".join(sorted(checks)))


def sections_required(stage, asset_class):
    source = REQUIRED[stage]
    if stage != "scope" and asset_class in ("data_center", "manufactured_housing"):
        source = (*source, "dc_capacity" if asset_class == "data_center" else "mhc_sites")
    if asset_class == "land":
        return tuple(s for s in source if s not in ("rent_roll", "operating_statement"))
    if asset_class == "mixed_use":
        return tuple(dict.fromkeys("components" if s in ("rent_roll", "operating_statement") else s for s in source))
    return source


def _section_presence(document):
    """RFC 0116: a current section must state a non-null leaf."""
    def stated(value):
        if isinstance(value, dict):
            return any(stated(v) for k, v in value.items() if k not in ("_meta", "_notes", "_role"))
        if isinstance(value, list):
            return any(stated(v) for v in value)
        return value is not None
    return {section for section in REQUIRED["monitoring"] + ("components", "dc_capacity", "mhc_sites")
            if any(stated(b.parsed.value) for b in current_blocks(document, section, include_external=True))}


def _scope_missing_fields(prop, document):
    """Published scope presence: absent/null/exact empty string, no trimming."""
    def missing(path):
        value = field(prop, path)
        return value is None or value == ""
    paths = [path for path in ("address", "asset_class") if missing(path)]
    asset = document.frontmatter.value.get("asset_class")
    size = next((r["path"] for r in metric_dictionary()["size_intensives"]
                 if asset in r["asset_classes"]), None)
    valuation = select_section(document, "valuation")
    price = field(valuation.block.parsed.value, "purchase_price") if valuation.block else None
    alternatives = [("property." + size, field(prop, size))] if size else []
    if asset == "mixed_use":
        components = select_section(document, "components")
        body = components.block.parsed.value if components.block else {}
        slots = ("multifamily.total_units", "retail.nra_sqft", "office.nra_sqft", "industrial.nra_sqft",
                 "self_storage.nra_sqft", "student_housing.total_beds", "senior_housing.total_units",
                 "data_center.critical_it_load_kw", "manufactured_housing.total_sites")
        alternatives = [("components." + p, field(body, p)) for p in slots]
    alternatives.append(("valuation.purchase_price", price))
    if all(v is None or v == "" for _, v in alternatives):
        paths.append("|".join(p for p, _ in alternatives))
    return paths


def stage_readiness(document):
    present = _section_presence(document)
    result = {s: set(sections_required(s, document.frontmatter.value.get("asset_class"))) <= present for s in STAGES}
    selected = select_section(document, "property")
    prop = selected.block.parsed.value if selected.block is not None else {}
    result["scope"] = (result["scope"] and selected.block is not None
                       and not _scope_missing_fields(prop, document))
    ready = True
    for stage in STAGES:
        ready = ready and result[stage]
        result[stage] = ready
    return result


def _validation_source_issue(document, issue):
    """Project the unchanged wrapper finding at the ValidationResult boundary.

    The standalone source inventory retains its exact local-owner path. The
    existing ordinary wrapper diagnostic has no field; later metadata passes
    retain every canonical field, including P1's identically spelled _meta.
    """
    projected = copy.deepcopy(issue)
    index = issue.get("context", {}).get("block_index")
    blocks = metadata_blocks(document)
    if (issue.get("code") == "META-01" and issue.get("severity") == "error"
            and issue.get("field") == "_meta" and type(index) is int
            and 0 <= index < len(blocks)):
        block = blocks[index]
        if issue.get("section") == block.section and _metadata_routing(block.parsed.value):
            projected.pop("field", None)
    return projected


def basic_rules(ledger, *, now=None, gap_staleness_days=14, incomplete_policies=(),
                _source_order=False):
    """Metadata/scenario/stage/source rules, independently applied to source.

    Warning/info defaults and 14-day freshness are published implementation
    precedent; no new severity or financial convention is chosen.
    """
    document, fm = ledger.document, ledger.document.frontmatter.value
    source = _inspect_source_roles(document, _source_order=_source_order)
    # META01--06 retain every physical/model reference. Ordinary SRC sees
    # current sections/variants; ROLE additionally sees current extensions and
    # every active append entry. Neither reclassifies history, overwritten
    # peers or original-only references replaced during source composition.
    sections = tuple(dict.fromkeys(block.section for block in document.source.blocks))
    source_current = {id(block) for section in sections
                      if section not in APPEND and not section.startswith("x_")
                      for block in current_blocks(document, section, include_external=True)}
    role_current = source_current | {
        id(block) for section in sections if section.startswith("x_")
        for block in current_blocks(document, section, include_external=True)} | {
        id(block) for section in APPEND for block in active_blocks(document, section)}
    references = metadata_blocks(document)
    for issue in source["issues"]:
        population = (source_current if issue["code"].startswith("SRC-") else
                      role_current if issue["code"].startswith("ROLE-") else None)
        if population is not None:
            index = issue.get("context", {}).get("block_index")
            if type(index) is not int or not 0 <= index < len(references) or id(references[index]) not in population:
                continue
        ledger.issues.append(_validation_source_issue(document, issue))
    missing_meta_blocks = set()
    missing_field_owners = []
    physical = {id(block): index for index, block in enumerate(metadata_blocks(document))}
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
    # Completeness warnings keep their unchanged population (Protocol III.6a;
    # RFC 0093/0094 "absence warnings remain unchanged"): the current block of
    # each standard section and each current variant, as the reference reads
    # it. An earlier block a later one overwrites (Format 2.7), extensions and
    # append-only entries are not current, so they draw no warning. Ownership
    # bookkeeping still spans every active block, so their shape findings stay
    # attributed rather than becoming unallocated.
    standard = list(dict.fromkeys(b.section for b in document.source.blocks
                                  if b.section not in APPEND and not b.section.startswith("x_")))
    current = {id(b) for name in standard for b in current_blocks(document, name, include_external=True)}
    for block in active_blocks(document):
        body, section = block.parsed.value, block.section
        emit = id(block) in current
        meta = body.get("_meta")
        # A non-object or empty _meta is "no _meta object" (Protocol XI), so the
        # completeness warning stands beside any present-invalid META-01. The
        # reference departs for a non-empty string or array (#429).
        if "_meta" not in body or not isinstance(meta, dict) or not meta:
            if emit:
                ledger.issue("META_MISSING", "warning", section, "_meta", "Block provenance metadata is absent")
            if "_meta" not in body:
                missing_meta_blocks.add(physical[id(block)])
            continue
        required = (("SECTION", "section"), ("VERSION", "lifecycle.revision"),
                    ("SOURCE", "provenance.source"), ("TIMESTAMP", "provenance.timestamp"),
                    ("CONFIDENCE", "quality.confidence"))
        for suffix, path in required:
            cursor, exists = meta, True
            for part in path.split("."):
                # Absent or null is missing, as the reference reads it; RFC 0094
                # and RFC 0101 retain this warning beside any present-invalid code.
                if not isinstance(cursor, dict) or cursor.get(part) is None:
                    exists = False
                    break
                cursor = cursor[part]
            if not exists:
                code, canonical = "META_FIELD_MISSING_" + suffix, "_meta." + path
                if emit:
                    ledger.issue(code, "warning", section, canonical, "Required provenance field is absent")
                missing_field_owners.append((physical[id(block)], canonical, code))
        quality = meta.get("quality")
        if not isinstance(quality, dict):
            continue
        overrides = body.get("_overrides")
        low_leaf = isinstance(overrides,list) and any(
            isinstance(entry,dict) and entry.get("confidence")=="low" for entry in overrides)
        if emit and (quality.get("confidence") == "low" or low_leaf) and quality.get("human_review_required") is not True:
            ledger.issue("META_LOW_CONFIDENCE_NO_REVIEW_FLAG", "info", section, "_meta.quality.human_review_required", "Low confidence requires a review disclosure")
        # DQ-01/02/03 judge the same current population as the completeness
        # warnings: a block a later one overwrites (Format 2.7) is not current.
        if not emit:
            continue
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
    # RFC0095 moves attribution to the earlier physical META-06 pass.
    # Readiness-only DQ-06/info retains its existing position below.
    present = _section_presence(document)
    if stage in STAGES:
        for section in sections_required(stage, asset):
            if section not in present and (section != "property" or current_blocks(document, "property", include_external=True)):
                ledger.issue("DQ-06", "info", section, "", "Declared stage requires this section")
        if stage == "scope" and not selected.externalized:
            for path in _scope_missing_fields(prop, document):
                ledger.issue("DQ-04", "error", "property", path, "Scope-stage required field is absent")
    if now is None:
        instant = datetime.now(timezone.utc)
    elif isinstance(now, datetime):
        instant = now
    else:
        instant = datetime.fromisoformat(now.replace("Z", "+00:00"))
    if instant.tzinfo is None:
        raise ValueError("Validation freshness time must have a timezone")
    now_ms = instant_milliseconds(instant)
    for index, gap in enumerate(gaps):
        # Format §4.22 is silent on date-only/offset-less last_checked; the
        # reference's ECMAScript reading applies (uwmd_instant).
        checked = epoch_milliseconds(gap.get("last_checked")) if isinstance(gap, dict) else None
        if checked is None:
            continue
        if now_ms - checked > gap_staleness_days * 86_400_000:
            ledger.issue("DQ-05", "info", "gaps", "items[" + str(index) + "].last_checked", "Gap exceeds the disclosed freshness threshold")
    return metadata_assessment(document, source, missing_meta_blocks=missing_meta_blocks,
                               missing_field_owners=missing_field_owners,
                               _source_order=_source_order)
