"""Independent Protocol VIII.12 reserve-draw binding verification.

Consistency of explicit source funding identities only. No model generation,
classification inference, metrics, receipt, authentication or tier capability.
"""
import copy
import re

from uwmd_binding_sources import cash_source_issues, finite, lease_source_issues
from uwmd_envelope import source_digest
from uwmd_numeric import quantize
from uwmd_source_lifecycle import source_superseded as _superseded
from uwmd_reserves import _verify_reserve_blocks
from uwmd_text import nonblank


_OMITTED = object()
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}")


def _currency(value):
    return isinstance(value, str) and re.fullmatch(r"[A-Z]{3}", value) is not None


def _positive(value):
    return finite(value) and value > 0 and quantize(value, 2) > 0


def _draw_key(draw):
    return (draw["variant"], draw["account_id"], draw["period_id"], draw["movement_id"])


def _ref_key(ref):
    if ref["section"] == "cash_flow_series":
        return (ref["section"], ref["variant"], ref["row_index"])
    return (ref["section"], ref["variant"], ref["period"], ref["field"])


def _plan_issues(plan):
    issues = []
    def issue(code, field, message):
        issues.append(dict(code=code, severity="error", section="reserve_draw_bindings",
                           field=field, message=message))
    def closed(value, fields, field):
        if not isinstance(value, dict) or set(value) != set(fields):
            issue("RDB-01", field, "closed object requires exactly its declared fields")
            return False
        return True
    def variant(value):
        return value is None or nonblank(value)
    def draw(value, field):
        if not closed(value, ("variant", "account_id", "period_id", "movement_id"), field):
            return False
        if not variant(value["variant"]) or not all(nonblank(value[key]) for key in ("account_id", "period_id", "movement_id")):
            issue("RDB-01", field, "exact nullable variant and nonblank source IDs required")
            return False
        return True
    def ref(value, field):
        if not isinstance(value, dict):
            issue("RDB-01", field, "source reference object required")
            return False
        if value.get("section") == "cash_flow_series":
            if not closed(value, ("section", "variant", "row_index"), field):
                return False
            index = value["row_index"]
            valid = finite(index) and 0 <= index <= 9007199254740991 and int(index) == index
        elif value.get("section") == "lease_up_schedule":
            if not closed(value, ("section", "variant", "period", "field"), field):
                return False
            valid = nonblank(value["period"]) and value["field"] == "ti_lc_capex"
        else:
            valid = False
        if not valid or not variant(value.get("variant")):
            issue("RDB-01", field, "unsupported or malformed exact expenditure reference")
            return False
        return True
    if not closed(plan, ("source_digest", "currency_code", "coverage", "selected_draws", "expenditures", "bindings"), "plan"):
        return issues
    if not isinstance(plan["source_digest"], str) or _DIGEST.fullmatch(plan["source_digest"]) is None:
        issue("RDB-01", "plan.source_digest", "complete semantic SHA-256 digest required")
    if not _currency(plan["currency_code"]):
        issue("RDB-01", "plan.currency_code", "uppercase three-letter currency required")
    if plan["coverage"] != "declared_complete":
        issue("RDB-01", "plan.coverage", "explicit declared_complete coverage required")
    for key in ("selected_draws", "expenditures", "bindings"):
        if not isinstance(plan[key], list) or not plan[key]:
            issue("RDB-01", "plan." + key, "explicit nonempty inventory required")
    if any(not isinstance(plan[key], list) for key in ("selected_draws", "expenditures", "bindings")):
        return issues
    seen_draws, seen_ids, seen_refs, seen_edges = set(), set(), set(), set()
    for index, item in enumerate(plan["selected_draws"]):
        field = "plan.selected_draws[" + str(index) + "]"
        if draw(item, field):
            identity = _draw_key(item)
            if identity in seen_draws:
                issue("RDB-05", field, "duplicate selected draw identity")
            seen_draws.add(identity)
    for index, item in enumerate(plan["expenditures"]):
        field = "plan.expenditures[" + str(index) + "]"
        if not closed(item, ("expenditure_id", "ref", "category", "gross", "currency_code", "funded_amount", "source"), field):
            continue
        valid_id = nonblank(item["expenditure_id"])
        valid_ref = ref(item["ref"], field + ".ref")
        if not valid_id:
            issue("RDB-01", field + ".expenditure_id", "nonblank expenditure ID required")
        if item["category"] not in ("ti_lc", "other_capex", "operating_expenses") or item["gross"] is not True or not _currency(item["currency_code"]) or not _positive(item["funded_amount"]):
            issue("RDB-01", field, "explicit gross category/currency/positive funded amount required")
        source = item["source"]
        if closed(source, ("document", "locator"), field + ".source") and not all(nonblank(source[key]) for key in source):
            issue("RDB-01", field + ".source", "nonblank attributable evidence required")
        if valid_id and valid_ref:
            identity = _ref_key(item["ref"])
            if item["expenditure_id"] in seen_ids or identity in seen_refs:
                issue("RDB-05", field, "duplicate expenditure ID or source address")
            seen_ids.add(item["expenditure_id"])
            seen_refs.add(identity)
    for index, item in enumerate(plan["bindings"]):
        field = "plan.bindings[" + str(index) + "]"
        if not closed(item, ("draw", "expenditure_id", "funded_amount"), field):
            continue
        valid_draw = draw(item["draw"], field + ".draw")
        if not nonblank(item["expenditure_id"]) or not _positive(item["funded_amount"]):
            issue("RDB-01", field, "nonblank expenditure ID and positive allocation required")
        elif valid_draw:
            identity = (_draw_key(item["draw"]), item["expenditure_id"])
            if identity in seen_edges:
                issue("RDB-05", field, "duplicate draw/expenditure edge")
            seen_edges.add(identity)
    return issues


