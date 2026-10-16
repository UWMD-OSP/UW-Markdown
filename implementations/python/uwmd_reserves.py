"""Independent Format 4.28 structure and Protocol VIII.11 custody verification."""
import copy
import math

from uwmd_envelope import EnvelopeError, source_digest
from uwmd_jcs import CanonicalizationError
from uwmd_numeric import calendar_date, quantize
from uwmd_source_lifecycle import source_superseded as _superseded
from uwmd_text import nonblank


_ROLES = ("primary", "senior", "junior", "summary", "detail", "component")
_KINDS = ("contribution", "internal_draw", "external_release")


def _text(value):
    return nonblank(value)


def _amount(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value) and value >= 0
    except OverflowError:
        return False


def reserve_structure(payload, currency=None, variant=None):
    """Source-ordered RSV-01..05 findings only; no arithmetic verdict."""
    issues = []
    def issue(code, field, message, value=None):
        issues.append(dict(code=code, severity="error", section="reserve_accounts", field=field,
                           message=message, value=dict(variant=variant, value=value)))
    def shape(value, required, optional, field):
        if not isinstance(value, dict):
            issue("RSV-01", field, "expected a closed object", value)
            return False
        for key in value:
            if key not in required and key not in optional:
                issue("RSV-01", field + ("." if field else "") + key, "unknown member", value[key])
        return True
    def text(value, key, field):
        if not _text(value.get(key)):
            issue("RSV-01", field + "." + key, "explicit nonblank fact required", value.get(key))
    def source(value, field):
        if not shape(value, ("document", "locator"), (), field):
            return
        for key in ("document", "locator"):
            text(value, key, field)
    def amount(value, key, field):
        if not _amount(value.get(key)):
            issue("RSV-01", field + "." + key, "finite nonnegative amount required", value.get(key))
    def identity(value, key, seen, field):
        text(value, key, field)
        identifier = value.get(key)
        if _text(identifier):
            if identifier in seen:
                issue("RSV-02", field + "." + key, "duplicate identity", identifier)
            seen.add(identifier)
    if not shape(payload, ("accounts",), ("_meta", "_role", "_notes"), ""):
        return issues
    if "_meta" in payload and not isinstance(payload["_meta"], dict):
        issue("RSV-01", "_meta", "metadata must be an object", payload["_meta"])
    if "_role" in payload and payload["_role"] not in _ROLES:
        issue("RSV-01", "_role", "invalid role", payload["_role"])
    if "_notes" in payload and payload["_notes"] is not None and not isinstance(payload["_notes"], str):
        issue("RSV-01", "_notes", "notes must be string or null", payload["_notes"])
    accounts = payload.get("accounts")
    if not isinstance(accounts, list) or not accounts:
        issue("RSV-01", "accounts", "explicit nonempty accounts required", accounts)
        return issues
    account_ids = set()
    for ai, account in enumerate(accounts):
        ap = "accounts[" + str(ai) + "]"
        if not shape(account, ("account_id", "class", "purpose", "owner", "currency_code", "source", "periods"), (), ap):
            continue
        identity(account, "account_id", account_ids, ap)
        if account.get("class") != "property_reserve":
            issue("RSV-04", ap + ".class", "unsupported or absent account class", account.get("class"))
        for key in ("purpose", "owner"):
            text(account, key, ap)
        code = account.get("currency_code")
        if not isinstance(code, str) or len(code) != 3 or any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" for c in code) or (currency is not None and code != currency):
            issue("RSV-01", ap + ".currency_code", "currency must be uppercase and agree with document", code)
        source(account.get("source"), ap + ".source")
        periods = account.get("periods")
        if not isinstance(periods, list) or not periods:
            issue("RSV-01", ap + ".periods", "explicit nonempty periods required", periods)
            continue
        period_ids, previous = set(), None
        for pi, period in enumerate(periods):
            pp = ap + ".periods[" + str(pi) + "]"
            if not shape(period, ("period_id", "start_date", "end_date", "opening_balance", "ending_balance", "source", "movements"), ("previous_period_id",), pp):
                previous = None
                continue
            identity(period, "period_id", period_ids, pp)
            start, end = period.get("start_date"), period.get("end_date")
            valid_bounds = calendar_date(start) and calendar_date(end)
            if not valid_bounds or start > end:
                issue("RSV-03", pp, "invalid period calendar bounds")
            if previous is not None and valid_bounds:
                left, right = previous.get("start_date"), previous.get("end_date")
                if calendar_date(left) and calendar_date(right) and (start <= left or start < right):
                    issue("RSV-05", pp, "periods must be ordered without overlap")
            if "previous_period_id" in period:
                text(period, "previous_period_id", pp)
                if previous is None or period["previous_period_id"] != previous.get("period_id"):
                    issue("RSV-05", pp + ".previous_period_id", "predecessor must be immediately preceding stated period")
            for key in ("opening_balance", "ending_balance"):
                amount(period, key, pp)
            source(period.get("source"), pp + ".source")
            movements = period.get("movements")
            if not isinstance(movements, list):
                issue("RSV-01", pp + ".movements", "explicit movements array required", movements)
            else:
                movement_ids, last_date = set(), None
                for mi, movement in enumerate(movements):
                    mp = pp + ".movements[" + str(mi) + "]"
                    if not shape(movement, ("movement_id", "date", "kind", "amount", "counterparty", "source"), (), mp):
                        continue
                    identity(movement, "movement_id", movement_ids, mp)
                    date = movement.get("date")
                    real_date = calendar_date(date)
                    if not real_date or (valid_bounds and not start <= date <= end):
                        issue("RSV-03", mp + ".date", "movement requires an in-bounds calendar date", date)
                    if real_date and last_date is not None and date < last_date:
                        issue("RSV-05", mp + ".date", "movements must be nondecreasing", date)
                    if real_date:
                        last_date = date
                    if movement.get("kind") not in _KINDS:
                        issue("RSV-04", mp + ".kind", "source-established movement kind required", movement.get("kind"))
                    amount(movement, "amount", mp)
                    text(movement, "counterparty", mp)
                    source(movement.get("source"), mp + ".source")
            previous = period
    return issues


