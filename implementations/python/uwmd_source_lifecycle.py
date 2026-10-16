"""Historical source flags without mutating the retained Reader/raw projection."""
from uwmd_reader import _superseded


def source_superseded(block):
    return _superseded(block) or dict(block.attributes).get("superseded") == "true"
