"""Independent integer/struct implementation of the RFC 0088 bit-adapter study."""
import struct

_MOD = 1 << 32
_SAFE = (1 << 53) - 1


def _integer(value):
    if type(value) is not int or not -_SAFE <= value <= _SAFE:
        raise TypeError("expected a safe integer")
    return value


def _word(value):
    _integer(value)
    if not 0 <= value < _MOD:
        raise ValueError("expected an unsigned 32-bit word")
    return value


def _shift(count):
    _integer(count)
    if not 0 <= count <= 32:
        raise ValueError("expected a shift in [0, 32]")
    return count


def u32(value):
    return _integer(value) % _MOD


def i32(value):
    return _word(value) if value < (1 << 31) else _word(value) - _MOD


def and32(left, right):
    return _word(left) & _word(right)


def or32(left, right):
    return _word(left) | _word(right)


def xor32(left, right):
    return _word(left) ^ _word(right)


def not32(value):
    return _word(value) ^ 0xffffffff


def shl32(value, count):
    return (_word(value) << _shift(count)) % _MOD


def shr32(value, count):
    return _word(value) >> _shift(count)


def sar32(value, count):
    return (i32(value) >> _shift(count)) % _MOD


def add32(left, right):
    carry, result = divmod(_word(left) + _word(right), _MOD)
    return {"word": result, "carry": carry}


def sub32(left, right):
    difference = _word(left) - _word(right)
    return {"word": difference % _MOD, "borrow": int(difference < 0)}


def split(value):
    if type(value) is not float:
        raise TypeError("expected a binary64 float")
    hi, lo = struct.unpack(">II", struct.pack(">d", value))
    if hi & 0x7ff00000 == 0x7ff00000:
        raise ValueError("expected a finite binary64 float")
    return {"hi": hi, "lo": lo}


def join(hi, lo):
    _word(hi)
    _word(lo)
    if hi & 0x7ff00000 == 0x7ff00000:
        raise ValueError("nonfinite encodings are outside this experiment")
    return struct.unpack(">d", struct.pack(">II", hi, lo))[0]


def replace_high(value, hi):
    return join(hi, split(value)["lo"])


def replace_low(value, lo):
    return join(split(value)["hi"], lo)
