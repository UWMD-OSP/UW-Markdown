"""Private, allowlisted builtin validation; not a general expression service.

Only the repository's normative builtin dictionary and the fixed Format 4.29-35
assertions below can reach this executor. Document/custom/module formulas are
never executed. This implements no calc command/capability, defaults or models.
"""
import json
from pathlib import Path

from uwmd_binding_sources import finite
from uwmd_builtin_field_homes import removed_hospitality_fields
from uwmd_expressions import parse_expression
from uwmd_numeric import quantize
from uwmd_periods import select_period_row, PeriodError
from uwmd_validation_selection import current_blocks, select_section, field

_ROOT = Path(__file__).resolve().parents[2]
_SCHEMAS = {
    "data_center": {"dc_capacity":"section-dc-capacity.schema.json", "dc_power":"section-dc-power.schema.json",
                    "dc_revenue":"section-dc-revenue.schema.json"},
    "hospitality": {"rent_roll":"rent-roll-hospitality.schema.json", "hotel_metrics":"section-hotel-metrics.schema.json",
                    "hotel_brand":"section-hotel-brand.schema.json", "hotel_food_beverage":"section-hotel-food-beverage.schema.json"},
    "manufactured_housing": {"mhc_sites":"section-mhc-sites.schema.json"},
}
# RFC 0080 folds these class-specific calculation inventories into core.
# Generic income/debt dictionary reproduction is a separate verifier surface,
# not an invitation to report unrelated metric errors during class validation.
_CALCULATIONS = {
    "data_center": frozenset(("utilization", "commissioned_share", "facility_load_kw",
        "annual_facility_kwh", "annual_power_cost", "power_cost_per_kw_month",
        "annual_rent_revenue", "blended_revenue_per_kw_month", "mark_to_market",
        "price_per_commissioned_kw", "noi_per_commissioned_kw")),
    "hospitality": frozenset(("revpar", "total_room_revenue", "room_revenue_per_key",
        "revpar_index", "fb_gross_margin")),
    "manufactured_housing": frozenset(("physical_occupancy", "annual_pad_rent_potential",
        "poh_share", "annual_poh_home_rent_potential", "price_per_site", "noi_per_site")),
}
_RULES = {
    "data_center": (
        ("CC-DC-01","error","dc_capacity.design_pue >= 1"),
        ("CC-DC-02","warning","dc_capacity.design_pue <= 1.6"),
        ("CC-DC-03","error","dc_capacity.critical_it_load_kw <= dc_capacity.planned_it_load_kw"),
        ("CC-DC-04","warning","dc_capacity.contracted_it_load_kw <= dc_capacity.critical_it_load_kw"),
        ("CC-DC-05","warning","facility_load_kw <= dc_capacity.utility_feed_kw"),
        ("CC-DC-06","warning","dc_capacity.measured_pue == null || dc_capacity.measured_pue <= dc_capacity.design_pue * 1.15"),
        ("CC-DC-07","warning","dc_revenue.market_rent_per_kw_month == null || mark_to_market <= round(1 / 0.85 - 1, 4)"),
    ),
    "hospitality": (
        ("CC-HOSP-01","warning","hotel_metrics.market_revpar == null || revpar >= hotel_metrics.market_revpar * 0.85"),
        ("CC-HOSP-02","error","rent_roll.occupancy == null || (rent_roll.occupancy >= 0 && rent_roll.occupancy <= 1)"),
        ("CC-HOSP-03","warning","hotel_brand.franchise_fee_pct_of_rooms + hotel_brand.marketing_fund_pct + hotel_brand.loyalty_program_pct <= 0.13"),
        ("CC-HOSP-05","warning","rent_roll.adr == null || rent_roll.occupancy == null || rent_roll.available_room_nights == null || noi_model.income.rooms_revenue == null || noi_model.income.rooms_revenue == 0 || abs(rent_roll.adr * rent_roll.occupancy * rent_roll.available_room_nights - noi_model.income.rooms_revenue) <= 0.01 * abs(noi_model.income.rooms_revenue)"),
    ),
    "manufactured_housing": (
        ("CC-MH-01","error","mhc_sites == null || (mhc_sites.total_sites != null && mhc_sites.total_sites >= 1 && round(mhc_sites.total_sites, 0) == mhc_sites.total_sites)"),
        ("CC-MH-02","error","mhc_sites == null || (mhc_sites.occupied_sites != null && mhc_sites.occupied_sites >= 0 && round(mhc_sites.occupied_sites, 0) == mhc_sites.occupied_sites && mhc_sites.occupied_sites <= mhc_sites.total_sites)"),
        ("CC-MH-03","error","mhc_sites == null || (mhc_sites.park_owned_homes != null && mhc_sites.park_owned_homes >= 0 && round(mhc_sites.park_owned_homes, 0) == mhc_sites.park_owned_homes && mhc_sites.park_owned_homes <= mhc_sites.total_sites)"),
        ("CC-MH-04","error","mhc_sites == null || (mhc_sites.weighted_pad_rent_monthly != null && mhc_sites.weighted_pad_rent_monthly >= 0)"),
        ("CC-MH-05","error","mhc_sites == null || mhc_sites.as_of_date != null"),
        ("CC-MH-06","error","mhc_sites == null || mhc_sites.park_owned_homes != 0 || mhc_sites.poh_home_rent_monthly == null"),
        ("CC-MH-07","error","mhc_sites == null || mhc_sites.park_owned_homes == null || mhc_sites.park_owned_homes <= 0 || (mhc_sites.poh_home_rent_monthly != null && mhc_sites.poh_home_rent_monthly >= 0)"),
    ),
}


