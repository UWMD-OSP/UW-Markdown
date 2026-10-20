"""WIP validator adapter for accepted RFC0097 main-safe config admission."""
from uwmd_institution_config import _load_institution_config,_institution_threshold_map
from uwmd_validation_cross import _default_threshold_bands


def load_institution_thresholds(document_path,explicit_path=None):
    """Complete admission first, then fresh affected bands from existing defaults."""
    admitted=_load_institution_config(document_path,explicit_path)
    return _institution_threshold_map(admitted,_default_threshold_bands())
