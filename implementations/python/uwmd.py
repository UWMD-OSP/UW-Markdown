"""Node-free structured CLI; discovery remains parse-only without a tier."""
import asyncio
import json
from pathlib import Path
import sys

from uwmd_reader import parse
from uwmd_source import SourceError, parse_json_source
from uwmd_reserves import verify_reserve_accounts
from uwmd_reserve_draws import verify_reserve_draw_bindings
from uwmd_replacement_funding import replacement_funding_report
from uwmd_block_integrity import BlockIntegrityError, verify_block_integrity
from uwmd_source_validation import _inspect_source_roles_source
from uwmd_currency import inspect_document_currency
from uwmd_validation import _validate_source
from uwmd_validation_selection import ValidationUnavailable


def _validation_response(result):
    """Separate accepted output from local unsupported-input evidence.

    These refusals are not a new ValidationResult state or diagnostic allocation.
    Unallocated requirements cannot become a successful partial validation.
    """
    local = ("composition_assessment", "metadata_assessment", "section_assessment")
    structural = {key: value for key, value in result.items() if key not in local}
    if structural.get("replacement_funding_verification") is None:
        structural.pop("replacement_funding_verification", None)
    composition = result["composition_assessment"]
    if composition["status"] != "resolved":
        # Preserve the first existing issue, including an earlier section's
        # unresolved result. Directive admission precedes lookup per section,
        # not as a new global priority over every unresolved section.
        error = (dict(composition["issues"][0]) if composition["issues"] else
                 dict(category="validate", code="COMP-UNRESOLVED",
                      message="Externalized sections are unresolved; complete validation is unavailable."))
        return dict(error=error,
                    partial_validation_result=structural,
                    **{key: result[key] for key in local}), 1
    unallocated = bool(result["metadata_assessment"]["shape_findings"]) or any(
        assessment["shape_findings"] for assessment in result["section_assessment"].values())
    if unallocated:
        return dict(error=dict(message="Unallocated structural requirements remain; complete validation is unavailable."),
                    partial_validation_result=structural,
                    **{key: result[key] for key in local}), 1
    # V.12 is a separately checked union, not an async mutation of the
    # synchronous structural status, issue arrays or stage readiness.
    binding = structural.get("replacement_funding_verification")
    if binding is None:
        return dict(error=dict(message="Replacement-funding assessment is unavailable."),
                    partial_validation_result=structural), 1
    # Blocking flags/readiness describe workflow; the accepted cmdValidate
    # operation fails for actual errors or the separate binding refusal.
    refused = (bool(structural["errors"])
               or binding["state"] in ("failed", "unverifiable"))
    return structural, 1 if refused else 0


def main(arguments):
    if arguments == ["manifest"]:
        return {"id": "org.uwmd.python", "name": "Independent Python structured reader foundation",
                "version": "0.0.0-dev", "format_version": "3.0", "protocol_version": "4.1.0",
                "capabilities": ["parse"], "profiles": []}, 0
    if arguments and arguments[0] == "validate":
        if len(arguments) not in (2, 3) or (len(arguments) == 3 and arguments[2] != "--json"):
            return {"error": {"message": "validate <file> [--json]"}}, 1
        try:
            path = Path(arguments[1])
            return _validation_response(asyncio.run(
                _validate_source(path.read_bytes(), filename=path.name)))
        except SourceError as error:
            diagnostic = {"message": str(error)}
            if hasattr(error, "code"):
                diagnostic["code"] = error.code
                # Protocol XI: these existing allocated source refusals are
                # parse errors even when reached through validate. Uncoded
                # local failures do not acquire a fabricated fallback code.
                if error.code in ("UNSUPPORTED_FORMAT_VERSION", "UNSUPPORTED_YAML_FEATURE",
                                  "SOURCE_CONTENT_MISMATCH"):
                    diagnostic["category"] = "parse"
            return {"error": diagnostic}, 1
        except ValidationUnavailable as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
        except Exception as error:
            # An implementation defect is never a structural validation verdict.
            return {"error": {"message": "Internal validation failure: " + str(error)}}, 2
    if len(arguments) in (2, 3) and arguments[0] == "verify-block-integrity" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = asyncio.run(verify_block_integrity(parse(path.read_bytes(), filename=path.name)))
            return result, 0 if result["ok"] else 1
        except (SourceError, BlockIntegrityError) as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) in (2, 3) and arguments[0] == "inspect-document-currency" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = inspect_document_currency(parse(path.read_bytes(), filename=path.name))
            return result, 0 if result["ok"] else 1
        except SourceError as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) in (2, 3) and arguments[0] == "inspect-source-roles" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = _inspect_source_roles_source(path.read_bytes(), filename=path.name)
            return result, 0 if result["ok"] else 1
        except SourceError as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) in (2, 3) and arguments[0] == "verify-replacement-funding" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = asyncio.run(replacement_funding_report(parse(path.read_bytes(), filename=path.name)))
            refusal = result["structural_issues"] or result["replacement_funding_verification"]["state"] in ("failed", "unverifiable")
            return result, 1 if refusal else 0
        except SourceError as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) >= 2 and arguments[0] == "verify-reserve-draws":
        tail = arguments[2:]
        if tail and tail[-1] == "--json":
            tail = tail[:-1]
        if len(tail) > 1 or any(item.startswith("--") for item in tail):
            return {"error": {"message": "verify-reserve-draws <file> [plan.json] [--json]"}}, 1
        try:
            path = Path(arguments[1])
            document = parse(path.read_bytes(), filename=path.name)
            if tail:
                plan = parse_json_source(Path(tail[0]).read_bytes()).value
                result = verify_reserve_draw_bindings(document, plan)
            else:
                result = verify_reserve_draw_bindings(document)
            return result, 1 if result["state"] in ("failed", "unverifiable") else 0
        except SourceError as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) in (2, 3) and arguments[0] == "verify-reserve-accounts" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = verify_reserve_accounts(parse(path.read_bytes(), filename=path.name))
            return result, 1 if result["state"] in ("failed", "unverifiable") else 0
        except SourceError as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) == 2 and arguments[0] == "parse":
        try:
            path = Path(arguments[1])
            return parse(path.read_bytes(), filename=path.name).projection(), 0
        except SourceError as error:
            # Uncoded errors stay local diagnostics rather than invented
            # registered Protocol codes or structural validation verdicts.
            diagnostic = {"message": str(error)}
            if hasattr(error, "code"):
                diagnostic["code"] = error.code
            return {"error": diagnostic}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    return {"error": {"message": "implemented commands: manifest, parse <file>, validate <file> [--json], verify-reserve-accounts <file> [--json], verify-reserve-draws <file> [plan.json] [--json], verify-replacement-funding <file> [--json], verify-block-integrity <file> [--json], inspect-source-roles <file> [--json], inspect-document-currency <file> [--json]"}}, 1


if __name__ == "__main__":
    value, status = main(sys.argv[1:])
    # ASCII escapes are UTF-8 JSON and preserve parsed Unicode values even
    # when the source carried an escaped lone surrogate. No source is rewritten.
    print(json.dumps(value, ensure_ascii=True, allow_nan=False))
    sys.exit(status)
