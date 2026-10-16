"""Independent Protocol VIII.1 grammar and VIII.2a reference structure.

No evaluation, source lookup, financial math or CLI capability. The recovery
experiment supplied grammar concepts only; numeric literals retain spelling.
AST tuples and reference records are immutable. Inventory follows syntax order,
including branches a future evaluator might short-circuit.
"""
from dataclasses import dataclass
import re

from uwmd_periods import PERIOD_SERIES, PeriodError, parse_period_selector


class ExpressionError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _refuse(message, code="CALC-PARSE-001"):
    raise ExpressionError(code, message)


@dataclass(frozen=True)
class Reference:
    head: str
    members: tuple[str, ...] = ()
    selector: str | None = None
    selector_after: int | None = None


_TOKEN = re.compile(r"\s*(?:([0-9]+(?:\.[0-9]+)?)|('(?:[^']*)')|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|&&|\|\||[+*/%!?():,.\[\]@<>-]))")
_PERIOD = re.compile(r"\s*(Y[1-9][0-9]*|[0-9]{4}-(?:Q[1-4]|[0-9]{2}(?:-[0-9]{2})?))")
_BINARY = (("||",), ("&&",), ("==", "!=", "<=", ">=", "<", ">"), ("+", "-"), ("*", "/", "%"))
_BLOCKED = frozenset(("constructor", "prototype", "__proto__"))


class _Parser:
    # Explicit host resource limits, not normative language restrictions.
    MAX_TOKENS = 10000
    MAX_DEPTH = 64

    def __init__(self, text):
        if not isinstance(text, str):
            _refuse("expression must be a string")
        self.tokens, self.index, self.depth = [], 0, 0
        offset = 0
        while offset < len(text):
            if text[offset:].isspace():
                break
            if len(self.tokens) >= self.MAX_TOKENS:
                _refuse("expression exceeds host token limit", "CALC-LIMIT-001")
            if self.tokens and self.tokens[-1] == ("symbol", "@"):
                period = _PERIOD.match(text, offset)
                if period is None:
                    _refuse("expected a period selector")
                self.tokens.append(("period", period[1]))
                offset = period.end()
                continue
            match = _TOKEN.match(text, offset)
            if match is None:
                _refuse("outside safe-expression grammar at character " + str(offset))
            kind = next(index for index, group in enumerate(match.groups()) if group is not None)
            self.tokens.append((("number", "string", "identifier", "symbol")[kind], match[kind + 1]))
            offset = match.end()
        self.tokens.append(("end", ""))

    def peek(self):
        return self.tokens[self.index]

    def accept(self, text):
        if self.peek() == ("symbol", text):
            self.index += 1
            return True
        return False

    def require(self, text):
        if not self.accept(text):
            _refuse("expected " + repr(text))

    def expression(self):
        self.depth += 1
        if self.depth > self.MAX_DEPTH:
            _refuse("expression exceeds host nesting limit", "CALC-LIMIT-001")
        try:
            result = self.binary(0)
            if self.accept("?"):
                yes = self.expression()
                self.require(":")
                result = ("conditional", result, yes, self.expression())
            return result
        finally:
            self.depth -= 1

    def binary(self, level):
        if level == len(_BINARY):
            if self.peek() in (("symbol", "-"), ("symbol", "!")):
                operator = self.peek()[1]
                self.index += 1
                return ("unary", operator, self.primary())
            return self.primary()
        value = self.binary(level + 1)
        while self.peek()[0] == "symbol" and self.peek()[1] in _BINARY[level]:
            operator = self.peek()[1]
            self.index += 1
            value = ("binary", operator, value, self.binary(level + 1))
            if level == 2:
                break  # EBNF comparison has ?, unlike the other levels' *.
        return value

    def primary(self):
        if self.accept("("):
            value = self.expression()
            self.require(")")
            return value
        kind, token = self.peek()
        if kind == "number":
            self.index += 1
            return ("number", token)
        if kind == "string":
            self.index += 1
            return ("string", token[1:-1])
        if kind != "identifier":
            _refuse("expected expression primary")
        self.index += 1
        if token in ("true", "false"):
            return ("boolean", token == "true")
        if token == "null":
            return ("null",)
        if self.accept("("):
            arguments = []
            if not self.accept(")"):
                while True:
                    arguments.append(self.expression())
                    if self.accept(")"):
                        break
                    self.require(",")
            return ("call", token, tuple(arguments))
        head, members, selector, selector_after = token, [], None, None
        while self.peek() in (("symbol", "."), ("symbol", "["), ("symbol", "@")):
            if self.accept("."):
                if self.peek()[0] != "identifier":
                    _refuse("expected member identifier")
                members.append(self.peek()[1])
                self.index += 1
            elif self.accept("["):
                if self.peek()[0] != "string":
                    _refuse("only bracket-string members are in the grammar")
                members.append(self.peek()[1][1:-1])
                self.index += 1
                self.require("]")
            else:
                self.require("@")
                if not members or selector is not None or self.peek()[0] != "period":
                    _refuse("one selector must follow a section-member path")
                selector, selector_after = self.peek()[1], len(members)
                self.index += 1
        return ("reference", Reference(head, tuple(members), selector, selector_after))


def parse_expression(text):
    """Parse grammar only. Numbers remain lexical; nothing is evaluated."""
    try:
        parser = _Parser(text)
        tree = parser.expression()
        if parser.peek()[0] != "end":
            _refuse("unexpected trailing expression input")
        return tree
    except RecursionError as error:
        raise ExpressionError("CALC-LIMIT-001", "expression exceeds host recursion resources") from error


def expression_references(tree):
    """All static references in syntax order, preserving duplicates.

    This is neither dependency evaluation nor a refinement graph. Literal dotted
    keys remain distinct from multiple member segments; calls contribute only
    references in arguments, never their function names.
    """
    references, pending = [], [tree]
    while pending:
        node = pending.pop()
        kind = node[0]
        if kind == "reference":
            references.append(node[1])
        elif kind == "unary":
            pending.append(node[2])
        elif kind == "binary":
            pending.extend((node[3], node[2]))
        elif kind == "conditional":
            pending.extend((node[3], node[2], node[1]))
        elif kind == "call":
            pending.extend(reversed(node[2]))
    return tuple(references)


def check_reference_structure(tree):
    """Check static path safety and registered period syntax without resolving.

    Unregistered period paths and invalid calendar/range selectors have existing
    CALC-PERIOD-001. No role, variant, input availability or function check.
    """
    for reference in expression_references(tree):
        if any(key in _BLOCKED for key in (reference.head, *reference.members)):
            _refuse("blocked path segment")
        if reference.selector is not None:
            if reference.selector_after != 1 or (reference.head, reference.members[0]) not in PERIOD_SERIES:
                _refuse("unregistered period series path", "CALC-PERIOD-001")
            try:
                parse_period_selector(reference.selector)
            except PeriodError as error:
                raise ExpressionError(error.code, str(error)) from error
