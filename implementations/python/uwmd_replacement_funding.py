"""Independent Protocol V.12 checks; neither full validation nor hedge pricing.

The report's outer two-member wrapper is a nonnormative standalone CLI surface.
Only replacement_funding_verification implements the exact V.12.3 result union.
"""
import copy
from dataclasses import dataclass
import hashlib
import re

from uwmd_binding_sources import cash_source_issues, finite
from uwmd_jcs import CanonicalizationError, canonicalize
from uwmd_numeric import calendar_date
from uwmd_source_lifecycle import source_superseded
from uwmd_text import nonblank


_ROLES = ("primary", "senior", "junior", "summary", "detail", "component")
_TERMS = ("notional", "index", "effective_date", "expiration_date", "post_expiration_assumption")
_HEDGE = ("instrument", "strike_rate", *_TERMS, "premium", "counterparty", "replacement_funding")
_ESCROWS = ("tax", "insurance", "replacement_reserve", "ti_lc", "interest", "operating", "rate_cap_replacement", "other")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


class ReplacementFundingError(ValueError):
    """Invalid explicit inputs to the V.12 digest helper, not an HDG verdict."""


def _issue(code, section, field, message):
    return dict(code=code, severity="error", section=section, field=field, message=message)


def _safe_index(value):
    return finite(value) and value >= 0 and value <= 9007199254740991 and int(value) == value


def _currency(value):
    return value is None or isinstance(value, str) and re.fullmatch(r"[A-Z]{3}", value) is not None


def _current(document, section):
    return [b for b in document.source.blocks if b.section == section and not source_superseded(b)]


def _select(document, section, preference=None):
    """Format 2.7 canonical routing, then the exact Format 5.3 preference order.

    Returns (block, refused). Absence is distinct from present but ineligible.
    Role-free singleton sections retain their last-active Reader behavior.
    """
    active = _current(document, section)
    if not active:
        return None, False
    mapped = (any("_role" in b.parsed.value for b in active)
              and any("variant" in dict(b.attributes) for b in active))
    if not mapped:
        block = active[-1]
        role = block.parsed.value.get("_role")
        return (None, True) if "_role" in block.parsed.value and (role not in _ROLES or role == "component") else (block, False)
    current = {}
    for block in active:
        current[dict(block.attributes).get("variant", "default")] = block
    eligible = {key: b for key, b in current.items()
                if "_role" not in b.parsed.value or b.parsed.value["_role"] in _ROLES[:-1]}
    for role in (preference, "primary"):
        if role is None:
            continue
        matching = [b for b in eligible.values() if b.parsed.value.get("_role") == role]
        if len(matching) > 1:
            return None, True
        if matching:
            return matching[0], False
    for key in ("default", "base"):
        if key in eligible:
            return eligible[key], False
    if len(eligible) == 1:
        return next(iter(eligible.values())), False
    return None, True


def _cash(document, variant):
    current = {}
    for block in _current(document, "cash_flow_series"):
        current[dict(block.attributes).get("variant")] = block
    block = current.get(variant)
    # Projection's unlabelled 'default' is never an explicit authored identity.
    return block if block is not None and dict(block.attributes).get("variant") == variant else None


