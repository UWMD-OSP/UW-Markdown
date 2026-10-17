"""Independent accepted period-series, lease-up, cash-flow and bed checks."""
from uwmd_binding_sources import finite, cash_source_issues
from uwmd_expressions import ExpressionError, parse_expression, expression_references
from uwmd_numeric import calendar_date
from uwmd_periods import PERIOD_SERIES, inspect_period_series, parse_period_selector, PeriodError
from uwmd_reserves import reserve_structure
from uwmd_validation_lease_up import lease_up_rules
from uwmd_validation_selection import active_blocks, current_blocks, select_section, field, is_externalized


def series_rules(ledger):
    document = ledger.document
    for (section, series), entry in PERIOD_SERIES.items():
        for block in current_blocks(document, section):
            for problem in inspect_period_series(block.parsed.value, section, series).issues:
                ledger.issue(problem.code, problem.severity, section, problem.pointer, problem.message,
                             value={"variant": dict(block.attributes).get("variant")})
    # VIII.2a explicitly specifies a STATIC default-selection kind check. It is
    # not an evaluator verdict and includes every syntactic conditional branch.
    for block in active_blocks(document):
        if is_externalized(block) or block.section not in ("custom_calculations", "custom_scenarios"):
            continue
        body = block.parsed.value
        entries = [body]
        for key in ("calculations", "scenarios"):
            if isinstance(body.get(key), list):
                entries.extend(e for e in body[key] if isinstance(e, dict))
        for entry in entries:
            for formula_key in ("formula", "base_formula"):
                if not isinstance(entry.get(formula_key), str):
                    continue
                try:
                    references = expression_references(parse_expression(entry[formula_key]))
                except ExpressionError:
                    continue  # Module/evaluator grammar verdict is separately owned.
                for ref in references:
                    if ref.selector is None or ref.selector_after != 1:
                        continue
                    definition = PERIOD_SERIES.get((ref.head, ref.members[0]))
                    if definition is None:
                        continue
                    selected = select_section(document, ref.head)
                    if selected.block is None:
                        continue
                    try:
                        actual = parse_period_selector(ref.selector)[0]
                    except PeriodError:
                        continue
                    expected = {"year_index": "year", "iso_date": "date"}.get(definition.grammar)
                    if definition.grammar == "calendar_period":
                        expected = {"monthly": "month", "quarterly": "quarter"}.get(selected.block.parsed.value.get("period_granularity"))
                    if expected is not None and expected != actual:
                        ledger.issue("PS-03", "warning", block.section, formula_key,
                                     "Static selector kind differs from the default-selected registered series")
    for block in current_blocks(document, "dcf"):
        returns = block.parsed.value.get("returns")
        if isinstance(returns, dict) and "tax_basis" in returns and returns["tax_basis"] not in ("pre_tax", "after_tax"):
            ledger.issue("RT-01", "error", "dcf", "returns.tax_basis", "Return tax basis is outside the admitted vocabulary")
    for block in current_blocks(document, "cash_flow_series"):
        for message in cash_source_issues(block.parsed.value):
            if "source must contain both signs" in message:
                code = "CF-03"
            elif "nonempty array required" in message or "source dates must be nondecreasing" in message:
                code = "CF-02"
            else:
                code = "CF-01"
            ledger.issue(code, "error", "cash_flow_series", message.split(":", 1)[0], message,
                         value={"variant": dict(block.attributes).get("variant")})
    lease_up = lease_up_rules(ledger)
    for block in current_blocks(document, "reserve_accounts"):
        ledger.issues.extend(reserve_structure(block.parsed.value, document.frontmatter.value.get("currency_code"),
                                              dict(block.attributes).get("variant")))
    return lease_up


def bed_rules(ledger):
    document = ledger.document
    if document.frontmatter.value.get("asset_class") != "student_housing":
        return
    prop = select_section(document, "property")
    beds = field(prop.block.parsed.value, "total_beds") if prop.block is not None else None
    for block in current_blocks(document, "rent_roll"):
        roll = block.parsed.value
        for key in ("occupied_beds", "preleased_beds"):
            value = roll.get(key)
            if value is None:
                continue
            if not finite(value) or value < 0 or int(value) != value:
                ledger.issue("BED-01", "error", "rent_roll", key, "Stated bed count must be a finite nonnegative integer")
            elif finite(beds) and value > beds:
                ledger.issue("BED-02", "error", "rent_roll", key, "Stated count exceeds total property beds")
        if roll.get("occupied_beds") is not None and not calendar_date(roll.get("as_of_date")):
            ledger.issue("BED-03", "error", "rent_roll", "as_of_date", "Occupied beds require a real measurement date")
        if roll.get("preleased_beds") is not None:
            for key in ("preleased_as_of", "preleased_term_start"):
                if roll.get(key) is None:
                    ledger.issue("BED-04", "error", "rent_roll", key, "Preleased beds require both pre-leasing dates")
        for key in ("preleased_as_of", "preleased_term_start"):
            if roll.get(key) is not None and not calendar_date(roll[key]):
                ledger.issue("BED-05", "error", "rent_roll", key, "Stated pre-leasing date must be real")
        if (calendar_date(roll.get("preleased_as_of")) and calendar_date(roll.get("preleased_term_start"))
                and roll["preleased_as_of"] >= roll["preleased_term_start"]):
            ledger.issue("BED-06", "error", "rent_roll", "preleased_as_of", "Pre-leasing measurement must precede term start")
