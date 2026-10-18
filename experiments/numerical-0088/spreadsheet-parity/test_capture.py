"""Focused evidence-boundary controls, not named-engine numerical evidence."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("spreadsheet_capture", HERE / "capture.py")
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


class EvidenceBoundary(unittest.TestCase):
    def write_modified(self, destination, edit):
        data = capture.parts(HERE / "controls.xlsx")
        name, sheet = capture.worksheet(data)
        edit(sheet)
        data[name] = ET.tostring(sheet)
        with zipfile.ZipFile(destination, "w") as output:
            for member, payload in data.items():
                output.writestr(member, payload)

    def test_original_identity_and_complete_formula_inventory(self):
        data = capture.read_book(HERE / "controls.xlsx", require_results=False)
        self.assertEqual(len(data["controls"]), 10)

    def test_prepare_removes_every_formula_cache_without_changing_source(self):
        before = capture.sha(HERE / "controls.xlsx")
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "input.xlsx"
            self.assertEqual(capture.prepare(HERE / "controls.xlsx", target), 20)
            rows = capture.read_book(target, require_results=False)["controls"]
            self.assertTrue(all(row[col]["kind"] == "blank" for row in rows for col in ("G", "H")))
            with self.assertRaisesRegex(ValueError, "Missing recalculated cache"):
                capture.read_book(target)
        self.assertEqual(capture.sha(HERE / "controls.xlsx"), before)

    def test_changed_input_is_not_accepted_as_original_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "changed.xlsx"
            capture.prepare(HERE / "controls.xlsx", target, changed=True)
            with self.assertRaisesRegex(ValueError, "Input changed at B4"):
                capture.read_book(target, require_results=False)

    def test_changed_formula_is_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "changed.xlsx"
            self.write_modified(target, lambda sheet: setattr(
                sheet.find(".//s:c[@r='G4']/s:f", capture.NS), "text", "42"))
            with self.assertRaisesRegex(ValueError, "Formula changed at G4"):
                capture.read_book(target, require_results=False)

    def test_removed_formula_is_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "changed.xlsx"
            def remove(sheet):
                cell = sheet.find(".//s:c[@r='G4']", capture.NS)
                cell.remove(cell.find("s:f", capture.NS))
            self.write_modified(target, remove)
            with self.assertRaisesRegex(ValueError, "Formula inventory changed"):
                capture.read_book(target, require_results=False)


if __name__ == "__main__":
    unittest.main()