def _escrows(sources, issues):
    payload = sources.parsed.value if sources else {}
    uses = payload.get("uses")
    value = uses.get("escrows") if isinstance(uses, dict) else None
    if value is None:
        return False
    if not isinstance(value, list) or not value:
        issues.append(_issue("ESC-01", "sources_uses", "uses.escrows", "A nonempty escrow array is required."))
        return False
    seen, replacement = set(), False
    for index, entry in enumerate(value):
        field = "uses.escrows[" + str(index) + "]"
        if not isinstance(entry, dict):
            issues.append(_issue("ESC-01", "sources_uses", field, "An escrow object is required."))
            continue
        name, label = entry.get("name"), entry.get("label")
        replacement = replacement or name == "rate_cap_replacement"
        invalid = (name not in _ESCROWS or any(k not in ("name", "label", "upfront", "monthly", "lender_required") for k in entry)
                   or all(entry.get(k) is None for k in ("upfront", "monthly"))
                   or any(entry.get(k) is not None and (not finite(entry[k]) or entry[k] < 0) for k in ("upfront", "monthly"))
                   or entry.get("lender_required") is not None and not isinstance(entry["lender_required"], bool)
                   or label is not None and not isinstance(label, str))
        if invalid:
            issues.append(_issue("ESC-01", "sources_uses", field, "Invalid closed escrow data or funding amount."))
        identity = (name, label) if name == "other" else (name,)
        try:
            duplicate = identity in seen
            seen.add(identity)
        except TypeError:
            duplicate = False  # malformed data already has ESC-01
        if duplicate or (name == "other" and not nonblank(label)) or (name != "other" and label is not None):
            issues.append(_issue("ESC-02", "sources_uses", field, "Escrow identity/label is not lawful and unique."))
    return replacement


@dataclass
class _Check:
    issues: list
    unresolved: bool = False
    context: dict | None = None
    series: list | None = None
    stated: str | None = None


