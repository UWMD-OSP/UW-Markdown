"""Node-free parse/reserve CLI; discovery remains explicitly partial without a tier."""
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
from uwmd_source_validation import inspect_source_roles


def main(arguments):
    if arguments == ["manifest"]:
        return {"id": "org.uwmd.python", "name": "Independent Python structured reader foundation",
                "version": "0.0.0-dev", "format_version": "3.0", "protocol_version": "4.1.0",
                "capabilities": ["parse"], "profiles": []}, 0
    if len(arguments) in (2, 3) and arguments[0] == "verify-block-integrity" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = asyncio.run(verify_block_integrity(parse(path.read_bytes(), filename=path.name)))
            return result, 0 if result["ok"] else 1
        except (SourceError, BlockIntegrityError) as error:
            return {"error": {"message": str(error)}}, 1
        except OSError as error:
            return {"error": {"message": str(error)}}, 2
    if len(arguments) in (2, 3) and arguments[0] == "inspect-source-roles" and (len(arguments) == 2 or arguments[2] == "--json"):
        try:
            path = Path(arguments[1])
            result = inspect_source_roles(parse(path.read_bytes(), filename=path.name))
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
    return {"error": {"message": "implemented commands: manifest, parse <file>, verify-reserve-accounts <file> [--json], verify-reserve-draws <file> [plan.json] [--json], verify-replacement-funding <file> [--json], verify-block-integrity <file> [--json], inspect-source-roles <file> [--json]"}}, 1


if __name__ == "__main__":
    value, status = main(sys.argv[1:])
    # ASCII escapes are UTF-8 JSON and preserve parsed Unicode values even
    # when the source carried an escaped lone surrogate. No source is rewritten.
    print(json.dumps(value, ensure_ascii=True, allow_nan=False))
    sys.exit(status)