class _OperationError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _number(value):
    if not finite(value):
        raise _OperationError("CALC-TYPE-001", "A finite numeric operand is required")
    return value


def _logical(value):
    if value is not None and not isinstance(value, bool):
        raise _OperationError("CALC-TYPE-001", "A boolean or null operand is required")
    return value


def _evaluate(node, resolve):
    kind = node[0]
    if kind == "reference":return resolve(node[1])
    if kind == "number":return _number(float(node[1]))
    if kind in ("string", "boolean"):return node[1]
    if kind == "null":return None
    if kind == "conditional":
        condition = _logical(_evaluate(node[1], resolve))
        return _evaluate(node[2] if condition is True else node[3], resolve)
    if kind == "unary":
        value = _evaluate(node[2], resolve)
        if node[1] == "!":
            return None if value is None else not _logical(value)
        return None if value is None else -_number(value)
    if kind == "call":
        # abs (RFC 0103 CC-HOSP-05) propagates null as Protocol VIII.3 does.
        if node[1] == "abs" and len(node[2]) == 1:
            value = _evaluate(node[2][0], resolve)
            return None if value is None else abs(_number(value))
        if node[1] != "round" or len(node[2]) != 2:
            raise _OperationError("CALC-TYPE-001", "Only reviewed builtin round and abs calls are admitted here")
        value, places = (_evaluate(n, resolve) for n in node[2])
        if value is None:return None
        _number(value);_number(places)
        if int(places) != places or not -12 <= places <= 12:
            raise _OperationError("CALC-TYPE-001", "Reviewed round places must be whole and in range")
        return quantize(value, int(places))
    if kind != "binary":
        raise _OperationError("CALC-PARSE-001", "Unexpected reviewed dictionary node")
    operator = node[1]
    left = _evaluate(node[2], resolve)
    if operator in ("&&", "||"):
        _logical(left)
        if operator == "&&" and left is False:return False
        if operator == "||" and left is True:return True
        right = _logical(_evaluate(node[3], resolve))
        if left is None or right is None:return None
        return left and right if operator == "&&" else left or right
    right = _evaluate(node[3], resolve)
    if operator in ("==", "!="):
        if left is None or right is None:equal = left is None and right is None
        elif finite(left) and finite(right):equal = left == right
        elif isinstance(left, bool) and isinstance(right, bool) or isinstance(left, str) and isinstance(right, str):equal = left == right
        elif isinstance(left, dict) and isinstance(right, dict) or isinstance(left, list) and isinstance(right, list):equal = left is right
        else:raise _OperationError("CALC-TYPE-001", "Equality operands have incompatible types")
        return equal if operator == "==" else not equal
    if left is None or right is None:return None
    left, right = _number(left), _number(right)
    if operator == "+":return _number(left + right)
    if operator == "-":return _number(left - right)
    if operator == "*":return _number(left * right)
    if operator == "/":
        if right == 0:raise _OperationError("CALC-DIV-ZERO", "Division by zero")
        return _number(left / right)
    if operator == ">":return left > right
    if operator == "<":return left < right
    if operator == ">=":return left >= right
    if operator == "<=":return left <= right
    raise _OperationError("CALC-PARSE-001", "Unexpected reviewed dictionary operator")


def _resolver(document, prior, roles):
    fm = document.frontmatter.value
    def resolve(ref):
        if any(k in ("constructor", "prototype", "__proto__") for k in (ref.head, *ref.members)):
            return None
        if ref.selector is None and ref.head in fm:
            value = fm[ref.head]
        elif current_blocks(document, ref.head, include_external=True):
            selection = select_section(document, ref.head, preferred_role=roles.get(ref.head))
            if selection.externalized:
                return None
            if selection.block is None:
                raise _OperationError("CALC-RESOLVE-002", selection.detail)
            value = selection.block.parsed.value
        elif ref.selector is None:
            value = prior.get(ref.head)
        else:
            return None
        members = ref.members
        if ref.selector is not None:
            if ref.selector_after != 1:
                raise _OperationError("CALC-PERIOD-001", "Unregistered period path")
            try:value = select_period_row(value, ref.head, members[0], ref.selector)
            except PeriodError as error:raise _OperationError(error.code, str(error)) from error
            members = members[1:]
        for key in members:
            if isinstance(value, dict):value = value.get(key)
            elif isinstance(value, list) and key.isascii() and key.isdecimal():
                index = int(key)
                value = value[index] if 0 <= index < len(value) else None
            else:return None
        return value
    return resolve