def _check(document):
    issues = []
    check = _Check(issues)
    debt, debt_refused = _select(document, "debt_structure", "senior")
    sources, sources_refused = _select(document, "sources_uses")
    hedge = debt.parsed.value.get("rate_hedge") if debt else None
    def binding_applicable(value):
        # RFC0081 G1 supersedes the older all-hedges trigger: a known strike-only
        # object has no replacement-selection claim. Malformed hedges cannot
        # establish that exemption and retain the RFC0076 refusal behavior.
        return value is not None and (not isinstance(value, dict)
            or any(value.get(k) is not None for k in (*_TERMS, "replacement_funding")))
    stated = binding_applicable(hedge) if debt else any(binding_applicable(b.parsed.value.get("rate_hedge"))
        for b in _current(document, "debt_structure"))
    if stated and (debt_refused or sources_refused):
        check.unresolved = True
        issues.append(_issue("HDG-08", "debt_structure", "rate_hedge" if debt_refused else "sources_uses", "Required property-level source selection refuses."))
    # Debt-only findings remain assessable when just sources_uses refuses.
    if debt_refused and stated:
        return check
    escrow_issues = []
    replacement = _escrows(sources, escrow_issues) if not sources_refused else False
    issues.extend(escrow_issues)
    if hedge is None:
        if replacement:
            issues.append(_issue("ESC-04", "sources_uses", "uses.escrows", "A replacement escrow requires the replace assumption."))
        return check
    if not isinstance(hedge, dict):
        issues.append(_issue("HDG-01", "debt_structure", "rate_hedge", "A closed hedge object is required."))
        if replacement and not sources_refused:
            issues.append(_issue("ESC-04", "sources_uses", "uses.escrows", "A replacement escrow requires the replace assumption."))
        return check
    def add(code, field, message):
        issues.append(_issue(code, "debt_structure", "rate_hedge" + ("." + field if field else ""), message))
    instrument, strike = hedge.get("instrument"), hedge.get("strike_rate")
    if instrument not in ("rate_cap", "rate_swap", "rate_collar") or not finite(strike) or not 0 < strike < 1 or any(k not in _HEDGE for k in hedge):
        add("HDG-01", "", "Invalid closed hedge instrument, strike or member.")
    if instrument in ("rate_swap", "rate_collar"):
        add("HDG-02", "instrument", "This instrument has no accepted verification procedure.")
    if debt.parsed.value.get("rate_type") not in ("floating", "hybrid"):
        add("HDG-03", "", "A stated hedge requires floating or hybrid debt.")
    if hedge.get("premium") is not None and (not finite(hedge["premium"]) or hedge["premium"] < 0):
        add("HDG-01", "premium", "Premium must be finite and nonnegative.")
    if hedge.get("counterparty") is not None and not isinstance(hedge["counterparty"], str):
        add("HDG-01", "counterparty", "Counterparty must be string or null.")
    terms = any(hedge.get(k) is not None for k in _TERMS)
    funding, assumption = hedge.get("replacement_funding"), hedge.get("post_expiration_assumption")
    if terms:
        if any(hedge.get(k) is None for k in _TERMS):
            add("HDG-01", "", "The non-null terms group is all-or-none.")
        if not finite(hedge.get("notional")) or hedge["notional"] < 0:
            add("HDG-01", "notional", "Notional must be finite and nonnegative.")
        if hedge.get("index") not in ("sofr", "prime", "treasury_5yr", "treasury_10yr"):
            add("HDG-01", "index", "Unsupported hedge index.")
        effective, expiration = hedge.get("effective_date"), hedge.get("expiration_date")
        if not calendar_date(effective) or not calendar_date(expiration) or expiration <= effective:
            add("HDG-01", "effective_date", "Real ordered initial hedge dates are required.")
        if assumption not in ("replace", "unhedged", "loan_matures_first"):
            add("HDG-06", "post_expiration_assumption", "A registered post-expiration assumption is required.")
    elif funding is not None:
        add("HDG-01", "", "Funding requires the complete terms group.")
    mode = funding.get("mode") if isinstance(funding, dict) else None
    shape = True
    if funding is not None:
        shape = isinstance(funding, dict) and mode in ("escrow", "outright") and assumption == "replace" and terms
        if shape:
            shape = (set(funding) == {"mode"} if mode == "escrow" else set(funding) == {"mode", "cash_flow_ref"})
        if shape and mode == "outright":
            ref = funding.get("cash_flow_ref")
            shape = isinstance(ref, dict) and set(ref) == {"variant", "row_index", "binding_digest"}
        if not shape:
            add("HDG-07", "replacement_funding", "Invalid funding union shape or replacement assumption.")
    if not sources_refused:
        if replacement and (assumption != "replace" or mode == "outright"):
            issues.append(_issue("ESC-04", "sources_uses", "uses.escrows", "Replacement escrow contradicts the selected funding path."))
        elif terms and assumption == "replace" and not (shape and mode == "outright") and not replacement:
            issues.append(_issue("ESC-04", "sources_uses", "uses.escrows", "The escrow funding path requires a replacement escrow."))
    if not shape or mode != "outright" or not terms or check.unresolved:
        return check
    ref = funding["cash_flow_ref"]
    variant, index, digest = ref["variant"], ref["row_index"], ref["binding_digest"]
    currency = document.frontmatter.value.get("currency_code")
    if not _currency(currency):
        issues.append(_issue("CUR-01", "frontmatter", "currency_code", "Currency must be an exact three-letter uppercase code or null."))
    reference_valid = isinstance(variant, str) and bool(variant) and _safe_index(index) and isinstance(digest, str) and _DIGEST.fullmatch(digest)
    cash = _cash(document, variant) if isinstance(variant, str) and variant else None
    if cash is None and isinstance(variant, str) and variant:
        check.unresolved = True
    if not reference_valid or cash is None:
        add("HDG-08", "replacement_funding.cash_flow_ref", "Invalid reference values or unavailable exact current cash variant.")
        return check
    payload = cash.parsed.value
    diagnostics = cash_source_issues(payload)
    if diagnostics:
        add("HDG-08", "replacement_funding.cash_flow_ref", "Selected cash series is structurally invalid.")
        for diagnostic in diagnostics:
            code = "CF-02" if "nonempty" in diagnostic or "nondecreasing" in diagnostic else "CF-03" if "both signs" in diagnostic else "CF-01"
            issues.append(_issue(code, "cash_flow_series", "series", diagnostic))
        return check
    rows = payload["series"]
    if index >= len(rows):
        add("HDG-08", "replacement_funding.cash_flow_ref.row_index", "Row ordinal is outside the selected series.")
        return check
    row = rows[int(index)]
    if row["amount"] > 0:
        add("HDG-10", "replacement_funding.cash_flow_ref", "The bound payment must be nonpositive.")
    if calendar_date(hedge.get("effective_date")) and row["date"] <= hedge["effective_date"]:
        add("HDG-10", "replacement_funding.cash_flow_ref", "The bound payment must follow the initial effective date.")
    if not _currency(currency):
        return check
    check.context = dict(debt_variant=dict(debt.attributes).get("variant"), cash_flow_variant=variant,
                         row_index=int(index), currency_code=currency)
    check.series, check.stated = rows, digest
    return check