def verify_reserve_accounts(document):
    """Read-only VIII.11 result. Snapshot all supplied data before any work."""
    document = copy.deepcopy(document)
    blocks = [block for block in document.source.blocks if block.section == "reserve_accounts" and not _superseded(block)]
    return _verify_reserve_blocks(document, blocks)


def _verify_reserve_blocks(document, blocks):
    """Internal VIII.12 reuse: selected blocks, original complete source digest.

    Caller supplies its already-snapshotted original document. Never construct
    or hash a filtered document to select reserve variants.
    """
    result = dict(state="not_checked", reason="not_applicable", source_digest=None, evidence=[], issues=[])
    if not blocks:
        return result
    for block in blocks:
        variant = dict(block.attributes).get("variant")
        result["issues"].extend(reserve_structure(block.parsed.value, document.frontmatter.value.get("currency_code"), variant))
    if result["issues"]:
        result.update(state="unverifiable", reason="invalid_structure")
        return result
    try:
        result["source_digest"] = source_digest(document)
    except (EnvelopeError, CanonicalizationError, UnicodeError, ValueError, TypeError, OverflowError):
        result.update(state="unverifiable", reason="digest_unavailable")
        return result
    overflow = False
    for block in blocks:
        variant = dict(block.attributes).get("variant")
        for ai, account in enumerate(block.parsed.value["accounts"]):
            previous = None
            for pi, period in enumerate(account["periods"]):
                field = "accounts[" + str(ai) + "].periods[" + str(pi) + "]"
                context = dict(variant=variant, account_id=account["account_id"], period_id=period["period_id"], source=period["source"])
                def finding(code, suffix, message):
                    result["issues"].append(dict(code=code, severity="error", section="reserve_accounts", field=field + suffix, message=message, context=context))
                ending = float(period["opening_balance"])
                finite = True
                for movement in period["movements"]:
                    amount = float(movement["amount"])
                    ending = ending + amount if movement["kind"] == "contribution" else ending - amount
                    if not math.isfinite(ending):
                        finite = False
                        break
                if not finite:
                    overflow = True
                    finding("RSV-08", ".ending_balance", "nonfinite balance arithmetic")
                else:
                    computed, stated = quantize(ending, 2), quantize(period["ending_balance"], 2)
                    if not math.isfinite(computed) or not math.isfinite(stated):
                        overflow = True
                        finding("RSV-08", ".ending_balance", "nonfinite balance quantization")
                    else:
                        result["evidence"].append(dict(variant=variant, account_id=account["account_id"], period_id=period["period_id"], field=field + ".ending_balance", currency_code=account["currency_code"], source=period["source"], opening_balance=period["opening_balance"], stated_ending_balance=period["ending_balance"], computed_ending_balance=ending, movements=period["movements"]))
                        if computed != stated:
                            finding("RSV-06", ".ending_balance", "stated ending balance disagrees")
                if "previous_period_id" in period and previous is not None:
                    if quantize(period["opening_balance"], 2) != quantize(previous["ending_balance"], 2):
                        finding("RSV-07", ".opening_balance", "explicitly claimed continuity disagrees")
                previous = period
    result["state"] = "unverifiable" if overflow else ("failed" if result["issues"] else "verified")
    if overflow:
        result["reason"] = "nonfinite_arithmetic"
    else:
        result.pop("reason", None)
    return result
