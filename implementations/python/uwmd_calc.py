"""Independent accepted expression execution over the current Python Document.

A stated calculation is evaluated read-only. This is no underwriting generator,
metric-completeness claim, validation fallback or Verifier-tier advertisement.
"""
import math
import re

from uwmd_calc_errors import CalcError, CalcUnavailable
from uwmd_calc_builtins import BUILTINS, call_builtin, number
from uwmd_expressions import ExpressionError, parse_expression
from uwmd_periods import PERIOD_SERIES, PeriodError, parse_period_selector, select_period_row
from uwmd_reader import APPEND, PARALLEL
from uwmd_source_lifecycle import source_superseded
from uwmd_source_validation import BLOCK_ROLES
from uwmd_numeric import quantize

_BLOCKED = frozenset(("constructor", "prototype", "__proto__"))
_ROLES = frozenset(BLOCK_ROLES)
_RESERVED = frozenset(("_meta", "_notes", "_role", "_overrides"))
_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")


def _type(message):
    raise CalcError("CALC-TYPE-001", message)


def parse_context(value):
    """Existing exact-path JSON transport; preserve explicit null and spelling."""
    if not isinstance(value, dict) or set(value) - {"sectionVariants", "overrides"}:
        _type("Calculation context requires only sectionVariants and overrides")
    for name, entries in value.items():
        if not isinstance(entries, dict):
            _type(name + " requires an object")
        for key, entry in entries.items():
            if not isinstance(key, str) or not key.strip():
                _type(name + " requires nonempty keys")
            if name == "sectionVariants":
                if key in _BLOCKED or not isinstance(entry, str) or not entry.strip():
                    _type("sectionVariants requires safe section ids and exact nonempty variants")
            elif entry is not None and type(entry) not in (str, bool, int, float):
                _type("Override requires a JSON scalar or null")
            elif type(entry) in (int, float) and not math.isfinite(number(entry)):
                _type("Override requires a finite numeric scalar")
    return value


def _member(value, key):
    if key in _BLOCKED:
        raise CalcError("CALC-FORBIDDEN-PROP", "Forbidden property: " + key)
    if isinstance(value, dict):
        return value.get(key)
    if isinstance(value, list):
        if key == "length":
            return float(len(value))
        if key == "0" or key.isascii() and key.isdecimal() and not key.startswith("0"):
            if len(key) <= len(str(len(value))) and int(key) < len(value):
                return value[int(key)]
    return None


def _path(reference):
    result = reference.head
    for index, key in enumerate(reference.members, 1):
        result += "." + key if _IDENTIFIER.fullmatch(key) else "['" + key + "']"
        if reference.selector_after == index:
            result += "@" + reference.selector
    return result


