"""Protocol VIII.1 parser and settled arithmetic subset; no eval/exec.

The AST covers the normative grammar. Evaluation intentionally refuses numerical
functions awaiting #356, and unsettled operator semantics are local blockers,
not invented Protocol errors or guessed JavaScript coercions.
"""
import math
import re

from uwmd_calendar import calendar_date
from uwmd_numeric import quantize
from uwmd_periods import BLOCKED, REGISTRY, resolve_period, select_section, selector
from uwmd_reader import ProtocolError


class IncompleteImplementation(ValueError):
    """An obligation is unimplemented; no conformance verdict is implied."""


class NumericalContractBlocked(IncompleteImplementation):
    """Issue #356 / draft RFC 0088 is unresolved."""


def error(code, message):
    raise ProtocolError(code, message, 'calc')


_TOKEN = re.compile(r"\s*(?:([0-9]+(?:\.[0-9]+)?)|('(?:[^']*)')|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|&&|\|\||[+*/%!?():,.\[\]@<>-]))")


class Parser:
    def __init__(self, text):
        if not isinstance(text, str):
            error('CALC-PARSE-001', 'Formula must be a string')
        self.tokens, offset, self.index = [], 0, 0
        while offset < len(text):
            if text[offset:].isspace():
                break
            if self.tokens and self.tokens[-1][1] == '@':
                period = re.match(r'\s*(Y[1-9][0-9]*|[0-9]{4}-(?:Q[1-4]|[0-9]{2}(?:-[0-9]{2})?))', text[offset:])
                if not period:
                    error('CALC-PARSE-001', 'Malformed period selector')
                self.tokens.append((4, period[1]))
                offset += period.end()
                continue
            match = _TOKEN.match(text, offset)
            if not match:
                error('CALC-PARSE-001', 'Outside safe grammar at offset ' + str(offset))
            kind = next(i for i, group in enumerate(match.groups()) if group is not None)
            self.tokens.append((kind, match[kind + 1]))
            offset = match.end()
        self.tokens.append((3, '<end>'))

    def peek(self):
        return self.tokens[self.index][1]

    def accept(self, token):
        if self.peek() == token:
            self.index += 1
            return True
        return False

    def require(self, token):
        if not self.accept(token):
            error('CALC-PARSE-001', 'Expected ' + token)

    def expression(self):
        value = self.binary(0)
        if self.accept('?'):
            yes = self.expression()
            self.require(':')
            value = ('conditional', value, yes, self.expression())
        return value

    def binary(self, level):
        groups = (('||',), ('&&',), ('==', '!=', '<=', '>=', '<', '>'), ('+', '-'), ('*', '/', '%'))
        if level == len(groups):
            if self.peek() in ('-', '!'):
                operator = self.peek()
                self.index += 1
                return ('unary', operator, self.primary())
            return self.primary()
        value = self.binary(level + 1)
        while self.peek() in groups[level]:
            operator = self.peek()
            self.index += 1
            value = ('binary', operator, value, self.binary(level + 1))
            if level == 2:
                break  # EBNF permits one comparison, not a chained comparison.
        return value

    def primary(self):
        if self.accept('('):
            result = self.expression()
            self.require(')')
            return result
        kind, token = self.tokens[self.index]
        self.index += 1
        if kind == 0:
            value = float(token)
            if not math.isfinite(value):
                error('CALC-TYPE-001', 'Nonfinite literal')
            return ('literal', value)
        if kind == 1:
            return ('literal', token[1:-1])
        if kind != 2:
            error('CALC-PARSE-001', 'Expected primary')
        if token in ('true', 'false', 'null'):
            return ('literal', {'true': True, 'false': False, 'null': None}[token])
        if self.accept('('):
            arguments = []
            if not self.accept(')'):
                while True:
                    arguments.append(self.expression())
                    if self.accept(')'):
                        break
                    self.require(',')
            return ('call', token, arguments)
        members, period, period_after = [], None, None
        while self.peek() in ('.', '[', '@'):
            if self.accept('@'):
                if not members or period is not None:
                    error('CALC-PARSE-001', 'One selector after a registered series path is required')
                token_kind, period = self.tokens[self.index]
                if token_kind != 4:
                    error('CALC-PARSE-001', 'Malformed period selector')
                self.index += 1
                selector(period)
                period_after = len(members)
            elif self.accept('.'):
                kind, member = self.tokens[self.index]
                if kind != 2:
                    error('CALC-PARSE-001', 'Expected member identifier')
                self.index += 1
                members.append(member)
            else:
                self.require('[')
                kind, member = self.tokens[self.index]
                if kind != 1:
                    error('CALC-PARSE-001', 'Only bracket-string keys are admitted')
                self.index += 1
                self.require(']')
                members.append(member[1:-1])
        if any(key in BLOCKED for key in (token, *members)):
            error('CALC-PARSE-001', 'Unsafe path segment')
        if period is not None:
            if period_after != 1 or (token, members[0]) not in REGISTRY:
                error('CALC-PERIOD-001', 'Selector path is not a registered series')
            return ('period', token, members[0], period, members[1:])
        return ('path', token, members)


