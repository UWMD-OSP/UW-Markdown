"""Shared strict instant controls, independent Python calendar implementation."""
import json
from pathlib import Path
import unittest
from uwmd_instant import epoch_milliseconds, validation_now_milliseconds, ValidationClockError
ROOT=Path(__file__).resolve().parents[2]
class GapInstantTests(unittest.TestCase):
    def test_shared_calendar_and_offset_controls(self):
        for row in json.loads((ROOT/'conformance/data-quality/0122-instants.json').read_text(encoding='utf-8')):
            with self.subTest(value=row['input']):
                self.assertEqual(epoch_milliseconds(row['input']),row['milliseconds'])
    def test_supplied_clock_uses_same_closed_grammar(self):
        for value in ['', '2026-02-30', '2026-10-01T00:00', False, 1]:
            with self.subTest(value=value),self.assertRaises(ValidationClockError) as caught:
                validation_now_milliseconds(value)
            self.assertEqual(caught.exception.code,'PROTO-VALIDATION-CLOCK')
        self.assertEqual(validation_now_milliseconds('1970-01-01'),0)
