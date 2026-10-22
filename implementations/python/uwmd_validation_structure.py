"""Independent accepted mixed-use/capital-stack/waterfall structural rules."""
from uwmd_binding_sources import finite
from uwmd_numeric import quantize
from uwmd_validation_core import BUILTINS
from uwmd_validation_selection import current_blocks, is_externalized


def _integer(value, minimum=0):
    return finite(value) and value >= minimum and int(value) == value


def _unit(value):
    return finite(value) and 0 <= value <= 1


# Format §4.24 names the waterfall concepts (tiers, promote, IRR hurdles,
# catch-up) but not their keys; these are the reference's ten markers, each
# refused at its own key (RFC 0026 §E).
_WATERFALL_MARKERS = ("waterfall", "distribution_waterfall", "distributions", "distribution_tiers",
                      "tiers", "promote", "hurdle", "hurdles", "catch_up", "carried_interest")
_TRANCHE_CLASSES = ("senior_debt", "mezzanine_debt", "preferred_equity", "common_equity",
                    "bridge", "seller_financing", "other_debt")


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _stack(ledger, payload, section, root):
    """Format §4.24 CS-04, CS-01, CS-02, CS-02b and CS-WATERFALL-UNSUPPORTED.

    CS-01 is the prose's four required members and the two uniqueness rules,
    one finding per member; a stated null is not a stated rate (CS-02).
    """
    prefix = root + "." if root else ""
    def issue(code, path, message):
        ledger.issue(code, "error", section, prefix + path, message)
    content = payload if isinstance(payload, dict) else {}
    if content.get("point_in_time") not in ("closing", "stabilization"):
        # RFC 0098: the stack names its one point in time.
        issue("CS-04", "point_in_time", "Capital stack must state point_in_time as closing or stabilization")
    for key in content:
        if key in _WATERFALL_MARKERS:
            issue("CS-WATERFALL-UNSUPPORTED", key, "Partnership waterfall terms do not belong in capital_stack")
    tranches = content.get("tranches")
    ids, positions = set(), set()
    for index, tranche in enumerate(tranches if isinstance(tranches, list) else ()):
        path = "tranches[" + str(index) + "]"
        tranche = tranche if isinstance(tranche, dict) else {}
        identity, position, kind, amount = (tranche.get(k) for k in ("id", "position", "class", "amount"))
        # RFC 0104 D3: a tranche is addressed by its index, never its id.
        if not isinstance(identity, str) or not identity:
            issue("CS-01", path + ".id", "Tranche must state a nonempty string id")
        elif identity in ids:
            issue("CS-01", path + ".id", "Tranche id must be unique within its stack")
        else:
            ids.add(identity)
        if kind not in _TRANCHE_CLASSES:
            issue("CS-01", path + ".class", "Tranche class is not admitted")
        if not _integer(position, 1):
            issue("CS-01", path + ".position", "Tranche position must be a positive integer")
        elif position in positions:
            issue("CS-01", path + ".position", "Tranche position must be unique within its stack")
        else:
            positions.add(position)
        if not _number(amount):
            issue("CS-01", path + ".amount", "Tranche must state a numeric amount")
        rate, mode = tranche.get("rate"), tranche.get("accrual")
        if kind in _TRANCHE_CLASSES and kind != "common_equity" and rate is None:
            issue("CS-02", path + ".rate", "Debt and preferred tranches must state a rate")
        if kind == "common_equity" and rate is not None:
            issue("CS-02", path + ".rate", "Common equity must not state a rate")
        cash, accrued = tranche.get("cash_rate"), tranche.get("accrued_rate")
        if mode == "split":
            if kind != "preferred_equity":
                issue("CS-02b", path + ".accrual", "Only preferred equity admits a split coupon")
            if not finite(cash):
                issue("CS-02b", path + ".cash_rate", "A split coupon requires a finite cash_rate")
            if not finite(accrued):
                issue("CS-02b", path + ".accrued_rate", "A split coupon requires a finite accrued_rate")
            # CS-02 owns an absent total rate; a stated total is compared only
            # with both finite components.
            if rate is not None and finite(cash) and finite(accrued) and rate != cash + accrued:
                issue("CS-02b", path + ".rate", "Split rates must reconcile to the stated total")
        elif "cash_rate" in tranche or "accrued_rate" in tranche:
            issue("CS-02b", path + ".accrual", "Component rates must not appear outside a split coupon")
        for key in tranche:
            if key in _WATERFALL_MARKERS:
                issue("CS-WATERFALL-UNSUPPORTED", path + "." + key, "Partnership terms do not belong in a capital tranche")


