"""WIP validator adapter for accepted RFC0097 main-safe config admission."""
from uwmd_institution_config import _load_institution_config,_institution_threshold_map,_FV_ERRORS
from uwmd_validation_cross import _default_threshold_bands


def load_institution_policy(document_path,explicit_path=None):
    """Complete admission once, then the threshold bands and escalated FV codes.

    RFC 0109 D3: `financial_validity_errors` lists the FV codes whose error band
    is an ordinary error issue rather than a deal flag; absent means none.
    """
    admitted=_load_institution_config(document_path,explicit_path)
    return dict(thresholds=_institution_threshold_map(admitted,_default_threshold_bands()),
                financial_validity_errors=tuple(admitted.get(_FV_ERRORS,())))


def load_institution_thresholds(document_path,explicit_path=None):
    """Complete admission first, then fresh affected bands from existing defaults."""
    return load_institution_policy(document_path,explicit_path)["thresholds"]
