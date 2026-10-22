"""The one place Python reads normative spec data (schemas, metric dictionary).

`validate` needs a few files under the standard's `spec/` directory. They are
read from the directory this resolver names, never copied into this package:

1. `UWMD_SPEC_DIR`, when set, names the `spec/` directory explicitly. Use it
   when this implementation runs outside a repository checkout.
2. Otherwise the checkout-relative `../../spec` next to this file.

A directory that does not hold the needed file is a `SpecDataError` naming
both the path and the override, not a silent default or an empty schema.
"""
from functools import lru_cache
import json
import os
from pathlib import Path


ENVIRONMENT = "UWMD_SPEC_DIR"
_CHECKOUT = Path(__file__).resolve().parents[2] / "spec"


class SpecDataError(RuntimeError):
    """Normative spec data is unavailable at the resolved directory."""


def spec_dir():
    """The resolved `spec/` directory: the override when set, else the checkout."""
    override = os.environ.get(ENVIRONMENT)
    return Path(override) if override else _CHECKOUT


@lru_cache(maxsize=None)
def _load(directory, relative):
    path = Path(directory) / relative
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        raise SpecDataError(
            "Normative spec file " + str(path) + " is unavailable; set " + ENVIRONMENT
            + " to the standard's spec/ directory") from error
    return json.loads(text)


def spec_json(relative):
    """Parsed JSON of `spec/<relative>` (POSIX separators). Callers must not mutate it."""
    return _load(str(spec_dir()), relative)


def schema(filename):
    return spec_json("schemas/" + filename)


def metric_dictionary():
    return spec_json("metrics/builtin.json")
