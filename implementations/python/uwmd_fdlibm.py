"""Independent Python implementation of the accepted RFC 0088 pinned procedure.

Copyright (C) 1993, 2004 by Sun Microsystems, Inc. All rights reserved.
Developed at SunSoft, a Sun Microsystems, Inc. business.
Permission to use, copy, modify, and distribute this software is freely
 granted, provided that this notice is preserved.

Source: experiments/numerical-0088/pinned-fdlibm/upstream/{e_pow,e_log,
e_exp,e_sqrt,s_scalbn,s_copysign,s_fabs}.c; source hashes and word-site rules
are pinned by accepted RFC 0088. Adapted from the independent Python research
kernel, not TypeScript. No host transcendental or financial evaluator.
Python phase decomposition is independent of the JS implementation. Arithmetic
association within each C expression is retained; each float operator is binary64.
"""
import struct

MASK = 0xffffffff
SIGN = 0x80000000


def u32(value):
    return value & MASK


def s32(value):
    word = u32(value)
    return word - 0x100000000 if word & SIGN else word


def shift(value, count, mode):
    if type(count) is not int or not 0 <= count <= 32:
        raise ValueError('word shift count must be 0..32')
    if mode == 'left':
        return s32(value << count)
    if mode == 'signed':
        return s32(value) >> count
    if mode == 'unsigned':
        return u32(value) >> count
    raise ValueError('unknown word shift')


def word(value):
    return struct.unpack('>Q', struct.pack('>d', value))[0]


def number(bits):
    return struct.unpack('>d', struct.pack('>Q', bits))[0]


def high(value):
    return s32(word(value) >> 32)


def low(value):
    return word(value) & MASK


def assemble(upper, lower):
    return number((u32(upper) << 32) | u32(lower))


def upper(value, replacement):
    return assemble(replacement, low(value))


def chopped(value):
    return assemble(high(value), 0)


def from_bits(text):
    if not isinstance(text, str) or len(text) != 16 or any(c not in '0123456789abcdef' for c in text):
        raise ValueError('expected 16 lowercase hexadecimal digits')
    return number(int(text, 16))


def to_bits(value):
    return f'{word(value):016x}'


NAN = number(0x7ff8000000000000)
INF = number(0x7ff0000000000000)


def divide(numerator, denominator):
    """IEEE division instead of Python's zero-denominator exception."""
    if denominator == 0.0:
        if numerator == 0.0 or numerator != numerator:
            return NAN
        return number(0x7ff0000000000000 | ((word(numerator) ^ word(denominator)) & (1 << 63)))
    return numerator / denominator


# Shared independently rational-derived constant WORDS, not JS code or outputs.
# Certified constants.json SHA256: e9793112e7a5d0e2c1ccb2f8d8dd9bbc35608598cf725cb8e5ee44117dad59d9
_LITERAL_WORDS = {'0.0': '0000000000000000', '0.25': '3fd0000000000000', '0.33333333333333333': '3fd5555555555555', '0.3333333333333333333333': '3fd5555555555555', '0.5': '3fe0000000000000', '1.0': '3ff0000000000000', '1.0e+300': '7e37e43c8800759c', '1.0e-300': '01a56e1fc2f8f359', '1.0e300': '7e37e43c8800759c', '1.35003920212974897128e-08': '3e4cfdeb43cfd006', '1.44269502162933349609e+00': '3ff7154760000000', '1.44269504088896338700e+00': '3ff71547652b82fe', '1.479819860511658591e-01': '3fc2f112df3e5244', '1.5': '3ff8000000000000', '1.531383769920937332e-01': '3fc39a09d078c69f', '1.65339022054652515390e-06': '3ebbbd41c5d26bf1', '1.66666666666666019037e-01': '3fc555555555553e', '1.80143985094819840000e+16': '4350000000000000', '1.818357216161805012e-01': '3fc7466496cb03de', '1.90465429995776804525e-09': '3e205c610ca86c39', '1.90821492927058770002e-10': '3dea39ef35793c76', '1.92596299112661746887e-08': '3e54ae0bf85ddf44', '2.0': '4000000000000000', '2.06975017800338417784e-01': '3fca7e284a454eef', '2.222219843214978396e-01': '3fcc71c51d8e78af', '2.30660745775561754067e-01': '3fcd864a93c9db65', '2.72728123808534006489e-01': '3fd17460a91d4101', '2.77777777770155933842e-03': '3f66c16c16bebd93', '2.857142874366239149e-01': '3fd2492494229359', '3.0': '4008000000000000', '3.33333329818377432918e-01': '3fd55555518f264d', '3.999999999940941908e-01': '3fd999999997fa04', '4.13813679705723846039e-08': '3e66376972bea4d0', '4.28571428578550184252e-01': '3fdb6db6db6fabff', '5.55111512312578270212e-17': '3c90000000000000', '5.84962487220764160156e-01': '3fe2b80340000000', '5.99999999999994648725e-01': '3fe3333333333303', '6.61375632143793436117e-05': '3f11566aaf25de2c', '6.666666666666735130e-01': '3fe5555555555593', '6.93147180369123816490e-01': '3fe62e42fee00000', '6.93147180559945286227e-01': '3fe62e42fefa39ef', '6.93147182464599609375e-01': '3fe62e4300000000', '7.02846165095275826516e-09': '3e3e2fe0145b01f5', '7.09782712893383973096e+02': '40862e42fefa39ef', '7.45133219101941108420e+02': '40874910d52d3051', '8.0085662595372944372e-0017': '3c971547652b82fe', '9.33263618503218878990e-302': '0170000000000000', '9.61796693925975554329e-01': '3feec709dc3a03fd', '9.61796700954437255859e-01': '3feec709e0000000', '9007199254740992.0': '4340000000000000'}


