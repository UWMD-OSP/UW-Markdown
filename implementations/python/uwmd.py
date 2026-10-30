"""Node-free structured CLI; the manifest claims the base Verifier tier and no optional profiles."""
import asyncio
import json
from pathlib import Path
import sys

from uwmd_reader import parse
from uwmd_calc import evaluate_calc, parse_context
from uwmd_calc_errors import CalcError, CalcUnavailable
from uwmd_source import SourceError, parse_json_source
from uwmd_reserves import verify_reserve_accounts
from uwmd_reserve_draws import verify_reserve_draw_bindings
from uwmd_replacement_funding import replacement_funding_report
from uwmd_block_integrity import BlockIntegrityError, verify_block_integrity
from uwmd_source_validation import _inspect_source_roles_source
from uwmd_currency import inspect_document_currency
from uwmd_validation import _validate_document
from uwmd_institution_config import _InstitutionConfigError
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
        return {"id": "org.uwmd.python", "name": "Independent Python base Verifier",
                "version": "0.0.0-dev", "format_version": "3.0", "protocol_version": "4.1.0",
                # Base Verifier obligations are implemented independently from
                # the accepted standard. CI requires the complete selected
                # Reader/Verifier corpus with zero skips on all three OSes;
                # separate nonportable controls cover policy and API boundaries.
                "tier": "verifier", "capabilities": ['parse', 'calc-evaluate', 'validate', 'verify-reserve-accounts', 'verify-reserve-draws', 'verify-metrics', 'verify-cash-flows', 'verify-property-cash-flows', 'verify-waterfall', 'verify-capital-stack', 'verify-lease-up', 'verify-receipts'],
                "profiles": []}, 0
    if arguments and arguments[0] == "resolve":
        # Existing accepted spelling only; no invented validate resolution flag.
        # This bounded read-only transport never writes a resolved artifact.
        tail = arguments[1:]
        if not tail or tail[0].startswith("--"):
            return {"error": {"message": "resolve <file> [--parts <dir>] --json"}}, 1
        path = Path(tail[0]); directory = path.resolve().parent / "parts"
        index, json_requested, supplied_parts = 1, False, False
        while index < len(tail):
            flag = tail[index]
            if flag == "--json" and not json_requested:
                json_requested = True
            elif flag == "--parts" and not supplied_parts and index + 1 < len(tail) and not tail[index+1].startswith("--"):
                index += 1; directory = Path(tail[index]); supplied_parts = True
            elif flag.startswith("--parts=") and not supplied_parts and len(flag) > 8:
                directory = Path(flag[8:]); supplied_parts = True
            else:
                return {"error": {"message": "resolve <file> [--parts <dir>] --json"}}, 1
            index += 1
        if not json_requested:
            return {"error": {"message": "This read-only resolver requires --json"}}, 1
        from uwmd_composition import CompositionError, index_parts, resolve_composition
        try:
            root = parse(path.read_bytes(), filename=path.name)
            paths = sorted(directory.glob("*.uwpart.md")) if directory.exists() else []
            parts = index_parts(parse(part.read_bytes(), filename=part.name) for part in paths if part.is_file())
            result = resolve_composition(root, parts)
            return dict(status=result.status, externalized=list(result.externalized),
                        parts_available=len(parts), issues=list(result.issues)), int(result.status != "resolved")
        except CompositionError as error:
            return {"error": error.projection()}, 1
        except (SourceError, ValidationUnavailable) as error:
            diagnostic = {"message": str(error)}
            if hasattr(error, "code"):
                diagnostic["code"] = error.code
                if error.code in ("UNSUPPORTED_FORMAT_VERSION", "UNSUPPORTED_YAML_FEATURE", "SOURCE_CONTENT_MISMATCH",
                                  "SOURCE_BLOCK_MALFORMED"):
                    diagnostic["category"] = "parse"
            return {"error": diagnostic}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
        except Exception as error:
            return {"error": {"message": "Internal composition failure: " + str(error)}}, 2
    if arguments and arguments[0] == "calc":
        tail = arguments[1:]
        if tail and tail[-1] == "--json":
            tail = tail[:-1]
        if len(tail) not in (2, 4) or len(tail) == 4 and tail[2] != "--calc-context":
            return {"error": {"message": "calc <file> <calc.json|formula> [--calc-context <file>] [--json]"}}, 1
        try:
            path = Path(tail[0])
            document = parse(path.read_bytes(), filename=path.name)
            argument = Path(tail[1])
            if argument.is_file():
                declarations = parse_json_source(argument.read_bytes()).value
            else:
                declarations = {"id": "inline", "formula": tail[1], "deterministic": True}
            context = parse_context(parse_json_source(Path(tail[3]).read_bytes()).value) if len(tail) == 4 else {}
            array_input = isinstance(declarations, list)
            results = [evaluate_calc(declaration, document, context=context)
                       for declaration in (declarations if array_input else [declarations])]
            response = results if array_input else results[0]
            return response, 1 if any(not result["ok"] for result in results) else 0
        except CalcError as error:
            return {"error": error.projection()}, 1
        except (SourceError, CalcUnavailable) as error:
            diagnostic = {"message": str(error)}
            if hasattr(error, "code"):
                diagnostic.update(code=error.code, category="parse")
            return {"error": diagnostic}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
        except Exception as error:
            return {"error": {"message": "Internal calculation failure: " + str(error)}}, 2
    if arguments and arguments[0]=="verify-receipt":
        tail=arguments[1:]
        if len(tail)<2:return {"error":{"message":"verify-receipt <receipt.json> <file> [--inputs <inputs.json>] --json"}},1
        from uwmd_receipts import verify_receipt,ReceiptError
        rest=tail[2:]
        if rest and rest[-1]=="--json":rest=rest[:-1]
        inputs=None
        try:
            if rest:
                if len(rest)!=2 or rest[0]!="--inputs":return {"error":{"message":"Unsupported receipt arguments"}},1
                inputs=parse_json_source(Path(rest[1]).read_bytes()).value
            try:receipt=parse_json_source(Path(tail[0]).read_bytes()).value
            except (OSError,SourceError) as error:raise ReceiptError(str(error)) from error
            source=Path(tail[1])
            report=verify_receipt(receipt,source.read_bytes(),filename=source.name,inputs=inputs)
            return report,{"verified":0,"failed":1,"unverifiable":3}[report["verdict"]]
        except ReceiptError as error:return {"error":error.projection()},1
        except OSError as error:return {"error":{"message":str(error)}},2
    if arguments and arguments[0]=="verify-property-cash-flows":
        tail=arguments[1:]
        if len(tail) not in (2,3) or len(tail)==3 and tail[2]!="--json":
            return {"error":{"message":"verify-property-cash-flows <file> <plan.json> --json"}},1
        from uwmd_property_cash_flows import assemble_property_cash_flows,AssemblyError
        try:
            path=Path(tail[0])
            document=parse(path.read_bytes(),filename=path.name,require_structured=True)
            plan=parse_json_source(Path(tail[1]).read_bytes()).value
            return assemble_property_cash_flows(document,plan),0
        except AssemblyError as error:
            return {"error":error.projection()},1
        except SourceError as error:
            return {"error":{"message":str(error),**({"code":error.code,"category":"parse"} if hasattr(error,"code") else {})}},1
        except OSError as error:
            return {"error":{"message":str(error)}},2
    if arguments and arguments[0] in ("verify-cash-flows", "verify-metrics", "verify-capital-stack", "verify-lease-up", "verify-waterfall"):
        command=arguments[0]
        tail=arguments[1:]
        if not tail or tail[0].startswith("--"):
            return {"error":{"message":command+" <file> [--variant <name>] --json"}},1
        variant=None
        rest=tail[1:]
        if rest and rest[-1]=="--json": rest=rest[:-1]
        if command!="verify-metrics" and len(rest)==2 and rest[0]=="--variant":
            variant=rest[1]
        elif rest:
            return {"error":{"message":"Unsupported verifier arguments"}},1
        try:
            path=Path(tail[0])
            document=parse(path.read_bytes(),filename=path.name,require_structured=True)
            if command=="verify-cash-flows":
                from uwmd_cash_flows import cash_flow_report
                report=cash_flow_report(document,variant)
                return report,1 if report["status"]=="failed" else 0
            if command=="verify-waterfall":
                from uwmd_waterfall import waterfall_report
                report=waterfall_report(document,variant)
                return report,1 if report["status"]=="failed" else 0
            if command in ("verify-capital-stack","verify-lease-up"):
                from uwmd_capital_stack import capital_stack_report
                from uwmd_lease_up import lease_up_report
                report=(capital_stack_report if command=="verify-capital-stack" else lease_up_report)(document,variant)
                return report,1 if report["status"]=="failed" else 0
            from uwmd_metrics import verify_stated_metrics
            report=verify_stated_metrics(document)
            return report,1 if report["counts"]["failed"] else 0
        except CalcError as error:
            return {"error":error.projection()},1
        except SourceError as error:
            return {"error":{"message":str(error),**({"code":error.code,"category":"parse"} if hasattr(error,"code") else {})}},1
        except OSError as error:
            return {"error":{"message":str(error)}},2
    if arguments and arguments[0] == "validate":
        tail=arguments[1:]
        if not tail or tail[0].startswith("--"):
            return {"error": {"message": "validate <file> [--institution <config.json>] [--json]"}}, 1
        index,json_requested,explicit=1,False,None
        while index<len(tail):
            flag=tail[index]
            if flag=="--json" and not json_requested:
                json_requested=True
            elif flag=="--institution" and explicit is None and index+1<len(tail) and not tail[index+1].startswith("--"):
                index+=1;explicit=tail[index]
            elif flag.startswith("--institution=") and explicit is None and len(flag)>14:
                explicit=flag[14:]
            else:
                return {"error": {"message": "validate <file> [--institution <config.json>] [--json]"}}, 1
            index+=1
        try:
            path = Path(tail[0])
            raw=path.read_bytes()
            # Fatal actual-source admission precedes config preflight. Validate
            # this fresh parse with SOURCE ordering after admission succeeds.
            document=parse(raw,filename=path.name,require_structured=True)
            from uwmd_institution import load_institution_policy
            policy=load_institution_policy(path,explicit)
            # RFC 0109: deal flags travel in the result and never set the exit.
            return _validation_response(asyncio.run(
                _validate_document(document,_source_order=True,thresholds=policy["thresholds"],
                                   financial_validity_errors=policy["financial_validity_errors"])))
        except _InstitutionConfigError as error:
            return {"error":error.projection()},1
        except SourceError as error:
            diagnostic = {"message": str(error)}
            if hasattr(error, "code"):
                diagnostic["code"] = error.code
                # Protocol XI: these existing allocated source refusals are
                # parse errors even when reached through validate. Uncoded
                # local failures do not acquire a fabricated fallback code.
                if error.code in ("UNSUPPORTED_FORMAT_VERSION", "UNSUPPORTED_YAML_FEATURE",
                                  "SOURCE_CONTENT_MISMATCH", "SOURCE_BLOCK_MALFORMED"):
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
            return parse(path.read_bytes(), filename=path.name, require_structured=True).projection(), 0
        except SourceError as error:
            # Uncoded errors stay local diagnostics rather than invented
            # registered Protocol codes or structural validation verdicts.
            diagnostic = {"message": str(error)}
            if hasattr(error, "code"):
                diagnostic["code"] = error.code
            return {"error": diagnostic}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    return {"error": {"message": "implemented commands: manifest, parse <file>, calc <file> <calc.json|formula> [--calc-context <file>] [--json], validate <file> [--json], verify-reserve-accounts <file> [--json], verify-reserve-draws <file> [plan.json] [--json], verify-replacement-funding <file> [--json], verify-block-integrity <file> [--json], inspect-source-roles <file> [--json], inspect-document-currency <file> [--json]"}}, 1


if __name__ == "__main__":
    value, status = main(sys.argv[1:])
    # ASCII escapes are UTF-8 JSON and preserve parsed Unicode values even
    # when the source carried an escaped lone surrogate. No source is rewritten.
    config_error=value.get("error") if isinstance(value,dict) else None
    human_config_refusal=(sys.argv[1:2]==["validate"] and "--json" not in sys.argv[2:]
        and isinstance(config_error,dict) and config_error.get("code") in (
            "VAL-INSTITUTION-CONFIG-UNREADABLE","VAL-INSTITUTION-CONFIG-MALFORMED"))
    if human_config_refusal:
        print(config_error["code"]+": "+config_error["message"],file=sys.stderr)
    else:print(json.dumps(value, ensure_ascii=True, allow_nan=False))
    sys.exit(status)