def check_replacement_funding_structure(document):
    """Relevant V.12 prerequisites only; never a full ValidationResult."""
    return _check(copy.deepcopy(document)).issues


async def _sha256(preimage):
    return "sha256:" + hashlib.sha256(preimage).hexdigest()


async def compute_replacement_cash_flow_binding_digest(series, variant, row_index, currency_code, *, hash_provider=None):
    """Explicit V.12 preimage; supported immutable inputs, no normalization."""
    rows = copy.deepcopy(series)
    if (not isinstance(variant, str) or not variant or not _safe_index(row_index)
            or not _currency(currency_code) or not isinstance(rows, list)
            or row_index >= len(rows) or cash_source_issues({"series": rows})):
        raise ReplacementFundingError("Invalid replacement cash-flow binding arguments")
    preimage = dict(currency_code=currency_code, row_index=int(row_index), section="cash_flow_series", series=rows, variant=variant)
    try:
        encoded = canonicalize(preimage).encode("utf-8")
    except CanonicalizationError as error:
        raise ReplacementFundingError("Binding arguments cannot be canonicalized") from error
    result = await (hash_provider or _sha256)(encoded)
    if not isinstance(result, str) or _DIGEST.fullmatch(result) is None:
        raise ReplacementFundingError("Hash provider returned an invalid SHA-256 digest")
    return result


async def _verify(check, hash_provider):
    if check.issues:
        return dict(state="unverifiable", reason="unresolvable_source" if check.unresolved else "invalid_structure",
                    context=check.context, structural_issues=copy.deepcopy(check.issues), issues=[])
    if check.context is None:
        return dict(state="not_checked", reason="not_applicable", issues=[])
    try:
        context = check.context
        computed = await compute_replacement_cash_flow_binding_digest(check.series, context["cash_flow_variant"],
            context["row_index"], context["currency_code"], hash_provider=hash_provider)
        if not isinstance(computed, str) or _DIGEST.fullmatch(computed) is None:
            raise ReplacementFundingError("Hash provider returned an invalid SHA-256 digest")
    except Exception:
        return dict(state="unverifiable", reason="crypto_unavailable", context=copy.deepcopy(check.context), structural_issues=[], issues=[])
    result = dict(state="verified" if computed == check.stated else "failed", context=copy.deepcopy(check.context),
                  stated_digest=check.stated, computed_digest=computed, issues=[])
    if computed != check.stated:
        result["reason"] = "stale_binding"
        issue = _issue("HDG-09", "debt_structure", "rate_hedge.replacement_funding.cash_flow_ref.binding_digest", "The declared cash source commitment is stale.")
        issue.update(context=copy.deepcopy(check.context), stated_digest=check.stated, computed_digest=computed)
        result["issues"].append(issue)
    return result


async def verify_replacement_funding_bindings(document, *, hash_provider=None):
    """Snapshot before the first await; exact V.12.3 result union only."""
    check = _check(copy.deepcopy(document))
    return await _verify(check, hash_provider)


async def replacement_funding_report(document, *, hash_provider=None):
    """Nonnormative standalone wrapper, with no document-validation claim."""
    check = _check(copy.deepcopy(document))
    return dict(structural_issues=copy.deepcopy(check.issues),
                replacement_funding_verification=await _verify(check, hash_provider))
