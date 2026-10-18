"""Independent Python checks against hand-specified bit/integer known answers."""
import json
import pathlib
import unittest
import binary64 as bits

VECTORS = json.loads((pathlib.Path(__file__).parent / "vectors.json").read_text(encoding="utf-8"))


def word(value):
    return int(value, 16)


class BitAdapterTests(unittest.TestCase):
    def test_finite_words_and_insertion(self):
        for row in VECTORS["finite"]:
            with self.subTest(decimal=row["decimal"]):
                expected = {"hi": word(row["hi"]), "lo": word(row["lo"])}
                self.assertEqual(bits.split(float(row["decimal"])), expected)
                self.assertEqual(bits.split(bits.join(expected["hi"], expected["lo"])), expected)
        self.assertEqual(bits.split(bits.replace_high(bits.join(0x3ff00000, 1), 0xbff00000)),
                         {"hi": 0xbff00000, "lo": 1})
        self.assertEqual(bits.split(bits.replace_low(bits.join(0x3ff00000, 1), 0)),
                         {"hi": 0x3ff00000, "lo": 0})
        self.assertEqual(bits.split(bits.replace_high(-0.0, 0)), {"hi": 0, "lo": 0})

    def test_normalization_and_signed(self):
        for row in VECTORS["normalize"]:
            self.assertEqual(bits.u32(row["input"]), word(row["word"]))
        for row in VECTORS["signed"]:
            self.assertEqual(bits.i32(word(row["word"])), row["value"])

    def test_bitwise(self):
        for row in VECTORS["bitwise"]:
            left, right = word(row["left"]), word(row["right"])
            self.assertEqual(bits.and32(left, right), word(row["and"]))
            self.assertEqual(bits.or32(left, right), word(row["or"]))
            self.assertEqual(bits.xor32(left, right), word(row["xor"]))
            self.assertEqual(bits.not32(left), word(row["not_left"]))

    def test_shifts(self):
        for row in VECTORS["shifts"]:
            with self.subTest(row=row):
                value, count = word(row["word"]), row["count"]
                self.assertEqual(bits.shl32(value, count), word(row["left"]))
                self.assertEqual(bits.shr32(value, count), word(row["right"]))
                self.assertEqual(bits.sar32(value, count), word(row["arithmetic"]))
        self.assertEqual(bits.shr32(0x80000001, 32 - 0), 0)

    def test_carry_and_borrow(self):
        for name, function, flag in [("add", bits.add32, "carry"), ("sub", bits.sub32, "borrow")]:
            for row in VECTORS[name]:
                self.assertEqual(function(word(row["left"]), word(row["right"])),
                                 {"word": word(row["word"]), flag: row[flag]})
        low = bits.add32(0xffffffff, 1)
        self.assertEqual(bits.add32(0x12345678, low["carry"]), {"word": 0x12345679, "carry": 0})
        low = bits.sub32(0, 1)
        self.assertEqual(bits.sub32(0x12345678, low["borrow"]), {"word": 0x12345677, "borrow": 0})

    def test_refusals(self):
        for value in [-1, 1 << 32, 0.5, True, None, float("nan"), float("inf")]:
            for function in [bits.i32, bits.not32, lambda x: bits.and32(x, 0),
                             lambda x: bits.or32(x, 0), lambda x: bits.xor32(x, 0), lambda x: bits.shl32(x, 0), lambda x: bits.shr32(x, 0),
                             lambda x: bits.sar32(x, 0), lambda x: bits.add32(x, 0),
                             lambda x: bits.sub32(x, 0), lambda x: bits.join(x, 0),
                             lambda x: bits.join(0, x)]:
                with self.assertRaises((TypeError, ValueError)):
                    function(value)
        for count in [-1, 33, 0.5, True, None]:
            for function in [bits.shl32, bits.shr32, bits.sar32]:
                with self.assertRaises((TypeError, ValueError)):
                    function(1, count)
        for value in [1, True, None, "1", float("nan"), float("inf"), -float("inf")]:
            with self.assertRaises((TypeError, ValueError)):
                bits.split(value)
        for value in [0.5, True, None, 1 << 53]:
            with self.assertRaises((TypeError, ValueError)):
                bits.u32(value)
        for hi in [0x7ff00000, 0xfff00000, 0x7ff80000]:
            with self.assertRaises(ValueError):
                bits.join(hi, 0)


if __name__ == "__main__":
    unittest.main()
