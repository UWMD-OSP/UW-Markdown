"""Separate UNACCEPTED current-policy boundary; never called by raw kernel."""
import kernel


def current_policy(operation, arguments):
    if operation not in ('pow', 'log', 'exp', 'sqrt'):
        raise ValueError('unknown wrapper')
    refused = lambda reason: {'status': 'refused', 'reason': reason, 'observed_code': 'CALC-TYPE-001'}
    if not isinstance(arguments, list) or len(arguments) != (2 if operation == 'pow' else 1):
        return refused('arity')
    # Python research API uses decoded binary64 floats; bool/int are not Number
    # substitutes. There is no arbitrary-precision integer input admission here.
    if any(value is not None and type(value) is not float for value in arguments):
        return refused('type')
    if any(value is None for value in arguments):
        return {'status': 'returned', 'value': None}
    if operation == 'log' and arguments[0] <= 0.0 or operation == 'sqrt' and arguments[0] < 0.0:
        return refused('domain')
    value = kernel.OPERATIONS[operation](*arguments)
    if operation in ('pow', 'exp') and kernel.word(value) & 0x7fffffffffffffff >= 0x7ff0000000000000:
        return refused('nonfinite_result')
    return {'status': 'returned', 'value': value}