def parse_expression(text):
    try:
        parser = Parser(text)
        tree = parser.expression()
        parser.require('<end>')
        return tree
    except (RecursionError, IndexError) as cause:
        error('CALC-PARSE-001', 'Expression cannot be parsed: ' + type(cause).__name__)


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        error('CALC-TYPE-001', 'Expected finite binary64 number')
    return float(value)


def boolean(value):
    if value is not None and not isinstance(value, bool):
        error('CALC-TYPE-001', 'Expected boolean or null')
    return value


def member_get(value, members):
    for key in members:
        if isinstance(value, dict):
            value = value.get(key)
        elif isinstance(value, list) and re.fullmatch(r'0|[1-9][0-9]*', key):
            value = value[int(key)] if int(key) < len(value) else None
        else:
            return None
    return value


def evaluate(tree, document, context=None, roles=None):
    context, roles = context or {}, roles or {}
    def visit(node):
        kind = node[0]
        if kind == 'literal':
            return node[1]
        if kind == 'path':
            head, members = node[1:]
            if head in document.frontmatter:
                value = document.frontmatter[head]
            elif any(b.annotation['section'] == head and not b.superseded for b in document.blocks):
                try:
                    block = select_section(document, head, context.get('sectionVariants', {}).get(head), roles.get(head))
                except ProtocolError as cause:
                    error('CALC-RESOLVE-002', str(cause))
                value = block.projection()['content'] if block else None
            else:
                value = context.get('prior_results', {}).get(head)
            return member_get(value, members)
        if kind == 'period':
            return resolve_period(document, *node[1:], variant=context.get('sectionVariants', {}).get(node[1]))
        if kind == 'unary':
            value = visit(node[2])
            if node[1] == '!':
                return None if boolean(value) is None else not value
            return None if value is None else -number(value)
        if kind == 'conditional':
            condition = boolean(visit(node[1]))
            if condition is None:
                raise IncompleteImplementation('Spec clarification needed: null ternary condition')
            return visit(node[2] if condition else node[3])
        if kind == 'binary':
            operator, left = node[1], visit(node[2])
            if operator in ('&&', '||'):
                boolean(left)
                if left is None:
                    return None
                if operator == '&&' and left is False or operator == '||' and left is True:
                    return left
                return boolean(visit(node[3]))
            right = visit(node[3])
            if operator in ('==', '!='):
                if isinstance(left, (dict, list)) or isinstance(right, (dict, list)):
                    raise IncompleteImplementation('Spec clarification needed: collection equality')
                # Avoid Python's bool == number coercion; scalar equality is typed.
                same_type = type(left) is type(right) or all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (left, right))
                result = same_type and left == right
                return result if operator == '==' else not result
            if left is None or right is None:
                return None
            if operator in ('<', '>', '<=', '>='):
                left, right = number(left), number(right)
                return {'<': left < right, '>': left > right, '<=': left <= right, '>=': left >= right}[operator]
            left, right = number(left), number(right)
            if operator in ('/', '%') and right == 0:
                error('CALC-DIV-ZERO', 'Division by zero')
            if operator == '+':
                value = left + right
            elif operator == '-':
                value = left - right
            elif operator == '*':
                value = left * right
            elif operator == '/':
                value = left / right
            else:
                raise IncompleteImplementation('Spec clarification needed: remainder for negative operands')
            return number(value)
        if kind == 'call':
            name, args = node[1], [visit(arg) for arg in node[2]]  # builtins are eager
            if name in ('pow', 'log', 'exp', 'nper', 'pmt', 'fv', 'pv', 'npv', 'irr', 'xirr', 'xnpv'):
                raise NumericalContractBlocked(name + ': blocked by Issue #356 / draft RFC 0088')
            if name == 'is_calendar_date':
                if len(args) != 1:
                    error('CALC-TYPE-001', 'is_calendar_date takes one argument')
                return calendar_date(args[0])
            if name == 'coalesce':
                return next((value for value in args if value is not None), None)
            if name == 'if':
                if len(args) != 3 or not isinstance(args[0], bool):
                    error('CALC-TYPE-001', 'if requires boolean condition and two branches')
                return args[1] if args[0] else args[2]
            if name in ('sum', 'avg', 'min', 'max'):
                values = [number(value) for value in args if value is not None]
                if not values:
                    return 0.0 if name == 'sum' else None
                if name in ('min', 'max'):
                    return (min if name == 'min' else max)(values)
                total = 0.0
                for value in values:
                    total = number(total + value)
                return total / len(values) if name == 'avg' else total
            if name in ('abs', 'floor', 'ceil', 'sqrt', 'round'):
                if len(args) != (2 if name == 'round' else 1):
                    error('CALC-TYPE-001', 'Wrong builtin arity')
                if any(value is None for value in args):
                    return None
                value = number(args[0])
                if name == 'round':
                    places = number(args[1])
                    if not places.is_integer() or not -12 <= places <= 12:
                        error('CALC-TYPE-001', 'Invalid decimal places')
                    return quantize(value, int(places))
                if name == 'sqrt' and value < 0:
                    error('CALC-TYPE-001', 'Negative square root')
                return {'abs': abs, 'floor': math.floor, 'ceil': math.ceil, 'sqrt': math.sqrt}[name](value)
            raise IncompleteImplementation('Unimplemented builtin: ' + name)
        raise IncompleteImplementation('Unknown AST node')
    return visit(tree)


def calculate(document, declaration, context=None):
    result = {'calc_id': declaration.get('id', ''), 'ok': False, 'value': None}
    if 'unit' in declaration:
        result['unit'] = declaration['unit']
    try:
        tree = parse_expression(declaration.get('formula'))
        value = evaluate(tree, document, context, declaration.get('section_roles'))
        if isinstance(value, (dict, list)):
            error('CALC-TYPE-001', 'Calc result must be scalar')
        places = declaration.get('round_to', {'$': 2, '%': 6, 'x': 4}.get(declaration.get('unit'), 6))
        if isinstance(places, bool) or not isinstance(places, (int, float)) or not math.isfinite(places) or int(places) != places or not 0 <= places <= 12:
            error('CALC-TYPE-001', 'round_to must be an integer from 0 through 12')
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            value = quantize(number(value), int(places))
        result.update(ok=True, value=value, round_to=int(places))
        if 'unit' in declaration:
            result['unit'] = declaration['unit']
    except ProtocolError as cause:
        result['error'] = cause.as_dict()
    # Local blocked/incomplete exceptions deliberately escape; caller must not
    # turn them into a claimed failed financial comparison or made-up code.
    return result