def verify_reserve_draw_bindings(document, plan=_OMITTED):
    """Snapshot both inputs; verify declared identity, never assemble cash flows."""
    omitted = plan is _OMITTED
    document = copy.deepcopy(document)
    plan = _OMITTED if omitted else copy.deepcopy(plan)
    result = dict(state="not_checked", reason="not_applicable", source_digest=None, evidence=[], issues=[])
    if omitted:
        return result
    result["issues"] = _plan_issues(plan)
    if result["issues"]:
        result.update(state="unverifiable", reason="invalid_structure")
        return result
    result["stated_digest"] = plan["source_digest"]
    def issue(code, field, message, value=None):
        finding = dict(code=code, severity="error", section="reserve_draw_bindings", field=field, message=message)
        if value is not None:
            finding["value"] = value
        result["issues"].append(finding)
    try:
        result["source_digest"] = source_digest(document)
    except (ValueError, TypeError, UnicodeError, OverflowError):
        result.update(state="unverifiable", reason="digest_unavailable")
        return result
    if result["source_digest"] != plan["source_digest"]:
        issue("RDB-02", "plan.source_digest", "source digest is stale")
        result.update(state="failed", reason="stale_binding")
        return result
    def exact(section, variant, field):
        blocks = [block for block in document.source.blocks
                  if block.section == section and not _superseded(block)
                  and dict(block.attributes).get("variant") == variant]
        if len(blocks) != 1:
            issue("RDB-03", field, "exact current source is missing or ambiguous")
            return None
        return blocks[0]
    draws, expenditures, reserve_states = {}, {}, {}
    currency = plan["currency_code"]
    document_currency = document.frontmatter.value.get("currency_code")
    for index, ref in enumerate(plan["selected_draws"]):
        field = "plan.selected_draws[" + str(index) + "]"
        block = exact("reserve_accounts", ref["variant"], field)
        if block is None:
            continue
        variant = ref["variant"]
        if variant not in reserve_states:
            reserve_states[variant] = _verify_reserve_blocks(document, [block])
            if reserve_states[variant]["state"] != "verified":
                issue("RDB-04", field, "selected reserve variant does not verify", reserve_states[variant]["issues"])
        if reserve_states[variant]["state"] != "verified":
            continue
        accounts = block.parsed.value["accounts"]
        found = []
        for ai, account in enumerate(accounts):
            if account["account_id"] != ref["account_id"]:
                continue
            for pi, period in enumerate(account["periods"]):
                if period["period_id"] != ref["period_id"]:
                    continue
                for mi, movement in enumerate(period["movements"]):
                    if movement["movement_id"] == ref["movement_id"]:
                        found.append((ai, pi, mi, account, movement))
        if len(found) != 1:
            issue("RDB-03", field, "exact account/period/movement identity is unresolved")
            continue
        ai, pi, mi, account, movement = found[0]
        if (account["class"] != "property_reserve" or movement["kind"] != "internal_draw"
                or not _positive(movement["amount"]) or account["currency_code"] != currency
                or (document_currency is not None and document_currency != currency)):
            issue("RDB-06", field, "draw class, positive amount or currency disagrees")
            continue
        draws[_draw_key(ref)] = dict(ref=ref, source_path="reserve_accounts.accounts[" + str(ai) + "].periods[" + str(pi) + "].movements[" + str(mi) + "].amount",
                                    amount=movement["amount"], date=movement["date"], source=movement["source"], meta=block.parsed.value.get("_meta", {}))
    for index, expenditure in enumerate(plan["expenditures"]):
        field = "plan.expenditures[" + str(index) + "]"
        ref = expenditure["ref"]
        block = exact(ref["section"], ref["variant"], field + ".ref")
        if block is None:
            continue
        payload = block.parsed.value
        problems = cash_source_issues(payload) if ref["section"] == "cash_flow_series" else lease_source_issues(payload)
        if problems:
            issue("RDB-04", field + ".ref", "selected expenditure source structure is invalid", problems)
            continue
        if ref["section"] == "cash_flow_series":
            row_index = int(ref["row_index"])
            if row_index >= len(payload["series"]):
                issue("RDB-03", field + ".ref", "exact source row is unresolved")
                continue
            row = payload["series"][row_index]
            amount, date, period = row["amount"], row["date"], None
            path = "cash_flow_series.series[" + str(row_index) + "].amount"
            valid_category = expenditure["category"] in ("other_capex", "operating_expenses")
        else:
            matches = [row for row in payload["schedule"] if row["period"] == ref["period"]]
            if len(matches) != 1:
                issue("RDB-03", field + ".ref", "exact lease-up period is unresolved")
                continue
            amount, date, period = matches[0].get("ti_lc_capex"), None, ref["period"]
            path = "lease_up_schedule.schedule@" + period + ".ti_lc_capex"
            valid_category = expenditure["category"] == "ti_lc"
        if (not finite(amount) or amount >= 0 or quantize(amount, 2) >= 0 or not valid_category
                or expenditure["currency_code"] != currency
                or (document_currency is not None and document_currency != currency)):
            issue("RDB-06", field, "negative gross amount, category or currency disagrees")
            continue
        expenditures[expenditure["expenditure_id"]] = dict(expenditure_id=expenditure["expenditure_id"], ref=ref,
            category=expenditure["category"], source_path=path, gross_amount=amount,
            stated_funded_amount=expenditure["funded_amount"], date=date, period=period,
            source=expenditure["source"], meta=payload.get("_meta", {}))
    selected = {_draw_key(ref) for ref in plan["selected_draws"]}
    declared = {item["expenditure_id"] for item in plan["expenditures"]}
    draw_totals = {key: 0.0 for key in selected}
    expenditure_totals = {key: 0.0 for key in declared}
    for index, binding in enumerate(plan["bindings"]):
        key, identifier = _draw_key(binding["draw"]), binding["expenditure_id"]
        if key not in selected or identifier not in declared:
            issue("RDB-03", "plan.bindings[" + str(index) + "]", "edge endpoint is not declared")
            continue
        if key not in draws or identifier not in expenditures:
            continue
        result["evidence"].append(dict(binding_index=index, currency_code=currency,
            funded_amount=binding["funded_amount"], draw=draws[key], expenditure=expenditures[identifier]))
    if result["issues"]:
        result.update(state="unverifiable", reason="invalid_source")
        return result
    # No allocation arithmetic until every source/refusal check is complete.
    for edge in result["evidence"]:
        draw_totals[_draw_key(edge["draw"]["ref"])] += float(edge["funded_amount"])
        expenditure_totals[edge["expenditure"]["expenditure_id"]] += float(edge["funded_amount"])
    overflow = False
    for index, ref in enumerate(plan["selected_draws"]):
        key = _draw_key(ref)
        amount = draw_totals[key]
        field = "plan.selected_draws[" + str(index) + "]"
        if not finite(amount):
            overflow = True
            issue("RDB-09", field, "draw allocation sum is nonfinite")
        elif quantize(amount, 2) != quantize(draws[key]["amount"], 2):
            issue("RDB-07", field, "selected draw is not fully allocated")
    for index, item in enumerate(plan["expenditures"]):
        identifier = item["expenditure_id"]
        amount = expenditure_totals[identifier]
        field = "plan.expenditures[" + str(index) + "]"
        if not finite(amount):
            overflow = True
            issue("RDB-09", field, "expenditure allocation sum is nonfinite")
        elif (quantize(amount, 2) != quantize(item["funded_amount"], 2)
              or quantize(amount, 2) > quantize(-expenditures[identifier]["gross_amount"], 2)):
            issue("RDB-08", field, "funded share disagrees or exceeds gross expenditure")
    result["state"] = "unverifiable" if overflow else ("failed" if result["issues"] else "verified")
    if overflow:
        result["reason"] = "nonfinite_arithmetic"
    else:
        result.pop("reason", None)
    return result
