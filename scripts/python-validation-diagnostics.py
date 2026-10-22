"""Read-only SOURCE diagnostic adapter for the development parity check.

This exercises the same parser and SOURCE orchestrator as Python's validate
CLI, before institution policy. It adds no discovery capability or tier claim.
"""
import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "implementations/python"))
from uwmd_reader import parse
from uwmd_validation import _validate_document


async def main():
    output = {}
    for name in json.load(sys.stdin):
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT / "conformance") or path.suffixes[-2:] != [".uwx", ".md"]:
            raise ValueError("Expected a tracked structured conformance source")
        try:
            document = parse(path.read_bytes(), filename=name, require_structured=True)
            result = await _validate_document(document, _source_order=True, now="2026-10-22T00:00:00Z")
            output[name] = {"issues": [
                {key: issue.get(key) or "" for key in ("code", "severity", "section", "field")}
                for issue in result["issues"]]}
        except Exception as error:
            code = getattr(error, "code", None)
            if not isinstance(code, str) or not code:
                raise
            output[name] = {"error": {"code": code}}
    json.dump(output, sys.stdout, ensure_ascii=True)


asyncio.run(main())