class _Inputs:
    def __init__(self, document, context, roles, prior):
        self.document, self.context, self.roles, self.prior = document, context, roles, prior

    def section(self, section, *, period=False):
        if section.startswith("x_") or section in APPEND:
            return None
        blocks = [block for block in self.document.source.blocks
                  if block.section == section and not source_superseded(block)]
        if not blocks:
            return None
        parallel = section in PARALLEL or (any("_role" in block.parsed.value for block in blocks)
            and any("variant" in dict(block.attributes) for block in blocks))
        if parallel:
            latest = {}
            for block in blocks:
                latest[dict(block.attributes).get("variant")] = block
            if None in latest and "default" in latest:
                raise CalcUnavailable(section + ": unlabelled and literal-default identity requires the pending representation contract")
            available = {"default" if key is None else key: block for key, block in latest.items()}
        else:
            available = {dict(blocks[-1].attributes).get("variant"): blocks[-1]}
        code = "CALC-PERIOD-003" if period else "CALC-RESOLVE-002"
        def refuse(detail):
            found = ", ".join(sorted("(unkeyed)" if key is None else key for key in available))
            raise CalcError(code, section + ": " + detail + "; variants found: " + found)
        selected = None
        explicit = self.context.get("sectionVariants", {})
        if section in explicit:
            selected = available.get(explicit[section])
            if selected is None or ("_role" in selected.parsed.value and (not isinstance(selected.parsed.value["_role"], str) or selected.parsed.value["_role"] not in _ROLES)):
                refuse("explicit variant is absent or has an invalid role")
        elif not parallel:
            selected = next(iter(available.values()))
        else:
            eligible = {key: block for key, block in available.items()
                if "_role" not in block.parsed.value or isinstance(block.parsed.value["_role"], str) and block.parsed.value["_role"] in _ROLES - {"component"}}
            # Period references keep their own generic rule: no declaration role.
            preferred = None if period else self.roles.get(section)
            for role in (preferred, "primary"):
                if role is None:
                    continue
                matches = [block for block in eligible.values() if block.parsed.value.get("_role") == role]
                if len(matches) > 1:
                    refuse("consulted role " + role + " has multiple claimants")
                if matches:
                    selected = matches[0]
                    break
            if selected is None:
                selected = eligible.get("default") or eligible.get("base")
            if selected is None and len(eligible) == 1:
                selected = next(iter(eligible.values()))
            if selected is None:
                refuse("no unique eligible primary/default/base/sole statement")
        if dict(selected.attributes).get("external") == "true":
            raise CalcUnavailable(section + ": COMP-UNRESOLVED; externalized source is unavailable")
        # Expose underwriting payload, never metadata convenience wrappers.
        return {key: value for key, value in selected.parsed.value.items() if key not in _RESERVED}

    def resolve(self, reference):
        if any(key in _BLOCKED for key in (reference.head, *reference.members)):
            raise CalcError("CALC-FORBIDDEN-PROP", "Forbidden reference property")
        period = reference.selector is not None
        if period:
            if reference.selector_after != 1 or (reference.head, reference.members[0]) not in PERIOD_SERIES:
                raise CalcError("CALC-PERIOD-001", "Unregistered period series")
            parse_period_selector(reference.selector)  # Before override, not after lookup.
        path = _path(reference)
        overrides = self.context.get("overrides", {})
        if path in overrides:
            return overrides[path]
        if period:
            value = self.section(reference.head, period=True)
            if value is None:
                return None
            value = select_period_row(value, reference.head, reference.members[0], reference.selector)
            members = reference.members[1:]
        else:
            fm = self.document.frontmatter.value
            if reference.head in fm:
                value = fm[reference.head]
            else:
                value = self.section(reference.head)
                if value is None:
                    value = self.prior.get(reference.head)
            members = reference.members
        for key in members:
            value = _member(value, key)
        # Period path is a scalar expression surface; the standalone row resolver
        # may return a row, but an expression reading only that row returns null.
        return None if period and isinstance(value, (dict, list)) else value


def _kind(value):
    if type(value) in (int, float):
        return "number"
    return type(value)


def _binary(operator, left, right):
    if operator in ("==", "!="):
        if _kind(left) != _kind(right):
            equal = False
        elif isinstance(left, (dict, list)):
            equal = left is right
        else:
            equal = left == right
        return equal if operator == "==" else not equal
    if left is None or right is None:
        return None
    if operator in ("<", "<=", ">", ">="):
        if _kind(left) != _kind(right) or _kind(left) not in ("number", str):
            _type("Comparison requires operands of the same numeric or string type")
        if isinstance(left, str):
            left, right = (value.encode("utf-16-be", errors="surrogatepass") for value in (left, right))
        return {"<": lambda: left < right, "<=": lambda: left <= right,
                ">": lambda: left > right, ">=": lambda: left >= right}[operator]()
    if operator == "+" and isinstance(left, str) and isinstance(right, str):
        return left + right
    a, b = number(left), number(right)
    if operator in ("/", "%") and b == 0.0:
        raise CalcError("CALC-DIV-ZERO", "Division by zero")
    if operator == "+": return a + b
    if operator == "-": return a - b
    if operator == "*": return a * b
    if operator == "/": return a / b
    if operator == "%":
        # Existing remainder association, not Python's divisor-sign modulo.
        quotient = a / b
        integer = quotient if not math.isfinite(quotient) else float(math.trunc(quotient))
        return a - integer * b
    raise CalcError("CALC-PARSE-001", "Unknown expression operator")


