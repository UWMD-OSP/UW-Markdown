"""Independent document currency assertion check (Protocol III.1b/RFC0046).

A narrow nonnormative report, not full frontmatter validation or denomination
inference. Existing V.12 explicitly admits absent/null monetary identity.
"""
import copy
import re


_CURRENCY = re.compile(r"[A-Z]{3}\Z")


def inspect_document_currency(document):
    """Preserve authored identity exactly; no locale/registry/financial lookup."""
    frontmatter = copy.deepcopy(document.frontmatter.value)
    authored = "currency_code" in frontmatter
    evidence = dict(authored=authored)
    issues = []
    if authored:
        value = frontmatter["currency_code"]
        evidence["value"] = value
        # Protocol V.12.2 explicitly distinguishes authored non-null malformed
        # currency from absent/null identity; neither supplies a default value.
        if value is not None and (not isinstance(value, str) or _CURRENCY.fullmatch(value) is None):
            issues.append(dict(code="CUR-01", severity="error", section="frontmatter",
                field="currency_code", message="Currency identity must be exactly three uppercase ASCII letters."))
    return dict(scope="document_currency_identity", ok=not issues, issues=issues, evidence=evidence)
