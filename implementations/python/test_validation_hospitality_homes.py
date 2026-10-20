"""Accepted G3 field-home admission through developing validate, no tier claim."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate, well_formed
from test_validation_external import external
from uwmd_reader import parse
from uwmd_validation_selection import select_section

REMOVED = ("adr", "occupancy", "available_room_nights", "key_count")


def header(asset="hospitality"):
    return HEADER.replace(b"asset_class: multifamily", ("asset_class: " + asset).encode())


def part(section, values=None, **identity):
    body = parse(HEADER + well_formed(section)).source.blocks[0].parsed.value
    body.update(values or {})
    return block(section, body, **identity)


def record(*sections, asset="hospitality"):
    return header(asset) + well_formed("property", address="A", asset_class=asset, keys=1) + b"".join(sections)


def home_issues(result):
    return [(i["section"], i["field"]) for i in result["issues"] if i["code"] == "CLS-04"
            and (i["section"], i["field"]) in {("rent_roll", "keys"), *(("hotel_metrics", f) for f in REMOVED)}]


class HospitalityHomeValidationTests(unittest.TestCase):
    def assess(self, raw):
        document = parse(raw); before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        for severity, key in (("error", "errors"), ("warning", "warnings"), ("info", "info")):
            self.assertEqual(result[key], [i for i in result["issues"] if i["severity"] == severity])
        return result

    def test_removed_field_presence_including_null_and_no_alias_normalization(self):
        for field in REMOVED:
            for value in (None, 0, "stated", False):
                with self.subTest(field=field, value=value):
                    result = self.assess(record(part("hotel_metrics", {field: value})))
                    self.assertEqual(home_issues(result), [("hotel_metrics", field)])
                    self.assertEqual(result["overall_status"], "errors")
        result = self.assess(record(part("rent_roll", dict(keys=None, available_room_nights=10))))
        self.assertEqual(home_issues(result), [("rent_roll", "keys")])
        lawful = record(part("rent_roll", dict(available_room_nights=10, occupied_room_nights=5,
                                               adr=100, occupancy=.5)),
                        part("hotel_metrics", dict(market_revpar=None)))
        self.assertEqual(home_issues(self.assess(lawful)), [])

    def test_selected_primary_and_eligibility_never_expand_to_unselected_components(self):
        for section, bad, good in (("rent_roll", dict(keys=1, available_room_nights=10),
                                    dict(available_room_nights=10)),
                                   ("hotel_metrics", dict(adr=100), dict(market_revpar=None))):
            for selected_bad in (False, True):
                primary = part(section, bad if selected_bad else good, variant="primary", role="primary")
                peer = part(section, good if selected_bad else bad, variant="component", role="component")
                result = self.assess(record(primary, peer))
                self.assertEqual(len(home_issues(result)), int(selected_bad))

    def test_default_preference_current_revision_and_role_collision_are_exact(self):
        selected = part("hotel_metrics", dict(adr=100), variant="default", role="detail")
        other = part("hotel_metrics", dict(market_revpar=None), variant="peer", role="detail")
        self.assertEqual(home_issues(self.assess(record(selected, other))), [("hotel_metrics", "adr")])
        primary = part("hotel_metrics", dict(market_revpar=None), variant="primary", role="primary")
        self.assertEqual(home_issues(self.assess(record(selected, primary))), [])
        # Same-key revisions select the latest; no first/last cross-key fallback.
        replaced = part("hotel_metrics", dict(market_revpar=None), variant="default", role="detail")
        self.assertEqual(home_issues(self.assess(record(selected, replaced))), [])
        collide = part("hotel_metrics", dict(adr=10), variant="other", role="primary")
        raw = record(primary, collide)
        self.assertEqual(select_section(parse(raw), "hotel_metrics").reason, "variant_unresolvable")
        self.assertEqual(home_issues(self.assess(raw)), [])

    def test_history_externalized_foreign_class_and_unknown_fields_do_not_gain_codes(self):
        bad = part("hotel_metrics", dict(adr=None), superseded=True)
        current = part("hotel_metrics", dict(market_revpar=None))
        self.assertEqual(home_issues(self.assess(record(bad, current))), [])
        result = self.assess(record(external("hotel_metrics", adr=100)))
        self.assertEqual(home_issues(result), [])
        self.assertEqual(result["composition_assessment"]["status"], "unresolved")
        result = self.assess(record(part("hotel_metrics", dict(adr=100)), asset="multifamily"))
        self.assertEqual(home_issues(result), [])
        # This predicate does not allocate arbitrary closed-schema extras. Their
        # complete admission/wire behavior remains an explicit validator gate.
        result = self.assess(record(part("hotel_metrics", dict(future=1, content={"adr":100}))))
        self.assertEqual(home_issues(result), [])

    def test_universal_annotations_and_returned_findings_do_not_rewrite_payloads(self):
        raw = record(part("hotel_metrics", dict(adr=100, _notes={"opaque":True},
                         _overrides=[dict(path="adr", note="authored")]), role="primary"))
        parsed = parse(raw); before = copy.deepcopy(parsed)
        result = validate(parsed)
        self.assertEqual(home_issues(result), [("hotel_metrics", "adr")])
        result["errors"][0]["field"] = "consumer-edit"
        self.assertEqual(parsed, before)
        self.assertEqual(home_issues(validate(parsed)), [("hotel_metrics", "adr")])

    def test_real_command_returns_registered_invalid_partitions_and_parse_only_manifest(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-hospitality-homes-") as folder:
            source = Path(folder)/"case.uwx.md"
            for fields in ({"adr":None}, {"occupancy":.5}, {"available_room_nights":10}, {"key_count":1}, {}):
                raw = record(part("hotel_metrics", fields)); source.write_bytes(raw)
                command = [sys.executable, "-B", str(ROOT/"implementations/python/uwmd.py"),
                           "validate", str(source), "--json"]
                run = subprocess.run(command, capture_output=True, encoding="utf8", timeout=30)
                result = json.loads(run.stdout)
                self.assertEqual(run.stderr, "")
                self.assertNotIn("error", result)
                self.assertEqual(run.returncode, int(bool(fields)))
                self.assertEqual(home_issues(result), [("hotel_metrics", next(iter(fields)))] if fields else [])
                self.assertEqual(source.read_bytes(), raw)
            run = subprocess.run([sys.executable, "-B", str(ROOT/"implementations/python/uwmd.py"),
                                  "manifest"], capture_output=True, encoding="utf8", timeout=30)
            self.assertEqual(json.loads(run.stdout)["capabilities"], ["parse", "validate", "calc-evaluate"])


if __name__ == "__main__":
    unittest.main()