class _Execution:
    MAX_NODES = 1024

    def __init__(self, inputs):
        self.inputs, self.visited = inputs, 0

    def run(self, node):
        self.visited += 1
        if self.visited > self.MAX_NODES:
            raise CalcError("CALC-LIMIT-001", "Expression exceeds host node limit")
        kind = node[0]
        if kind == "number": return float(node[1])
        if kind in ("string", "boolean"): return node[1]
        if kind == "null": return None
        if kind == "reference": return self.inputs.resolve(node[1])
        if kind == "call":
            name = node[1]
            if name in _BLOCKED:
                raise CalcError("CALC-FORBIDDEN-PROP", "Forbidden function property")
            if name not in BUILTINS:
                raise CalcError("CALC-RESOLVE-001", "Unknown function: " + name)
            return call_builtin(name, [self.run(argument) for argument in node[2]])
        if kind == "unary":
            value = self.run(node[2])
            if value is None:
                return None
            if node[1] == "-":
                return -number(value)
            if type(value) is not bool:
                _type("Logical negation requires a boolean or null")
            return not value
        if kind == "conditional":
            condition = self.run(node[1])
            if condition is None:
                return None
            if type(condition) is not bool:
                _type("Conditional requires a boolean or null")
            return self.run(node[2] if condition else node[3])
        if kind == "binary":
            operator, left = node[1], self.run(node[2])
            if operator in ("&&", "||"):
                if left is None:
                    return None
                if type(left) is not bool:
                    _type("Logical operator requires booleans or null")
                if operator == "&&" and not left or operator == "||" and left:
                    return left
                right = self.run(node[3])
                if right is not None and type(right) is not bool:
                    _type("Logical operator requires booleans or null")
                return right
            return _binary(operator, left, self.run(node[3]))
        raise CalcError("CALC-PARSE-001", "Unknown expression node")


def evaluate_expression(formula, document, *, context=None, roles=None, prior_results=None):
    """Unrounded expression result; raw exceptional values stay internal."""
    context = parse_context(context if context is not None else {})
    tree = parse_expression(formula)
    try:
        return _Execution(_Inputs(document, context, roles or {}, prior_results or {})).run(tree)
    except RecursionError as error:
        raise CalcError("CALC-LIMIT-001", "Expression exceeds host recursion resources") from error


def evaluate_calc(declaration, document, *, context=None, prior_results=None):
    """Single CalcResult; source/model/context remain read-only."""
    if not isinstance(declaration, dict) or not isinstance(declaration.get("id"), str) or not declaration["id"]:
        _type("Calculation requires a nonempty authored id")
    result = {"calc_id": declaration["id"], "ok": False, "value": None}
    unit = declaration.get("unit")
    if isinstance(unit, str):
        result["unit"] = unit
    try:
        if "unit" in declaration and not isinstance(unit, str):
            _type("Calculation unit requires a string")
        places = declaration.get("round_to", {"$": 2, "%": 6, "x": 4}.get(unit, 6))
        if type(places) not in (int, float) or not math.isfinite(places) or not float(places).is_integer() or not 0 <= places <= 12:
            _type("round_to requires an integer in [0,12]")
        result["round_to"] = int(places)
        roles = declaration.get("section_roles", {})
        if not isinstance(roles, dict) or any(not isinstance(key, str) or not isinstance(role, str) or role not in _ROLES for key, role in roles.items()):
            _type("section_roles requires registered role values")
        value = evaluate_expression(declaration.get("formula"), document, context=context, roles=roles,
                                    prior_results=prior_results)
        if type(value) in (int, float):
            try:
                value = quantize(value, int(places))
            except ValueError as error:
                raise CalcError("CALC-TYPE-001", "Calculation result is nonfinite or unrepresentable") from error
        if value is not None and type(value) not in (str, bool, int, float):
            _type("CalcResult requires a number, string, boolean or null")
        result.update(ok=True, value=value)
    except (CalcError, ExpressionError, PeriodError) as error:
        result["error"] = {"category": "calc", "code": error.code, "message": str(error)}
    return result
