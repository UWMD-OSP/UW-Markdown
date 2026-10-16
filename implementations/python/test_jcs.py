"""RFC 8785 published known answers, independent of Node and UWMD output."""
import json
import math
import struct
import unittest

from uwmd_jcs import CanonicalizationError, canonicalize


class JCSTests(unittest.TestCase):
    def test_rfc8785_appendix_b_binary64_known_answers(self):
        vectors = {
            "0000000000000000": "0", "8000000000000000": "0",
            "0000000000000001": "5e-324", "8000000000000001": "-5e-324",
            "7fefffffffffffff": "1.7976931348623157e+308", "ffefffffffffffff": "-1.7976931348623157e+308",
            "4340000000000000": "9007199254740992", "c340000000000000": "-9007199254740992",
            "4430000000000000": "295147905179352830000",
            "44b52d02c7e14af5": "9.999999999999997e+22", "44b52d02c7e14af6": "1e+23",
            "44b52d02c7e14af7": "1.0000000000000001e+23",
            "444b1ae4d6e2ef4e": "999999999999999700000", "444b1ae4d6e2ef4f": "999999999999999900000",
            "444b1ae4d6e2ef50": "1e+21", "3eb0c6f7a0b5ed8c": "9.999999999999997e-7",
            "3eb0c6f7a0b5ed8d": "0.000001", "41b3de4355555553": "333333333.3333332",
            "41b3de4355555554": "333333333.33333325", "41b3de4355555555": "333333333.3333333",
            "41b3de4355555556": "333333333.3333334", "41b3de4355555557": "333333333.33333343",
            "becbf647612f3696": "-0.0000033333333333333333", "43143ff3c1cb0959": "1424953923781206.2",
        }
        for bits, expected in vectors.items():
            with self.subTest(bits=bits):
                self.assertEqual(canonicalize(struct.unpack(">d", bytes.fromhex(bits))[0]), expected)
        for bits in ("7fffffffffffffff", "7ff0000000000000", "fff0000000000000"):
            with self.assertRaises(CanonicalizationError):
                canonicalize(struct.unpack(">d", bytes.fromhex(bits))[0])

    def test_rfc8785_unicode_key_order_and_nested_arrays(self):
        value = {"€": 5, "\r": 1, "דּ": 7, "1": 2, "😀": 6, "\x80": 3, "ö": 4}
        self.assertEqual(canonicalize(value), '{"\\r":1,"1":2,"\x80":3,"ö":4,"€":5,"😀":6,"דּ":7}')
        self.assertEqual(canonicalize([{"b": 1, "a": 2}, 0]), '[{"a":2,"b":1},0]')

    def test_rfc8785_utf8_example_and_string_preservation(self):
        value = {"numbers": [333333333.33333329, 1e30, 4.50, 2e-3, 1e-27],
                 "string": "€$\x0f\nA'B\"\\\\\"/", "literals": [None, True, False]}
        expected_hex = ("7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a"
                        "5b3333333333333333332e333333333333332c31652b33302c342e352c302e3030322c31652d3237"
                        "5d2c22737472696e67223a22e282ac245c75303030665c6e4127425c225c5c5c5c5c222f227d")
        self.assertEqual(canonicalize(value).encode("utf-8").hex(), expected_hex)
        self.assertEqual(canonicalize("\b\t\n\f\r/\u2028\u2029"), '"\\b\\t\\n\\f\\r/\u2028\u2029"')
        self.assertNotEqual(canonicalize("é"), canonicalize("e\u0301"))

    def test_non_json_unrepresentable_and_invalid_unicode_refuse(self):
        for value in ({1: "x"}, {"x": {1, 2}}, float("nan"), float("inf"), "\ud800", {"\udfff": 1}, 9007199254740993, 10 ** 500):
            with self.subTest(value=repr(value)[:50]), self.assertRaises(CanonicalizationError):
                canonicalize(value)
        self.assertEqual(canonicalize(9007199254740992), "9007199254740992")

    def test_deterministic_roundtrip_and_signed_boundaries(self):
        # Arithmetic-free bit-pattern sampling of serializer round trips.
        for exponent in range(0, 2047, 31):
            for mantissa in (0, 1, (1 << 51) + 3, (1 << 52) - 1):
                bits = (exponent << 52) | mantissa
                value = struct.unpack(">d", bits.to_bytes(8, "big"))[0]
                for signed in (value, -value):
                    self.assertEqual(float(canonicalize(signed)), signed)
        self.assertEqual(canonicalize(math.nextafter(1e21, 0)), "999999999999999900000")
        self.assertEqual(canonicalize(math.nextafter(1e-6, 0)), "9.999999999999997e-7")


if __name__ == "__main__":
    unittest.main()