def constant(token):
    return from_bits(_LITERAL_WORDS[token])


HUGE = constant('1.0e300')
TINY = constant('1.0e-300')
TWO54 = constant('1.80143985094819840000e+16')
LN2_HIGH = constant('6.93147180369123816490e-01')
LN2_LOW = constant('1.90821492927058770002e-10')
INV_LN2 = constant('1.44269504088896338700e+00')
P1 = constant('1.66666666666666019037e-01')
P2 = -constant('2.77777777770155933842e-03')
P3 = constant('6.61375632143793436117e-05')
P4 = -constant('1.65339022054652515390e-06')
P5 = constant('4.13813679705723846039e-08')


def fabs(value):
    return number(word(value) & 0x7fffffffffffffff)


def copysign(value, sign_source):
    return number((word(value) & 0x7fffffffffffffff) | (word(sign_source) & (1 << 63)))


def scalbn(value, exponent):
    if type(exponent) is not int or not -(1 << 31) <= exponent < (1 << 31):
        raise ValueError('scalbn exponent must be signed32')
    hx = high(value)
    k = (hx & 0x7ff00000) >> 20
    if k == 0:
        if (low(value) | (hx & 0x7fffffff)) == 0:
            return value
        value *= TWO54
        hx = high(value)
        k = ((hx & 0x7ff00000) >> 20) - 54
        if exponent < -50000:
            return TINY * value
    if k == 0x7ff:
        return value + value
    k = s32(k + exponent)  # Retain source signed32 overflow/recovery branch.
    if k > 0x7fe:
        return HUGE * copysign(HUGE, value)
    if k > 0:
        return upper(value, (hx & 0x800fffff) | u32(k << 20))
    if k <= -54:
        return HUGE * copysign(HUGE, value) if exponent > 50000 else TINY * copysign(TINY, value)
    k += 54
    return upper(value, (hx & 0x800fffff) | u32(k << 20)) * constant('5.55111512312578270212e-17')


