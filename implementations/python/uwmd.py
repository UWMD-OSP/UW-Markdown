"""Node-free II.6a adapter for the explicitly partial Python parse capability."""
import json
from pathlib import Path
import sys

from uwmd_reader import parse
from uwmd_source import SourceError


def main(arguments):
    if arguments == ["manifest"]:
        return {"id": "org.uwmd.python", "name": "Independent Python structured reader foundation",
                "version": "0.0.0-dev", "format_version": "3.0", "protocol_version": "4.1.0",
                "capabilities": ["parse"], "profiles": []}, 0
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
    return {"error": {"message": "only manifest and parse <file> are implemented"}}, 1


if __name__ == "__main__":
    value, status = main(sys.argv[1:])
    # ASCII escapes are UTF-8 JSON and preserve parsed Unicode values even
    # when the source carried an escaped lone surrogate. No source is rewritten.
    print(json.dumps(value, ensure_ascii=True, allow_nan=False))
    sys.exit(status)
