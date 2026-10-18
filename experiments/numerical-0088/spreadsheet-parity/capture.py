"""Named-engine research capture. Standard library only; no COM or workbook cache oracle."""
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import posixpath
import shutil
import struct
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
S = "{" + NS["s"] + "}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
CONTROLS = json.loads((HERE / "controls.json").read_text(encoding="utf-8-sig"))["controls"]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dump(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def bits(value):
    return struct.pack(">d", value).hex()


def parts(path):
    with zipfile.ZipFile(path) as book:
        return {name: book.read(name) for name in book.namelist()}


def worksheet(data):
    book = ET.fromstring(data["xl/workbook.xml"])
    sheets = book.findall("s:sheets/s:sheet", NS)
    if len(sheets) != 1 or sheets[0].get("name") != "Numerical controls":
        raise ValueError("Expected the single original Numerical controls sheet")
    rels = ET.fromstring(data["xl/_rels/workbook.xml.rels"])
    target = next(x.get("Target") for x in rels if x.get("Id") == sheets[0].get(REL + "id"))
    name = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
    return name, ET.fromstring(data[name])


def text_value(cell, data):
    if cell is None:
        return None
    kind = cell.get("t")
    if kind == "inlineStr":
        return "".join(cell.itertext())
    value = cell.findtext("s:v", default="", namespaces=NS)
    if kind == "s":
        strings = ET.fromstring(data["xl/sharedStrings.xml"]).findall("s:si", NS)
        return "".join(strings[int(value)].itertext())
    return value


def read_book(path, require_results=True):
    data = parts(path)
    _, sheet = worksheet(data)
    cells = {x.get("r"): x for x in sheet.findall(".//s:sheetData/s:row/s:c", NS)}
    expected_formulas = {f"{col}{row}" for row in range(4, 14) for col in ("G", "H")}
    actual_formulas = {key for key, cell in cells.items() if cell.find("s:f", NS) is not None}
    if actual_formulas != expected_formulas:
        raise ValueError("Formula inventory changed")
    rows = []
    for row, control in enumerate(CONTROLS, 4):
        if text_value(cells.get(f"A{row}"), data) != control[0]:
            raise ValueError(f"Control id changed at row {row}")
        for index, col in enumerate("BCDE", 1):
            observed = text_value(cells.get(f"{col}{row}"), data)
            expected = control[index]
            if expected is None:
                if observed not in (None, ""):
                    raise ValueError(f"Unexpected input at {col}{row}")
            elif observed is None or bits(float(observed)) != bits(float(expected)):
                raise ValueError(f"Input changed at {col}{row}")
        record = {"id": control[0], "row": row}
        for index, col in enumerate(("G", "H"), 6):
            cell = cells[f"{col}{row}"]
            formula = cell.findtext("s:f", namespaces=NS)
            # Prefix spelling can change across OOXML writers; no graph normalization.
            normalized = formula.removeprefix("=").replace("_xlfn.", "")
            if normalized != control[index].removeprefix("="):
                raise ValueError(f"Formula changed at {col}{row}: {formula}")
            lexeme = cell.findtext("s:v", namespaces=NS)
            if lexeme in (None, ""):
                if require_results:
                    raise ValueError(f"Missing recalculated cache at {col}{row}")
                result = {"kind": "blank"}
            elif cell.get("t") == "e":
                result = {"kind": "spreadsheet_error", "lexeme": lexeme}
            elif cell.get("t") not in (None, "n"):
                raise ValueError(f"Nonnumeric result type at {col}{row}")
            else:
                value = float(lexeme)
                if not math.isfinite(value):
                    raise ValueError(f"Invalid nonfinite OOXML numeric cell at {col}{row}")
                result = {"kind": "binary64", "lexeme": lexeme, "value": value, "bits": bits(value)}
            record[col] = {**result, "formula": formula}
        rows.append(record)
    app = ET.fromstring(data.get("docProps/app.xml", b"<Properties/>"))
    metadata = {node.tag.rsplit("}", 1)[-1]: node.text for node in app}
    return {"controls": rows, "application": metadata.get("Application"), "app_version": metadata.get("AppVersion")}


def prepare(source, destination, changed=False):
    data = parts(source)
    name, sheet = worksheet(data)
    count = 0
    for cell in sheet.findall(".//s:sheetData/s:row/s:c", NS):
        if cell.find("s:f", NS) is not None:
            for value in list(cell.findall("s:v", NS)):
                cell.remove(value)
            cell.attrib.pop("t", None)
            count += 1
        if changed and cell.get("r") == "B4":
            cell.find("s:v", NS).text = "1.21"
    if count != 20:
        raise ValueError("Expected exactly twenty formula cells")
    data[name] = ET.tostring(sheet, encoding="utf-8", xml_declaration=True)
    book = ET.fromstring(data["xl/workbook.xml"])
    calc = book.find("s:calcPr", NS)
    if calc is None:
        calc = ET.SubElement(book, S + "calcPr")
    calc.attrib.update(calcMode="auto", fullCalcOnLoad="1", forceFullCalc="1")
    data["xl/workbook.xml"] = ET.tostring(book, encoding="utf-8", xml_declaration=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as out:
        for member, payload in data.items():
            out.writestr(member, payload)
    return count


def run(command, output, label, cwd=ROOT):
    proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=180)
    (output / (label + ".stdout.txt")).write_text(proc.stdout, encoding="utf-8")
    (output / (label + ".stderr.txt")).write_text(proc.stderr, encoding="utf-8")
    if proc.returncode:
        raise RuntimeError(f"{label} failed ({proc.returncode}); see retained streams")
    return {"command": [str(x) for x in command], "exit": proc.returncode, "stdout": proc.stdout}


def libreoffice(output, executable):
    version = run([executable, "--version"], output, "engine-version")["stdout"].strip()
    if not version.startswith("LibreOffice "):
        raise ValueError("Named LibreOffice version not obtained")
    profile = output / "profile"
    (profile / "user").mkdir(parents=True)
    # Official schema: 0 = always hard-recalculate OOXML on load; default 1 = never.
    (profile / "user/registrymodifications.xcu").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<oor:items xmlns:oor="http://openoffice.org/2001/registry">'
        '<item oor:path="/org.openoffice.Office.Calc/Formula/Load">'
        '<prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop>'
        '</item></oor:items>', encoding="utf-8")
    commands = []
    paths = []
    for label, changed in (("base", False), ("changed", True), ("restored", False)):
        inputs, results = output / (label + "-input"), output / (label + "-result")
        inputs.mkdir()
        results.mkdir()
        prepared = inputs / "controls.xlsx"
        prepare(HERE / "controls.xlsx", prepared, changed)
        command = [executable, "-env:UserInstallation=" + profile.as_uri(), "--headless",
                   "--norestore", "--convert-to", "xlsx:Calc MS Excel 2007 XML",
                   "--outdir", str(results), str(prepared)]
        commands.append(run(command, output, label))
        saved = results / "controls.xlsx"
        if not saved.is_file():
            raise ValueError(f"{label}: successful process did not write converted workbook")
        paths.append(saved)
    base = read_book(paths[0])
    # For the changed control only, read its independently saved G4 directly;
    # read_book intentionally rejects changed inputs.
    _, mutated = worksheet(parts(paths[1]))
    changed_cell = mutated.find(".//s:c[@r='G4']/s:v", NS)
    changed_value = float(changed_cell.text)
    restored = read_book(paths[2])
    if bits(changed_value) == base["controls"][0]["G"].get("bits"):
        raise ValueError("Changed-input recalculation control did not change G4")
    if restored["controls"] != base["controls"]:
        raise ValueError("Restored-input recalculation did not restore complete result cells")
    return paths[0], {"name": "LibreOffice Calc", "version": version,
                     "recalculation": "OOXMLRecalcMode=0 hard recalculation on load; all20 input formula caches removed; headless XLSX conversion",
                     "commands": commands,
                     "mutation_control": {"input": "B4", "changed_to": 1.21,
                                          "changed_G4": {"value": changed_value, "bits": bits(changed_value)},
                                          "restored_all20_cells": True}}


