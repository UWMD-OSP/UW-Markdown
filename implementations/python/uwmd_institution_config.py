"""Private RFC0097 config admission and file selection, independent of validation.

Only admitted recognized leaves become binary64. Opaque JSON numbers retain
lexical tokens; this parser neither canonicalizes nor reserializes configuration.
No document/validator/defaults/schema/receipt module is imported.
"""
import copy
from dataclasses import dataclass
import json
import math
import os
from pathlib import Path


_UNREADABLE="VAL-INSTITUTION-CONFIG-UNREADABLE"
_MALFORMED="VAL-INSTITUTION-CONFIG-MALFORMED"
_MESSAGES={_UNREADABLE:"Selected institution config could not be read.",
           _MALFORMED:"Selected institution config is malformed."}
_MEMBERS=(("dscr_warning_below","dscr","warning_below"),
          ("ltv_warning_above","ltv","warning_above"),
          ("debt_yield_warning_below","debt_yield","warning_below"))


class _InstitutionConfigError(ValueError):
    """A closed operation error; no config bytes or parser/OS cause is exposed."""
    def __init__(self,code,pointer=None):
        super().__init__(_MESSAGES[code]);self.code=code;self.pointer=pointer

    def projection(self):
        value=dict(category="validate",code=self.code,message=str(self))
        if self.pointer is not None:value["pointer"]=self.pointer
        return value


class _JSONProfileError(ValueError):
    pass


@dataclass(frozen=True)
class _Number:
    spelling:str


def _pairs(pairs):
    value={}
    for key,item in pairs:
        if key in value:raise _JSONProfileError()
        value[key]=item
    return value


def _constant(_):
    raise _JSONProfileError()


def _scalar_strings(value):
    """Check all decoded keys/strings without imposing a new depth bound."""
    pending=[value]
    while pending:
        item=pending.pop()
        if isinstance(item,str):item.encode("utf8",errors="strict")
        elif isinstance(item,dict):
            pending.extend(item.keys());pending.extend(item.values())
        elif isinstance(item,list):pending.extend(item)


def _parse_institution_config(raw):
    """Return the atomic recognized flat map; opaque values are never applied."""
    if not isinstance(raw,bytes):raise TypeError("Config admission requires actual bytes")
    try:
        text=raw.decode("utf8",errors="strict")
        # json.loads accepts only JSON whitespace; a BOM is explicitly forbidden.
        if text.startswith("\ufeff"):raise _JSONProfileError()
        value=json.loads(text,object_pairs_hook=_pairs,parse_int=_Number,
                         parse_float=_Number,parse_constant=_constant)
        _scalar_strings(value)
    except (UnicodeError,json.JSONDecodeError,_JSONProfileError):
        raise _InstitutionConfigError(_MALFORMED) from None
    # Resource/runtime errors intentionally retain the caller's internal-error
    # boundary. No local nesting/digit ceiling is a new MALFORMED profile rule.
    if not isinstance(value,dict):raise _InstitutionConfigError(_MALFORMED)
    if "thresholds" in value:raise _InstitutionConfigError(_MALFORMED,"thresholds")
    if "validation_overrides" not in value:return {}
    carrier=value["validation_overrides"]
    if not isinstance(carrier,dict):
        raise _InstitutionConfigError(_MALFORMED,"validation_overrides")
    admitted={}
    for name,_,_ in _MEMBERS:
        if name not in carrier:continue
        leaf=carrier[name]
        pointer="validation_overrides."+name
        if not isinstance(leaf,_Number):raise _InstitutionConfigError(_MALFORMED,pointer)
        number=float(leaf.spelling)
        if not math.isfinite(number):raise _InstitutionConfigError(_MALFORMED,pointer)
        admitted[name]=number
    return admitted


def _load_institution_config(document_path,explicit_path=None):
    """Read exactly one lexically selected path, then complete config admission."""
    path=(Path(os.path.abspath(os.fspath(explicit_path))) if explicit_path is not None else
          Path(os.path.abspath(os.fspath(document_path))).parent/".uw.institution.json")
    try:
        raw=path.read_bytes()
    except FileNotFoundError:
        # A dangling selected link is not automatic absence. Classify the read
        # outcome, rather than avoiding it with an exists-only preflight.
        if explicit_path is None and not os.path.lexists(path):return {}
        raise _InstitutionConfigError(_UNREADABLE) from None
    except OSError:
        raise _InstitutionConfigError(_UNREADABLE) from None
    return _parse_institution_config(raw)


def _institution_threshold_map(admitted,defaults):
    """Fresh affected bands from caller-owned defaults; no hidden defaults I/O."""
    result={}
    for name,family,bound in _MEMBERS:
        if name not in admitted:continue
        if family not in result:result[family]=copy.deepcopy(defaults[family])
        result[family][bound]=admitted[name]
    return result
