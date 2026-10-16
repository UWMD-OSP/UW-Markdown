"""Exact identity and selection from Protocol VIII.2/2a; never infer periods."""
import math
import re

from uwmd_calendar import calendar_date
from uwmd_reader import PARALLEL, ProtocolError

ROLES = frozenset(('primary', 'senior', 'junior', 'summary', 'detail', 'component'))
REGISTRY = {
    ('dcf', 'annual_cash_flows'): ('rows', 'year', 'year'),
    ('noi_model', 'projections'): ('keyed', None, 'year'),
    ('lease_up_schedule', 'schedule'): ('rows', 'period', 'calendar'),
    ('cash_flow_series', 'series'): ('rows', 'date', 'date'),
    ('distribution_waterfall', 'stated_schedule'): ('rows', 'date', 'date'),
}
BLOCKED = frozenset(('constructor', 'prototype', '__proto__'))


def refuse(code, message):
    raise ProtocolError(code, message, 'calc')


def selector(text):
    if re.fullmatch(r'Y[1-9][0-9]*', text) and int(text[1:]) <= 9007199254740991:
        return ('year', int(text[1:]))
    if re.fullmatch(r'[0-9]{4}-Q[1-4]', text):
        return ('quarter', int(text[:4]), int(text[-1]))
    if re.fullmatch(r'[0-9]{4}-(0[1-9]|1[0-2])', text):
        return ('month', int(text[:4]), int(text[-2:]))
    if calendar_date(text):
        return ('date', text)
    refuse('CALC-PERIOD-001', 'Invalid period selector: ' + text)


def period_key(value, kind, keyed=False):
    if value is None:
        return None
    if kind == 'year':
        if keyed:
            if not isinstance(value, str) or not re.fullmatch(r'year_[0-9]+', value):
                refuse('CALC-PERIOD-001', 'Malformed year key')
            value = int(value[5:])
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 1 <= value <= 9007199254740991 or int(value) != value:
            refuse('CALC-PERIOD-001', 'Year identity must be a positive safe integer')
        return ('year', int(value))
    if not isinstance(value, str):
        refuse('CALC-PERIOD-001', 'Expected stated calendar identity')
    result = selector(value)
    if result[0] not in (('month', 'quarter') if kind == 'calendar' else (kind,)):
        refuse('CALC-PERIOD-001', 'Wrong period kind')
    return result


def select_section(document, section, variant=None, role=None):
    blocks = [b for b in document.blocks if b.annotation['section'] == section and not b.superseded]
    if not blocks:
        return None
    # Match Reader routing before role selection; role-free singleton uses last.
    parallel = section in PARALLEL or (any('_role' in b.body for b in blocks) and any('variant' in b.annotation for b in blocks))
    routed = {}
    for block in blocks:
        routed[block.annotation.get('variant', 'default') if parallel else 'default'] = block
    def bad(message):
        refuse('CALC-PERIOD-003', f'{section}: {message}; variants: {list(routed)}')
    if variant is not None:
        candidates = [b for b in blocks if b.annotation.get('variant', 'default') == variant]
        if not candidates:
            bad('explicit variant absent')
        block = candidates[-1]
        if '_role' in block.body and (not isinstance(block.body['_role'], str) or block.body['_role'] not in ROLES):
            bad('invalid role')
        return block
    eligible = {key: b for key, b in routed.items()
                if '_role' not in b.body or isinstance(b.body['_role'], str) and b.body['_role'] in ROLES - {'component'}}
    for desired in (role, 'primary'):
        if desired is None:
            continue
        matches = [b for b in eligible.values() if b.body.get('_role') == desired]
        if len(matches) > 1:
            bad('role collision: ' + desired)
        if matches:
            return matches[0]
    for key in ('default', 'base'):
        if key in eligible:
            return eligible[key]
    if len(eligible) == 1:
        return next(iter(eligible.values()))
    bad('no unique eligible block')


def inspect_series(block, section, series):
    """Return all (identity, row) pairs; inspect every row before selection."""
    shape, field, kind = REGISTRY[section, series]
    value = block.body.get(series)
    if value is None:
        return []
    if not isinstance(value, list if shape == 'rows' else dict):
        refuse('CALC-PERIOD-001', 'Malformed registered series')
    cadence = block.body.get('period_granularity')
    if kind == 'calendar' and cadence not in ('monthly', 'quarterly'):
        refuse('CALC-PERIOD-001', 'Missing or invalid cadence')
    result = []
    for key, row in (enumerate(value) if shape == 'rows' else value.items()):
        if not isinstance(row, dict):
            refuse('CALC-PERIOD-001', 'Series row must be an object')
        identity = period_key(key if shape == 'keyed' else row.get(field), kind, shape == 'keyed')
        if identity and kind == 'calendar' and identity[0] != {'monthly': 'month', 'quarterly': 'quarter'}[cadence]:
            refuse('CALC-PERIOD-001', 'Period disagrees with cadence')
        result.append((identity, row))
    return result


def resolve_period(document, section, series, requested, leaf=(), variant=None, overrides=None):
    if (section, series) not in REGISTRY or any(key in BLOCKED for key in (section, series, *leaf)):
        refuse('CALC-PERIOD-001', 'Invalid registered period path')
    identity = selector(requested)
    # Full-path override keys use the caller's parsed, canonical reference tuple.
    address = (section, series, identity, tuple(leaf))
    if overrides is not None and address in overrides:
        return overrides[address]
    block = select_section(document, section, variant)
    if block is None:
        return None
    rows = inspect_series(block, section, series)
    counts = {}
    for key, _ in rows:
        if key is not None:
            counts[key] = counts.get(key, 0) + 1
    if any(count > 1 and (section != 'cash_flow_series' or key == identity) for key, count in counts.items()):
        refuse('CALC-PERIOD-002', 'Duplicate canonical period identity')
    value = next((row for key, row in rows if key == identity), None)
    for key in leaf:
        if isinstance(value, dict):
            value = value.get(key)
        elif isinstance(value, list) and re.fullmatch(r'0|[1-9][0-9]*', key):
            value = value[int(key)] if int(key) < len(value) else None
        else:
            return None
    return value