def capture(args):
    original = HERE / "controls.xlsx"
    read_book(original, require_results=False)
    before = sha(original)
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    if args.engine == "libreoffice":
        saved, engine = libreoffice(output, args.executable)
    else:
        saved = Path(args.saved).resolve()
        if saved == original.resolve() or sha(saved) == before:
            raise ValueError("Supply the newly saved Excel file, not the authored input")
        observed = read_book(saved)
        if not (observed["application"] or "").startswith("Microsoft Excel") or not observed["app_version"]:
            raise ValueError("Saved-file Microsoft Excel Application/AppVersion identity is required")
        engine = {"name": "Microsoft Excel", "version": args.excel_version or observed["app_version"],
                  "version_source": "owner-supplied exact version" if args.excel_version else "saved OOXML AppVersion (not an exact product build)",
                  "saved_application": observed["application"], "saved_app_version": observed["app_version"],
                  "recalculation": "owner-attested interactive Ctrl+Alt+Shift+F9 then Save As; capture performs no calculation",
                  "original_returned_path": str(saved)}
    shutil.copyfile(saved, output / "recalculated.xlsx")
    dump(output / "native.json", read_book(output / "recalculated.xlsx"))
    comparison = run([args.node, str(HERE / "compare.mjs"), str(output / "native.json")], output, "comparison")
    parsed = json.loads(comparison["stdout"])
    dump(output / "comparison.json", parsed)
    if sha(original) != before:
        raise ValueError("Committed research input changed")
    identities = {}
    for path in sorted(HERE.glob("*")):
        if path.is_file():
            identities[str(path.relative_to(ROOT)).replace(os.sep, "/")] = sha(path)
    for path in sorted((ROOT / "packages/uwmd-verify/src/calc").rglob("*.ts")):
        if path.is_file():
            identities[str(path.relative_to(ROOT)).replace(os.sep, "/")] = sha(path)
    for name in ("pinned-numerics.js", "quantize.js", "stated-precision.js", "errors.js"):
        path = ROOT / "packages/uwmd-verify/dist/calc" / name
        identities[str(path.relative_to(ROOT)).replace(os.sep, "/")] = sha(path)
    candidate_dir = ROOT / "packages/uwmd-verify/dist/calc/pinned-fdlibm"
    if candidate_dir.exists():
        for path in sorted(candidate_dir.glob("*.js")):
            identities[str(path.relative_to(ROOT)).replace(os.sep, "/")] = sha(path)
    manifest = {
        "scope": "UNACCEPTED ten-control named-engine recalculation; native mismatch is an export-contract finding, not arithmetic authorization",
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "captured_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "platform": platform.platform(), "python": platform.python_version(),
        "engine": engine, "node": parsed["node"], "v8": parsed["v8"],
        "committed_input_sha256": before, "source_identities": identities,
        "summary": {key: parsed[key] for key in ("controls", "cells", "precision_agreements", "precision_disagreements", "nonnumeric_boundaries", "export_contract_findings")},
        "files": {str(path.relative_to(output)).replace(os.sep, "/"): sha(path)
                  for path in sorted(output.rglob("*")) if path.is_file() and "profile" not in path.relative_to(output).parts},
    }
    dump(output / "manifest.json", manifest)
    print(json.dumps({"engine": engine["name"], "version": engine["version"], **manifest["summary"]}))
    # A valid evidence capture can contain export findings. It is never silently a parity pass.


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=("libreoffice", "excel"), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--node", default="node")
    parser.add_argument("--executable", default="libreoffice")
    parser.add_argument("--saved")
    parser.add_argument("--excel-version")
    options = parser.parse_args()
    if options.engine == "excel" and not options.saved:
        parser.error("--saved is required for Excel")
    capture(options)
