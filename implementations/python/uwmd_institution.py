"""Bounded filesystem institution threshold input for the developing CLI.

Only the three Format Appendix C.6 flat overrides are implemented. This is no
config schema, workflow engine or approved malformed-config refusal policy.
Pure validation APIs remain caller-supplied maps with no filesystem access.
"""
from pathlib import Path

from uwmd_binding_sources import finite
from uwmd_source import SourceError, parse_json_source
from uwmd_validation_cross import _default_threshold_bands
from uwmd_validation_selection import ValidationUnavailable

_OVERRIDES = {
    "dscr_warning_below":("dscr","warning_below"),
    "ltv_warning_above":("ltv","warning_above"),
    "debt_yield_warning_below":("debt_yield","warning_below"),
}


def _unavailable(reason):
    return ValidationUnavailable("Institution config is unavailable or unsupported; complete validation is unavailable "
                                 "(local development boundary, no normative config verdict): "+reason)


def load_institution_thresholds(document_path, explicit_path=None):
    """Read one selected file; absence is silent only for automatic discovery.

    Explicit paths resolve from cwd; discovery is adjacent to the actual input
    document. Unknown data is not assigned a closed vocabulary or coerced.
    Malformed/unsupported inputs remain LOCAL incomplete implementation evidence.
    """
    path=(Path(explicit_path).resolve() if explicit_path is not None else
          Path(document_path).resolve().parent/".uw.institution.json")
    try:
        raw=path.read_bytes()
    except FileNotFoundError as error:
        if explicit_path is None:
            return {}
        raise _unavailable("the explicitly selected file cannot be read") from error
    except OSError as error:
        raise _unavailable("the selected file cannot be read") from error
    try:
        config=parse_json_source(raw).value
    except SourceError as error:
        raise _unavailable("the selected file is not supported JSON") from error
    if not isinstance(config,dict):
        raise _unavailable("the supplied root is not an object")
    # A supplied nested carrier is not an alternate wire spelling. Its policy
    # is unclosed; do not silently choose a carrier or authenticate a default.
    if "thresholds" in config:
        raise _unavailable("the nested thresholds carrier is not implemented as a config input")
    if "validation_overrides" not in config:
        return {}
    overrides=config["validation_overrides"]
    if not isinstance(overrides,dict):
        raise _unavailable("the supplied validation_overrides is not an object")
    defaults=_default_threshold_bands(); selected={}
    for name,(family,bound) in _OVERRIDES.items():
        if name not in overrides:
            continue
        value=overrides[name]
        if not finite(value):
            raise _unavailable("a supported override is not a finite JSON number")
        if family not in selected:
            selected[family]=dict(defaults[family])
        selected[family][bound]=value
    return selected
