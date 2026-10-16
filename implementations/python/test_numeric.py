"""Independent known-answer controls; not portable conformance certification."""
import datetime
import math
import unittest

from uwmd_numeric import calendar_date, cash_totals, quantize, year_fraction


class NumericTests(unittest.TestCase):
    def test_decimal_boundary(self):
        for number, places, expected in [(1.005, 2, 1.01), (-1.005, 2, -1.01),
                (2.5, 0, 3), (-2.5, 0, -3), (455743.89999999997, 2, 455743.9),
                (1e308, 12, 1e308), (1234, -2, 1200), (1e-7, 6, 0)]:
            with self.subTest(number=number):
                self.assertEqual(quantize(number, places), expected)

    def test_positive_zero(self):
        self.assertEqual(math.copysign(1, quantize(-0.00001, 2)), 1)

    def test_refusal(self):
        for number, places in [(None, 2), (True, 2), (math.inf, 2), (math.nan, 2),
                               (1, True), (1, 13), (1, 1.5)]:
            with self.subTest(number=number, places=places), self.assertRaises(ValueError):
                quantize(number, places)

    def test_dates(self):
        self.assertTrue(calendar_date("2024-02-29"))
        for value in ["2023-02-29", "2024-2-29", None, 20240101,
                      "２０２４-01-01", "2024-01-01T00:00:00Z"]:
            self.assertFalse(calendar_date(value))

    def test_proleptic_calendar_boundaries(self):
        for value in ["0000-01-01", "0000-02-29", "0000-12-31", "0001-01-01",
                      "0400-02-29", "9999-12-31"]:
            with self.subTest(value=value):
                self.assertTrue(calendar_date(value))
        for value in ["0000-02-30", "0000-00-01", "0000-13-01", "0000-01-00",
                      "0001-02-29", "0100-02-29", "1900-02-29", "9999-02-29",
                      "10000-01-01", "-001-01-01"]:
            with self.subTest(value=value):
                self.assertFalse(calendar_date(value))

    def test_year_zero_day_counts(self):
        # Hand-counted Gregorian boundaries; no host date parser or TS oracle.
        for first, last, days in [
                ("0000-01-01", "0000-01-01", 0),
                ("0000-02-28", "0000-03-01", 2),
                ("0000-02-29", "0000-03-01", 1),
                ("0000-12-31", "0001-01-01", 1),
                ("0000-01-01", "0001-01-01", 366),
                ("0000-01-01", "0400-01-01", 146097),
                ("0001-01-01", "0101-01-01", 36524),
                ("9999-12-30", "9999-12-31", 1)]:
            for convention, denominator in [("actual/365f", 365), ("actual/360", 360)]:
                with self.subTest(first=first, last=last, convention=convention):
                    self.assertEqual(year_fraction(first, last, convention), days / denominator)
        for first, last, days in [
                ("0000-02-29", "0000-03-31", 32),
                ("0000-01-31", "0000-03-31", 60),
                ("0000-12-31", "0001-01-31", 30),
                ("0000-01-01", "0001-01-01", 360)]:
            with self.subTest(first=first, last=last):
                self.assertEqual(year_fraction(first, last, "30/360us"), days / 360)
        for arguments in [("0000-03-01", "0000-02-29", "actual/365f"),
                          ("0000-02-30", "0000-03-01", "actual/365f"),
                          ("0000-01-01", "0001-01-01", "actual/actual")]:
            with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                year_fraction(*arguments)

    def test_actual_days_against_shifted_calendar(self):
        # Gregorian leap patterns repeat every 400 years. The host calendar
        # can independently check year zero after shifting both endpoints.
        for first, last in [
                ("0000-02-28", "0000-03-01"),
                ("0000-12-31", "0001-01-01"),
                ("0000-01-01", "0001-01-01"),
                ("0000-01-01", "0400-01-01"),
                ("0099-12-31", "0100-03-01"),
                ("0399-12-31", "0400-03-01"),
                ("9599-01-01", "9599-12-31")]:
            first_parts = tuple(map(int, first.split("-")))
            last_parts = tuple(map(int, last.split("-")))
            shifted_first = datetime.date(first_parts[0] + 400, *first_parts[1:])
            shifted_last = datetime.date(last_parts[0] + 400, *last_parts[1:])
            days = (shifted_last - shifted_first).days
            for convention, denominator in [("actual/365f", 365), ("actual/360", 360)]:
                with self.subTest(first=first, last=last, convention=convention):
                    self.assertEqual(year_fraction(first, last, convention), days / denominator)

    def test_day_count(self):
        self.assertEqual(year_fraction("2024-01-01", "2025-01-01", "actual/365f"), 366 / 365)
        self.assertEqual(year_fraction("2024-01-01", "2025-01-01", "actual/360"), 366 / 360)
        self.assertEqual(year_fraction("2024-02-29", "2024-03-31", "30/360us"), 32 / 360)
        self.assertEqual(year_fraction("2024-01-31", "2024-03-31", "30/360us"), 60 / 360)
        for arguments in [("2025-01-01", "2024-01-01", "actual/365f"),
                          ("2024-01-01", "2025-01-01", "actual/actual")]:
            with self.assertRaises(ValueError):
                year_fraction(*arguments)

    def test_cash_totals(self):
        self.assertEqual(cash_totals([-100, 0, 25, 125]), (50, 1.5))
        self.assertEqual(cash_totals([0, 10]), (10, None))
        self.assertEqual(cash_totals([-100]), (-100, 0))
        with self.assertRaises(ValueError):
            cash_totals([-100, None, 150])
        with self.assertRaises(ValueError):
            cash_totals([-1e308, -1e308])


if __name__ == "__main__":
    unittest.main()
