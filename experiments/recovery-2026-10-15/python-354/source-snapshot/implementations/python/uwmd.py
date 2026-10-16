"""Python-only CLI for the incomplete independent implementation (#354)."""
import json
import pathlib
import sys

from uwmd_reader import ProtocolError, decode_json, parse
from uwmd_validation import validate
from uwmd_expressions import IncompleteImplementation, NumericalContractBlocked, calculate


def main(argv):
    if argv == ['manifest']:
        # No tier until all Reader obligations have been reviewed; no calc claim.
        return {'id': 'org.uwmd.python', 'name': 'Independent Python development reader',
                'version': '0.0.0-dev', 'protocol_version': '4.1.0', 'format_version': '3.0',
                'capabilities': ['parse'], 'profiles': []}, 0
    if len(argv) < 2 or argv[0] not in ('parse', 'validate', 'calc'):
        raise ProtocolError('PROTO-COMMAND-UNSUPPORTED', 'Command is not implemented', 'parse')
    path = pathlib.Path(argv[1])
    document = parse(path.read_bytes().decode('utf-8'), path)
    if argv[0] == 'parse':
        return document.projection(), 0
    if argv[0] == 'validate':
        return validate(document), 1  # incomplete can never imply successful verification
    if len(argv) < 3:
        raise ProtocolError('CALC-PARSE-001', 'Missing calc declaration', 'calc')
    declaration = decode_json(pathlib.Path(argv[2]).read_text(encoding='utf-8'))
    context = None
    if '--calc-context' in argv:
        at = argv.index('--calc-context')
        if at + 1 >= len(argv):
            raise ProtocolError('CALC-PARSE-001', 'Missing calc context', 'calc')
        context = decode_json(pathlib.Path(argv[at + 1]).read_text(encoding='utf-8'))
    def one(item):
        try:
            return calculate(document, item, context)
        except IncompleteImplementation as cause:
            return {'calc_id': item.get('id', ''), 'ok': False, 'value': None,
                    'implementation_status': 'blocked' if isinstance(cause, NumericalContractBlocked) else 'unimplemented',
                    'reason': str(cause)}
    result = [one(item) for item in declaration] if isinstance(declaration, list) else one(declaration)
    values = result if isinstance(result, list) else [result]
    return result, 0 if all(item['ok'] for item in values) else 1


if __name__ == '__main__':
    try:
        result, status = main(sys.argv[1:])
    except ProtocolError as error:
        result, status = {'error': error.as_dict()}, 1
    except (OSError, UnicodeError) as error:
        result, status = {'error': {'category': 'parse', 'code': 'PARSE_INPUT_ERROR', 'message': str(error)}}, 2
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    sys.exit(status)