def composition_rules(ledger):
    document = ledger.document
    allowed = tuple(c for c in BUILTINS if c not in ("mixed_use", "land"))
    for block in current_blocks(document, "components"):
        payload = block.parsed.value
        entries = {k: v for k, v in payload.items() if not k.startswith("_")}
        admitted = {k: v for k, v in entries.items() if k in allowed}
        if len(admitted) < 2:
            ledger.issue("MU-01", "error", "components", "", "Mixed-use requires at least two admissible uses")
        for key, value in entries.items():
            if key not in allowed:
                ledger.issue("MU-02", "error", "components", key, "Component class is not an admitted income class")
                continue
            if not isinstance(value, dict) or value.get("component_class") != key:
                ledger.issue("MU-03", "error", "components", key, "Component class must equal its map key")
            if not isinstance(value, dict):
                continue
            if not finite(value.get("net_operating_income")):
                ledger.issue("MU-04", "error", "components", key + ".net_operating_income", "Present component must state finite NOI")
            if value.get("debt_structure") is not None:
                ledger.issue("MU-06", "error", "components", key + ".debt_structure", "Use component capital_stack for separately stated financing")
            if isinstance(value.get("capital_stack"), dict):
                _stack(ledger, value["capital_stack"], "components", key + ".capital_stack")
        if any(isinstance(v, dict) and v.get("allocation_pct") is not None for v in admitted.values()):
            allocations = [v.get("allocation_pct") if isinstance(v, dict) else None for v in admitted.values()]
            total = 0.0
            valid = all(_unit(v) for v in allocations)
            if valid:
                for value in allocations:total += value
            if not valid or abs(total - 1) > .0001:
                ledger.issue("MU-05", "error", "components", "allocation_pct", "Stated allocations must be complete and sum to one within 0.0001")
    for block in current_blocks(document, "capital_stack"):
        _stack(ledger, block.parsed.value, "capital_stack", "")
    # RFC 0098 DS-01: a stated debt_structure point_in_time outside the vocabulary.
    for block in current_blocks(document, "debt_structure", include_external=True):
        body = block.parsed.value
        if isinstance(body, dict) and "point_in_time" in body and body["point_in_time"] not in ("closing", "stabilization"):
            ledger.issue("DS-01", "error", "debt_structure", "point_in_time",
                         "debt_structure point_in_time must be closing or stabilization", value=body["point_in_time"])