def sqrt(value):
    """C restoring square root, explicit high/low carry and borrow words."""
    ix0, ix1 = high(value), low(value)
    if ix0 & 0x7ff00000 == 0x7ff00000:
        return value * value + value
    if ix0 <= 0:
        if ((ix0 & 0x7fffffff) | ix1) == 0:
            return value
        if ix0 < 0:
            return NAN
    exponent = ix0 >> 20
    if exponent == 0:
        # At most two transfer bodies and twenty leading-bit search bodies.
        for _ in range(2):
            if ix0:
                break
            exponent -= 21
            ix0 |= ix1 >> 11
            ix1 = u32(ix1 << 21)
        count = 0
        while not ix0 & 0x00100000:
            ix0 = s32(ix0 << 1)
            count += 1
            assert count <= 20
        exponent -= count - 1
        ix0 |= shift(ix1, 32 - count, 'unsigned')
        ix1 = u32(ix1 << count)
    exponent -= 1023
    ix0 = (ix0 & 0x000fffff) | 0x00100000
    if exponent & 1:
        ix0 = s32(ix0 + (ix0 + (ix1 >> 31)))
        ix1 = u32(ix1 + ix1)
    exponent >>= 1
    ix0 = s32(ix0 + (ix0 + (ix1 >> 31)))
    ix1 = u32(ix1 + ix1)
    q = q1 = s0 = s1 = 0
    # These finite iteration spaces replace C's shifting-bit while loops.
    for bit in range(21, -1, -1):
        moving = 1 << bit
        trial = s32(s0 + moving)
        if trial <= ix0:
            s0 = s32(trial + moving)
            ix0 = s32(ix0 - trial)
            q = s32(q + moving)
        ix0 = s32(ix0 + (ix0 + (ix1 >> 31)))
        ix1 = u32(ix1 + ix1)
    for bit in range(31, -1, -1):
        moving = 1 << bit
        trial_low = u32(s1 + moving)
        trial_high = s0
        if trial_high < ix0 or (trial_high == ix0 and trial_low <= ix1):
            s1 = u32(trial_low + moving)
            if trial_low & SIGN and not s1 & SIGN:
                s0 = s32(s0 + 1)
            ix0 = s32(ix0 - trial_high)
            if ix1 < trial_low:
                ix0 = s32(ix0 - 1)
            ix1 = u32(ix1 - trial_low)
            q1 = u32(q1 + moving)
        ix0 = s32(ix0 + (ix0 + (ix1 >> 31)))
        ix1 = u32(ix1 + ix1)
    if ix0 | ix1:
        probe = 1.0 - TINY
        if probe >= 1.0:
            probe = 1.0 + TINY
            if q1 == MASK:
                q1 = 0
                q = s32(q + 1)
            elif probe > 1.0:
                if q1 == MASK - 1:
                    q = s32(q + 1)
                q1 = u32(q1 + 2)
            else:
                q1 = u32(q1 + (q1 & 1))
    ix0 = s32((q >> 1) + 0x3fe00000)
    ix1 = (q1 >> 1) | (SIGN if q & 1 else 0)
    return assemble(s32(ix0 + (exponent << 20)), ix1)


def log(value):
    hx, lx = high(value), low(value)
    exponent = 0
    if hx < 0x00100000:
        if ((hx & 0x7fffffff) | lx) == 0:
            return -INF
        if hx < 0:
            return NAN
        exponent -= 54
        value *= TWO54
        hx = high(value)
    if hx >= 0x7ff00000:
        return value + value
    exponent += (hx >> 20) - 1023
    fraction = hx & 0x000fffff
    normalization = (fraction + 0x95f64) & 0x100000
    value = upper(value, fraction | (normalization ^ 0x3ff00000))
    exponent += normalization >> 20
    f = value - 1.0
    dk = float(exponent)
    if (0x000fffff & (2 + fraction)) < 3:
        if f == 0.0:
            return 0.0 if exponent == 0 else dk * LN2_HIGH + dk * LN2_LOW
        remainder = f * f * (0.5 - constant('0.33333333333333333') * f)
        return f - remainder if exponent == 0 else dk * LN2_HIGH - ((remainder - dk * LN2_LOW) - f)
    ratio = f / (2.0 + f)
    square = ratio * ratio
    fourth = square * square
    even = fourth * (constant('3.999999999940941908e-01') + fourth * (constant('2.222219843214978396e-01') + fourth * constant('1.531383769920937332e-01')))
    odd = square * (constant('6.666666666666735130e-01') + fourth * (constant('2.857142874366239149e-01') + fourth * (constant('1.818357216161805012e-01') + fourth * constant('1.479819860511658591e-01'))))
    remainder = odd + even
    if ((fraction - 0x6147a) | (0x6b851 - fraction)) > 0:
        half_square = 0.5 * f * f
        return f - (half_square - ratio * (half_square + remainder)) if exponent == 0 else dk * LN2_HIGH - ((half_square - (ratio * (half_square + remainder) + dk * LN2_LOW)) - f)
    return f - ratio * (f - remainder) if exponent == 0 else dk * LN2_HIGH - ((ratio * (f - remainder) - dk * LN2_LOW) - f)


def exp(value):
    hx = u32(high(value))
    sign = hx >> 31
    magnitude = hx & 0x7fffffff
    if magnitude >= 0x40862e42:
        if magnitude >= 0x7ff00000:
            if (magnitude & 0xfffff) | low(value):
                return value + value
            return value if sign == 0 else 0.0
        if value > constant('7.09782712893383973096e+02'):
            return HUGE * HUGE
        if value < -constant('7.45133219101941108420e+02'):
            return constant('9.33263618503218878990e-302') * constant('9.33263618503218878990e-302')
    exponent = 0
    if magnitude > 0x3fd62e42:
        if magnitude < 0x3ff0a2b2:
            hi = value - (LN2_HIGH if sign == 0 else -LN2_HIGH)
            lo = LN2_LOW if sign == 0 else -LN2_LOW
            exponent = 1 - sign - sign
        else:
            exponent = int(INV_LN2 * value + (0.5 if sign == 0 else -0.5))
            scale = float(exponent)
            hi = value - scale * LN2_HIGH
            lo = scale * LN2_LOW
        value = hi - lo
    elif magnitude < 0x3e300000:
        if HUGE + value > 1.0:
            return 1.0 + value
    square = value * value
    correction = value - square * (P1 + square * (P2 + square * (P3 + square * (P4 + square * P5))))
    if exponent == 0:
        return 1.0 - ((value * correction) / (correction - 2.0) - value)
    result = 1.0 - ((lo - (value * correction) / (2.0 - correction)) - hi)
    if exponent >= -1021:
        return upper(result, s32(high(result) + (exponent << 20)))
    return upper(result, s32(high(result) + ((exponent + 1000) << 20))) * constant('9.33263618503218878990e-302')


