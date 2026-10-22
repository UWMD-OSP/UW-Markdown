"""RFC 0100 size contract: the same closed table and readings as the reference."""
import asyncio
import json
import unittest

from uwmd_reader import parse
from uwmd_size_contract import COUNT, MEASURE, SIZE_CONTRACT, meets
from uwmd_validation import validate_document


def document(asset, **blocks):
    body = "".join(f"\n```json uw:section={section} source=manual\n{json.dumps(value)}\n```\n"
                   for section, value in blocks.items())
    return parse(f'---\nuw_version: "3.0"\nasset_class: {asset}\n---\n{body}'.encode())


def size_fields(doc):
    result = asyncio.run(validate_document(doc, now="2026-10-20T00:00:00Z"))
    return [f'{i["section"]}.{i["field"]}' for i in result["issues"] if i["code"] == "SIZE-01"]


class SizeContractTests(unittest.TestCase):
    def test_readings(self):
        self.assertTrue(meets(1.0, COUNT))
        self.assertTrue(meets(0, COUNT))
        self.assertFalse(meets(10.5, COUNT))
        self.assertFalse(meets(-1, COUNT))
        self.assertTrue(meets(10.5, MEASURE))
        self.assertFalse(meets(-0.01, MEASURE))
        self.assertFalse(meets(True, MEASURE))
        self.assertFalse(meets("100", COUNT))
        self.assertTrue(meets(None, COUNT))

    def test_each_kind_and_the_twin(self):
        self.assertEqual(size_fields(document("multifamily", property={"total_units": -180})), ["property.total_units"])
        self.assertEqual(size_fields(document("office", rent_roll={"total_rentable_sf": -5000})), ["rent_roll.total_rentable_sf"])
        self.assertEqual(size_fields(document("multifamily", rent_roll={"units": [{"monthly_rent": 1}, {"monthly_rent": -1}]})),
                         ["rent_roll.units[1].monthly_rent"])
        self.assertEqual(size_fields(document("manufactured_housing", mhc_sites={"total_sites": 200}, rent_roll={"total_sites": -200})),
                         ["rent_roll.total_sites"])

    def test_zero_null_and_signed_amounts_are_admitted(self):
        self.assertEqual(size_fields(document("land", property={"gross_acres": 40, "entitled_units": 0, "usable_acres": None})), [])
        self.assertEqual(size_fields(document("multifamily", rent_roll={"concessions_monthly": -5400})), [])

    def test_closed_table(self):
        self.assertEqual(list(SIZE_CONTRACT), ["property", "rent_roll"])


if __name__ == "__main__":
    unittest.main()