def waterfall_rules(ledger):
    document = ledger.document
    cash = {dict(b.attributes).get("variant"): b
            for b in current_blocks(document, "cash_flow_series", include_external=True)}
    physical = {id(block): index for index, block in enumerate(document.source.blocks)}
    for block in current_blocks(document, "distribution_waterfall"):
        payload = block.parsed.value
        def issue(code, path, message, severity="error"):
            evidence = (dict(context=dict(block_index=physical[id(block)],
                        variant=dict(block.attributes).get("variant")))
                        if code in ("WF-10", "WF-12", "WF-13") else {})
            ledger.issue(code, severity, "distribution_waterfall", path, message, **evidence)
        equity, tiers = payload.get("equity_split"), payload.get("tiers")
        grammar = (isinstance(equity, dict) and set(equity) == {"lp", "gp"}
                   and _unit(equity["lp"]) and _unit(equity["gp"])
                   and quantize(equity["lp"] + equity["gp"], 4) == 1)
        previous, seen, previous_em, previous_irr = -1, set(), None, None
        order = ("return_of_capital", "preferred_return", "catch_up", "split")
        if not isinstance(tiers, list) or not tiers:
            grammar = False
            tiers = []
        for tier in tiers:
            if not isinstance(tier, dict) or tier.get("type") not in order:
                grammar = False
                continue
            kind = tier["type"]; index = order.index(kind)
            if index < previous or (kind != "split" and kind in seen):
                grammar = False
            previous = index;seen.add(kind)
            allowed = {"type"}
            if kind == "preferred_return":
                allowed |= {"rate", "accrual"}
                rate = tier.get("rate")
                grammar = grammar and finite(rate) and 0 < rate < 1 and tier.get("accrual") in ("simple", "compound_annual")
            elif kind == "catch_up":
                allowed |= {"gp_share", "target_promote"}
                share, promote = tier.get("gp_share"), tier.get("target_promote")
                grammar = grammar and _unit(share) and finite(promote) and 0 < promote < 1 and share > promote
            elif kind == "split":
                allowed |= {"lp_share", "gp_share", "until_lp_em", "until_lp_irr", "hurdle_mode"}
                lp, gp = tier.get("lp_share"), tier.get("gp_share")
                grammar = grammar and _unit(lp) and _unit(gp)
                if _unit(lp) and _unit(gp):grammar = grammar and quantize(lp + gp, 4) == 1
                em, irr, mode = tier.get("until_lp_em"), tier.get("until_lp_irr"), tier.get("hurdle_mode")
                if em is not None:
                    grammar = grammar and finite(em) and em > 0 and finite(lp) and lp > 0
                    if finite(em):
                        rounded = quantize(em, 4)
                        grammar = grammar and (previous_em is None or rounded > previous_em)
                        previous_em = rounded
                if irr is not None:
                    grammar = grammar and finite(irr) and 0 < irr < 1 and finite(lp) and lp > 0
                    if finite(irr):
                        rounded = quantize(irr, 6)
                        grammar = grammar and (previous_irr is None or rounded > previous_irr)
                        previous_irr = rounded
                if mode is not None:
                    grammar = grammar and em is not None and irr is not None and mode in ("both", "any")
            grammar = grammar and set(tier) <= allowed
        if tiers:
            final = tiers[-1]
            grammar = grammar and isinstance(final, dict) and final.get("type") == "split"
            grammar = grammar and isinstance(final, dict) and final.get("until_lp_em") is None and final.get("until_lp_irr") is None
        if not grammar:
            issue("WF-01", "tiers", "Waterfall equity split or ordered tier ladder is outside the admitted grammar")
        reference = payload.get("cash_flow_ref")
        variant = reference.get("variant") if isinstance(reference, dict) else None
        series = cash.get(variant) if isinstance(variant, str) else None
        if not isinstance(variant, str):
            issue("WF-02", "cash_flow_ref", "Waterfall must name a cash_flow_series variant")
            rows = None  # No series resolves, so WF-15 has no distribution to judge.
        elif series is None:
            issue("WF-02", "cash_flow_ref.variant", "Waterfall must reference a current exact cash-flow variant")
            rows = None
        elif is_externalized(series):
            rows = None  # Identity exists; contribution/distribution facts are unresolved.
        else:
            rows = series.parsed.value.get("series")
            # A non-array series is the CF-02 defect of the cash section; it
            # carries no contribution or distribution facts for WF-03/WF-15.
            rows = rows if isinstance(rows, list) else None
            if rows is not None and not any(isinstance(row, dict) and finite(row.get("amount")) and row["amount"] < 0 for row in rows):
                issue("WF-03", "cash_flow_ref.variant", "Referenced vector contains no stated capital contribution")
        clawback = payload.get("clawback")
        if clawback is not None:
            if not isinstance(clawback, dict):
                issue("WF-10", "clawback", "Clawback must state an admitted basis")
                continue
            basis, rate, multiple = clawback.get("basis"), clawback.get("floor_rate"), clawback.get("floor_multiple")
            # RFC0059: clawback floor_multiple >1 is distinct from the
            # positive until_lp_em tier hurdle. No quantization is applied here.
            if (basis not in ("lp_preferred_shortfall", "lp_irr_floor", "lp_em_floor")
                    or basis == "lp_irr_floor" and (not finite(rate) or not 0 < rate < 1)
                    or basis == "lp_em_floor" and (not finite(multiple) or multiple <= 1)):
                issue("WF-10", "clawback", "Clawback basis requires its stated floor input")
            if basis == "lp_preferred_shortfall" and not any(isinstance(t, dict) and t.get("type") == "preferred_return" for t in tiers):
                issue("WF-11", "clawback.basis", "Preferred shortfall requires a preferred-return tier")
            if clawback.get("cap") != "promote_received":
                issue("WF-12", "clawback.cap", "Clawback cap must be promote received")
            tax = clawback.get("net_of_tax_rate")
            if tax is not None and (not finite(tax) or not 0 <= tax < 1):
                issue("WF-13", "clawback.net_of_tax_rate", "Net-of-tax rate must be a stated fraction below one")
            if rows is not None and not any(isinstance(row, dict) and finite(row.get("amount")) and row["amount"] > 0 for row in rows):
                issue("WF-15", "clawback", "Clawback provision has no stated distribution", "warning")
