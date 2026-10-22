"""Verification rule sets (RFC 0111, Protocol XII.5).

A record's declared Format version (``uw_version``) names the rule set it is
verified under. This implementation keeps one, Format 3.0. Selection never
falls back: a declaration naming no kept rule set is refused with
``UNSUPPORTED_FORMAT_VERSION``, for a document model as for source.
"""
from uwmd_reader import ReaderError

RULE_SETS = ("3.0",)


def rule_set_for(frontmatter):
    """The rule set a frontmatter mapping's declared ``uw_version`` names."""
    declared = frontmatter.get("uw_version")
    if not isinstance(declared, str) or declared not in RULE_SETS:
        raise ReaderError("UNSUPPORTED_FORMAT_VERSION",
                          "declared uw_version is " + repr(declared) + "; supported value is '3.0'")
    return declared
