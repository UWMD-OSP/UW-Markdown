"""Shared read-only section selection and three-state result assembly (II.6a)."""
from uwmd_calc_errors import CalcError
from uwmd_validation_selection import current_blocks, select_section, is_externalized
from uwmd_source_validation import BLOCK_ROLES


def selected(document, section, variant=None, *, period=False):
    blocks=current_blocks(document,section,include_external=True)
    if not blocks:
        return None
    code='CALC-PERIOD-003' if period else 'CALC-RESOLVE-002'
    if variant is not None:
        block=next((b for b in blocks if dict(b.attributes).get('variant','default')==variant),None)
        if block is None or ('_role' in block.parsed.value and block.parsed.value['_role'] not in BLOCK_ROLES):
            raise CalcError(code,'Selected variant is absent or has an invalid role')
    else:
        selection=select_section(document,section)
        block=selection.block
        if block is None:
            raise CalcError(code,selection.detail)
    if is_externalized(block):
        raise CalcError(code,'Selected section is externalized and unresolved')
    return block


def result(issues, **extra):
    verdict=('failed' if any(i['severity']=='failure' for i in issues) else
             'unverifiable' if issues else 'verified')
    return dict(verdict=verdict,issues=issues,**extra)


def finding(code, severity, message, **extra):
    return dict(code=code,severity=severity,message=message,**extra)