def _field_valid(value, schema):
    if "not" in schema and schema["not"] == {"type":"null"}:
        return value is not None
    types = schema.get("type")
    if isinstance(types, str):types = [types]
    if types:
        matches = ((value is None and "null" in types)
            or isinstance(value, str) and "string" in types
            or finite(value) and "number" in types
            or finite(value) and int(value) == value and "integer" in types)
        if not matches:return False
    if value is None:return True
    if "enum" in schema and value not in schema["enum"]:return False
    if finite(value):
        if "minimum" in schema and value < schema["minimum"]:return False
        if "maximum" in schema and value > schema["maximum"]:return False
    return True


def builtin_rules(ledger):
    document, asset = ledger.document, ledger.document.frontmatter.value.get("asset_class")
    if not isinstance(asset, str) or asset not in _SCHEMAS:return
    for section, filename in _SCHEMAS[asset].items():
        blocks = current_blocks(document, section)
        if not current_blocks(document, section, include_external=True) and section in ("dc_capacity", "mhc_sites"):
            ledger.issue("CLS-03", "error", section, "", "Required official class section is absent")
        schema = json.loads((_ROOT/"spec/schemas"/filename).read_text(encoding="utf-8"))
        for block in blocks:
            body = block.parsed.value
            for key, definition in schema.get("properties",{}).items():
                if key in body and not _field_valid(body[key], definition) or key not in body and key in schema.get("required",()):
                    ledger.issue("CLS-04", "error", section, key, "Stated official field violates its fixed contract")
            # MHC conditional ownership/rent agreement is reported by the
            # explicit CC-MH-06/07 assertions. Individual stated field types
            # and unconditional required fields retain CLS-04 above.
    if asset == "hospitality":
        # RFC0081G3's five explicit field homes, on the existing property-level
        # selection. Do not widen CLS-04 to every unknown schema member or peer.
        for section in ("rent_roll", "hotel_metrics"):
            selected = select_section(document, section)
            if selected.block is not None:
                for key in removed_hospitality_fields(section, selected.block.parsed.value):
                    ledger.issue("CLS-04", "error", section, key,
                                 "Hospitality field is stated outside its canonical home")
    dictionary = json.loads((_ROOT/"spec/metrics/builtin.json").read_text(encoding="utf-8"))
    prior = {}
    for definition in dictionary["calculations"]:
        if asset not in definition["asset_classes"] or definition["id"] not in _CALCULATIONS[asset]:continue
        try:
            value = _evaluate(parse_expression(definition["formula"]), _resolver(document, prior, definition["section_roles"]))
            if value is not None:
                value = quantize(_number(value), definition["round_to"])
            prior[definition["id"]] = value
        except _OperationError as error:
            prior[definition["id"]] = None
            ledger.issue("MOD-CALC-ERROR", "error", "", definition["id"], "Builtin calculation cannot evaluate from the stated operands",
                         value={"code":error.code})
    for code, severity, formula in _RULES[asset]:
        try:
            value = _evaluate(parse_expression(formula), _resolver(document, prior, {}))
            if value is False:
                ledger.issue(code, severity, "", code, "Stated class facts violate the registered assertion")
            elif value is not None and not isinstance(value, bool):
                raise _OperationError("CALC-TYPE-001","Registered assertion must return boolean or null")
        except _OperationError as error:
            ledger.issue("MOD-RULE-ERROR", "error", "", code, "Builtin rule cannot evaluate from the stated operands",
                         value={"code":error.code})
    if asset == "hospitality":
        metrics = select_section(document, "hotel_metrics")
        market = field(metrics.block.parsed.value,"market_revpar") if metrics.block is not None else None
        if market is not None and prior.get("revpar") is None:
            ledger.issue("CC-HOSP-04","warning","rent_roll","available_room_nights",
                         "Market RevPAR cannot be compared without usable actual rooms revenue/available room nights")
    if asset in ("data_center","manufactured_housing"):
        section, prop_key, other_key, code = (("dc_capacity","critical_it_load_kw","critical_it_load_kw","CC-DC-08")
            if asset == "data_center" else ("mhc_sites","total_sites","total_sites","CC-MH-08"))
        prop, other = select_section(document,"property"), select_section(document,section)
        a = field(prop.block.parsed.value,prop_key) if prop.block is not None else None
        b = field(other.block.parsed.value,other_key) if other.block is not None else None
        if finite(a) and finite(b) and a != b:
            ledger.issue(code,"error",section,other_key,"Stated property size and class size disagree")