def _integer_parity(magnitude, low_word):
    """C yisint classification, only called for negative bases."""
    if magnitude >= 0x43400000:
        return 2
    if magnitude < 0x3ff00000:
        return 0
    exponent = (magnitude >> 20) - 0x3ff
    if exponent > 20:
        shifted = low_word >> (52 - exponent)
        return 2 - (shifted & 1) if u32(shifted << (52 - exponent)) == low_word else 0
    if low_word == 0:
        shifted = magnitude >> (20 - exponent)
        return 2 - (shifted & 1) if u32(shifted << (20 - exponent)) == magnitude else 0
    return 0


def _log2_split(absolute, magnitude, y_magnitude):
    """Pow's OWN split log2 graph; not a call to log()."""
    if y_magnitude > 0x41e00000:
        delta = absolute - 1.0
        correction = (delta * delta) * (0.5 - delta * (constant('0.3333333333333333333333') - delta * 0.25))
        leading = constant('1.44269502162933349609e+00') * delta
        tail = delta * constant('1.92596299112661746887e-08') - correction * INV_LN2
        main = chopped(leading + tail)
        return main, tail - (main - leading)
    exponent = 0
    if magnitude < 0x00100000:
        absolute *= constant('9007199254740992.0')
        exponent -= 53
        magnitude = high(absolute)
    exponent += (magnitude >> 20) - 0x3ff
    fraction = magnitude & 0x000fffff
    magnitude = fraction | 0x3ff00000
    interval = 0
    if fraction > 0x3988e:
        if fraction < 0xbb67a:
            interval = 1
        else:
            exponent += 1
            magnitude -= 0x00100000
    absolute = upper(absolute, magnitude)
    center = 1.0 if interval == 0 else constant('1.5')
    numerator = absolute - center
    inverse = 1.0 / (absolute + center)
    ratio = numerator * inverse
    leading_ratio = chopped(ratio)
    denominator_hi = assemble(((magnitude >> 1) | 0x20000000) + 0x00080000 + (interval << 18), 0)
    denominator_lo = absolute - (denominator_hi - center)
    trailing_ratio = inverse * ((numerator - leading_ratio * denominator_hi) - leading_ratio * denominator_lo)
    square = ratio * ratio
    remainder = square * square * (constant('5.99999999999994648725e-01') + square * (constant('4.28571428578550184252e-01') + square * (constant('3.33333329818377432918e-01') + square * (constant('2.72728123808534006489e-01') + square * (constant('2.30660745775561754067e-01') + square * constant('2.06975017800338417784e-01'))))))
    remainder += trailing_ratio * (leading_ratio + ratio)
    square = leading_ratio * leading_ratio
    leading_sum = chopped(3.0 + square + remainder)
    trailing_sum = remainder - ((leading_sum - 3.0) - square)
    leading = leading_ratio * leading_sum
    tail = trailing_ratio * leading_sum + trailing_sum * ratio
    product_hi = chopped(leading + tail)
    product_lo = tail - (product_hi - leading)
    z_hi = constant('9.61796700954437255859e-01') * product_hi
    z_lo = -constant('7.02846165095275826516e-09') * product_hi + product_lo * constant('9.61796693925975554329e-01') + (0.0 if interval == 0 else constant('1.35003920212974897128e-08'))
    offset = 0.0 if interval == 0 else constant('5.84962487220764160156e-01')
    scale = float(exponent)
    main = chopped(((z_hi + z_lo) + offset) + scale)
    return main, z_lo - (((main - scale) - offset) - z_hi)


