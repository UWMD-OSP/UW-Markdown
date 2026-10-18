"""Exact accepted field-home predicates, independent of WIP orchestration."""
import copy
import unittest

from uwmd_builtin_field_homes import removed_hospitality_fields


class BuiltinFieldHomeTests(unittest.TestCase):
    def test_each_explicit_removed_home_includes_null_and_every_json_type(self):
        for section, fields in (("rent_roll", ("keys",)),
                ("hotel_metrics", ("adr", "occupancy", "available_room_nights", "key_count"))):
            for field in fields:
                for value in (None, False, True, 0, 1.5, "stated", [], {}):
                    with self.subTest(section=section, field=field, value=value):
                        self.assertEqual(removed_hospitality_fields(section, {field: value}), (field,))
            self.assertEqual(removed_hospitality_fields(section, {}), ())

    def test_unrelated_fields_annotations_case_and_nested_payload_are_not_allocated(self):
        body = dict(_meta=None, _role="component", _overrides=[], _notes="note",
                    market_revpar=None, future=1, ADR=5, content={"adr": 5})
        before = copy.deepcopy(body)
        self.assertEqual(removed_hospitality_fields("hotel_metrics", body), ())
        self.assertEqual(removed_hospitality_fields("property", {"keys": 1}), ())
        self.assertEqual(removed_hospitality_fields("rent_roll", {"adr": 1, "occupancy": .5}), ())
        self.assertEqual(body, before)

    def test_exact_rule_order_and_nonobject_inputs_do_not_invent_findings(self):
        body = dict(key_count=1, available_room_nights=10, occupancy=.5, adr=50)
        self.assertEqual(removed_hospitality_fields("hotel_metrics", body),
                         ("adr", "occupancy", "available_room_nights", "key_count"))
        for value in (None, False, 0, [], "keys"):
            self.assertEqual(removed_hospitality_fields("rent_roll", value), ())


if __name__ == "__main__":
    unittest.main()
