"""Partial structural checks only; never a complete ValidationResult verdict.

Format II.4/5/8 and Protocol III.6a/VIII.2a. Other validation families,
financial cross-checks, stated-figure verifiers and receipts remain unimplemented.
"""
from uwmd_periods import REGISTRY, ROLES, inspect_series
from uwmd_reader import ProtocolError


def validate(document):
    issues = []
    def issue(code, message, pointer, severity='error'):
        issues.append(dict(code=code, severity=severity, message=message, pointer=pointer))
    for index, block in enumerate(document.blocks):
        section = block.annotation['section']
        pointer = f'blocks[{index}]'
        meta = block.body.get('_meta')
        if not isinstance(meta, dict):
            issue('META_MISSING', 'Missing metadata object', pointer)
            continue
        if (next(iter(block.body), None) != '_meta' or 'section_id' in block.body
                or not isinstance(meta.get('provenance'), dict)
                or not isinstance(meta.get('lifecycle'), dict)
                or meta.get('section') != section):
            issue('META-01', 'Invalid Format 3.0 block shape or section identity', pointer)
        paths = {'SECTION': ('section',), 'VERSION': ('lifecycle', 'revision'),
                 'SOURCE': ('provenance', 'source'), 'TIMESTAMP': ('provenance', 'timestamp'),
                 'CONFIDENCE': ('quality', 'confidence')}
        for name, path in paths.items():
            value = meta
            for key in path:
                value = value.get(key) if isinstance(value, dict) else None
            if value is None:
                issue('META_FIELD_MISSING_' + name, 'Required metadata field absent', pointer + '._meta.' + '.'.join(path))
        quality = meta.get('quality', {})
        if isinstance(quality, dict) and quality.get('confidence') == 'low' and quality.get('human_review_required') is not True:
            issue('META_LOW_CONFIDENCE_NO_REVIEW_FLAG', 'Low confidence requires human review', pointer, 'info')
        if block.superseded:
            continue
        if '_role' in block.body and (not isinstance(block.body['_role'], str) or block.body['_role'] not in ROLES):
            issue('ROLE-01', 'Invalid active block role', pointer + '._role')
        for registered_section, series in REGISTRY:
            if registered_section != section or block.body.get(series) is None:
                continue
            try:
                rows = inspect_series(block, section, series)
            except ProtocolError:
                issue('PS-01', 'Malformed registered period series', pointer + '.' + series, 'warning')
                continue
            if any(identity is None for identity, _ in rows):
                issue('PS-01', 'Missing registered row period', pointer + '.' + series, 'warning')
            counts = {}
            for identity, _ in rows:
                if identity is not None:
                    counts[identity] = counts.get(identity, 0) + 1
            if section != 'cash_flow_series':
                for identity, count in counts.items():
                    if count > 1:
                        issue('PS-02', f'Duplicate canonical period {identity}', pointer + '.' + series)
    return {'issues': issues, 'complete': False,
            'verification_state': 'unverifiable',
            'implemented_checks': ['META-01', 'META_*', 'ROLE-01', 'PS-01', 'PS-02'],
            'limitations': ['Partial structural checks only; no complete validation or financial verdict',
                            'PS-03 and all other validation families remain unimplemented',
                            'Protocol II.2 metric, stated-figure and receipt obligations remain incomplete',
                            'Issue #356 / draft RFC 0088 blocks affected numerical procedures']}