def _power_exp2(product_hi, product_lo, sign):
    """Pow's OWN residual exponential polynomial/scaling graph."""
    z = product_lo + product_hi
    j, i = high(z), low(z)
    if j >= 0x40900000:
        if ((j - 0x40900000) | i) != 0 or product_lo + constant('8.0085662595372944372e-0017') > z - product_hi:
            return sign * HUGE * HUGE
    elif (j & 0x7fffffff) >= 0x4090cc00:
        if (u32(j - 0xc090cc00) | i) != 0 or product_lo <= z - product_hi:
            return sign * TINY * TINY
    magnitude = j & 0x7fffffff
    exponent = (magnitude >> 20) - 0x3ff
    scale = 0
    if magnitude > 0x3fe00000:
        nearest = s32(j + (0x00100000 >> (exponent + 1)))
        exponent = ((nearest & 0x7fffffff) >> 20) - 0x3ff
        integral = assemble(nearest & ~(0x000fffff >> exponent), 0)
        scale = ((nearest & 0x000fffff) | 0x00100000) >> (20 - exponent)
        if j < 0:
            scale = -scale
        product_hi -= integral
    residual = chopped(product_lo + product_hi)
    leading = residual * constant('6.93147182464599609375e-01')
    tail = (product_lo - (residual - product_hi)) * constant('6.93147180559945286227e-01') + residual * -constant('1.90465429995776804525e-09')
    z = leading + tail
    compensation = tail - (z - leading)
    square = z * z
    correction = z - square * (P1 + square * (P2 + square * (P3 + square * (P4 + square * P5))))
    remainder = (z * correction) / (correction - 2.0) - (compensation + z * compensation)
    z = 1.0 - (remainder - z)
    new_high = s32(high(z) + (scale << 20))
    result = scalbn(z, scale) if new_high >> 20 <= 0 else upper(z, new_high)
    return sign * result


def pow(value, power):
    hx, lx, hy, ly = high(value), low(value), high(power), low(power)
    ix, iy = hx & 0x7fffffff, hy & 0x7fffffff
    if (iy | ly) == 0:
        return 1.0
    if ix > 0x7ff00000 or (ix == 0x7ff00000 and lx != 0) or iy > 0x7ff00000 or (iy == 0x7ff00000 and ly != 0):
        return value + power
    parity = _integer_parity(iy, ly) if hx < 0 else 0
    if ly == 0:
        if iy == 0x7ff00000:
            if ((ix - 0x3ff00000) | lx) == 0:
                return power - power
            if ix >= 0x3ff00000:
                return power if hy >= 0 else 0.0
            return -power if hy < 0 else 0.0
        if iy == 0x3ff00000:
            return divide(1.0, value) if hy < 0 else value
        if hy == 0x40000000:
            return value * value
        if hy == 0x3fe00000 and hx >= 0:
            return sqrt(value)
    absolute = fabs(value)
    if lx == 0 and ix in (0x7ff00000, 0, 0x3ff00000):
        result = divide(1.0, absolute) if hy < 0 else absolute
        if hx < 0:
            if ((ix - 0x3ff00000) | parity) == 0:
                return NAN
            if parity == 1:
                result = -result
        return result
    if hx < 0 and parity == 0:
        return NAN
    sign = -1.0 if hx < 0 and parity == 1 else 1.0
    if iy > 0x41e00000:
        if iy > 0x43f00000:
            if ix <= 0x3fefffff:
                return HUGE * HUGE if hy < 0 else TINY * TINY
            if ix >= 0x3ff00000:
                return HUGE * HUGE if hy > 0 else TINY * TINY
        if ix < 0x3fefffff:
            return sign * HUGE * HUGE if hy < 0 else sign * TINY * TINY
        if ix > 0x3ff00000:
            return sign * HUGE * HUGE if hy > 0 else sign * TINY * TINY
    log_hi, log_lo = _log2_split(absolute, ix, iy)
    power_hi = chopped(power)
    product_lo = (power - power_hi) * log_hi + power * log_lo
    product_hi = power_hi * log_hi
    return _power_exp2(product_hi, product_lo, sign)


class NumericError(ValueError):
    """Typed raw numerical caller error, separate from IEEE result values."""
    code = "CALC-TYPE-001"


def _binary64(value, parameter):
    # A Python float is the primitive binary64 carrier. Python's unbounded int,
    # bool and decimal types are not implicitly converted at this raw boundary.
    if type(value) is not float:
        raise NumericError(parameter + " must be a primitive binary64 float")
    return value


def pinned_pow(base, exponent):
    """Raw RFC 0088 power: typed inputs, unquantized IEEE result."""
    return pow(_binary64(base, "base"), _binary64(exponent, "exponent"))


def pinned_exp(value):
    """Raw RFC 0088 exponential; no calc finite-result refusal."""
    return exp(_binary64(value, "value"))


def pinned_log(value):
    """Raw RFC 0088 logarithm; no calc positive-domain refusal."""
    return log(_binary64(value, "value"))
