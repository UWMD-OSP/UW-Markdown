#!/usr/bin/env python3
"""Language-agnostic UW Markdown conformance driver (RFC 0004).

Case ids name content: owner__suite__scenario__operation. The target field
controls ownership; no directory name or id is a tier alias.

Runs the corpus against ANY implementation that exposes the CLI protocol in
protocol §II.6a, by shelling out to it. Nothing here knows about TypeScript,
`@uwmd/core`, or Node — the reference implementation is tested exactly the way
a Python, Go, or Rust one would be.

    python conformance/runner/runner.py --impl "node packages/uwmd-cli/bin/uwmd.mjs"

Python 3.10+, standard library only. That constraint is the point: a driver
that needs a package index is a driver an air-gapped implementer cannot run.

Output is TAP version 14 on stdout, plus a JSON manifest (--manifest-out) that
carries the structured verdict and the identity of the implementation under
test. TAP has no standard way to attach that metadata, and without it two
implementations' results cannot be aggregated.

The portable cases cover CLI-shaped checks; the reference runner also checks
multi-step and cross-fixture contracts. Each case has one Reader, Verifier,
optional-profile, or starter-product owner. Reports keep product checks apart
from standard claims. Directory names do not determine ownership.
"""

from __future__ import annotations

import argparse
import json
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CASES_DIR = Path(__file__).resolve().parent / "cases"


VOCABULARY = json.loads((Path(__file__).parent / "vocabulary.json").read_text(encoding="utf-8"))


def read_tier(value: str) -> str:
    """A conformance tier: ``reader`` or ``verifier`` (the closed vocabulary.json list).

    Any other value is refused; no alias or retired tier name is read.
    """
    if value not in VOCABULARY["tiers"]:
        raise ValueError(f"unknown tier: {value}")
    return value


def case_target(case: dict) -> str:
    target = case.get("target")
    if target not in VOCABULARY["targets"]:
        raise ValueError(f"unknown case target: {target}")
    return target


FORMAT_VERSION = re.compile(r"^[0-9]+[.][0-9]+$")


def case_format_version(case: dict) -> str:
    """The Format version a case was written for: the rule set it exercises.

    RFC 0111 D6 (Protocol XII.5). Every case names one; a case without one, or
    with a malformed one, is refused rather than assumed to be any version.
    """
    version = case.get("format_version")
    if not isinstance(version, str) or not FORMAT_VERSION.match(version):
        raise ValueError(f"case {case.get('id')} names no Format version: {version!r}")
    return version


def select_cases(cases: list[dict], tiers: str = "", profiles: str = "", starter: bool = False,
                 format_versions: str = "") -> list[dict]:
    """Cases owned by the selected targets, and written for the selected rule sets.

    `format_versions` is a comma-separated list of Format versions (RFC 0111):
    a Verifier claiming a release runs the cases of every rule set it keeps.
    Empty means every rule set in the corpus.
    """
    versions: set[str] = set()
    for version in filter(None, (s.strip() for s in format_versions.split(","))):
        if not FORMAT_VERSION.match(version):
            raise ValueError(f"unknown format version: {version}")
        versions.add(version)
    wanted: set[str] = set()
    for tier in filter(None, (s.strip() for s in tiers.split(","))):
        current = read_tier(tier)
        wanted.add(current)
        if current == "verifier":
            wanted.add("reader")
    for profile in filter(None, (s.strip() for s in profiles.split(","))):
        if profile not in VOCABULARY["profiles"]:
            raise ValueError(f"unknown profile: {profile}")
        wanted.add(profile)
    if starter:
        wanted.add("starter-products")
    seen: set[str] = set()
    selected = []
    for case in cases:
        if case["id"] in seen:
            raise ValueError(f"duplicate case: {case['id']}")
        seen.add(case["id"])
        target = case_target(case)
        case["target"] = target
        version = case_format_version(case)
        if (not wanted or target in wanted) and (not versions or version in versions):
            selected.append(case)
    return selected


def result_owner(case: dict) -> dict:
    target = case["target"]
    version = {"format_version": case["format_version"]}
    if target in ("reader", "verifier"):
        return {"target": target, "tier": target, **version}
    if target == "starter-products":
        return {"target": target, "starter_product": True, **version}
    return {"target": target, "profile": target, **version}


# ── Comparison ───────────────────────────────────────────────────────────────


def canonical(value):
    """RFC 8785-ish ordering for comparison only: sort keys, recurse.

    Full JCS serialization is not needed — nothing is hashed here — and
    requiring it of the driver would push a serialization contract onto
    implementations that only ever have to emit *some* valid JSON.
    """
    if isinstance(value, dict):
        return {k: canonical(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def json_subset(expected, actual, path=""):
    """Every key in `expected` must be present and equal in `actual`.

    Subset rather than equality because the expected files are frozen
    *projections*: `expected-result.json` for a calc names four fields, while a
    conforming implementation may also report `round_to` and `display`. Demanding
    exact equality would fail implementations for being more informative.

    Lists are compared element-wise and length-sensitively — an omitted issue is
    a real difference, not extra information.
    """
    problems = []
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{path or '<root>'}: expected an object"]
        for key, want in expected.items():
            where = f"{path}.{key}" if path else key
            if key not in actual:
                problems.append(f"{where}: missing")
            else:
                problems.extend(json_subset(want, actual[key], where))
        return problems
    if isinstance(expected, list):
        if not isinstance(actual, list):
            return [f"{path or '<root>'}: expected an array"]
        if len(expected) != len(actual):
            return [f"{path or '<root>'}: {len(expected)} items expected, {len(actual)} present"]
        for index, (want, got) in enumerate(zip(expected, actual)):
            problems.extend(json_subset(want, got, f"{path}[{index}]"))
        return problems
    if canonical(expected) != canonical(actual):
        problems.append(f"{path or '<root>'}: {expected!r} != {actual!r}")
    return problems


# Values that legitimately differ between two correct runs. Masking them is not
# a weakening of the comparison: an edit stamps `last_modified` with the moment
# it ran, and a baseline that pinned one would be asserting the clock.
#
# `parent_hash` is deliberately NOT masked — it is stamped from the prior head's
# content_hash, which the fixture fixes, so it is stable and worth checking.
VOLATILE = [
    (re.compile(r'last_modified:\s*"[^"]*"'), 'last_modified: "<volatile>"'),
    (re.compile(r'"timestamp":\s*"[^"]*"'), '"timestamp": "<volatile>"'),
    (re.compile(r"ts=\S+"), "ts=<volatile>"),
    (re.compile(r'"content_hash":\s*"[0-9a-f]{64}"'), '"content_hash": "<volatile>"'),
]


def normalize_text(text: str) -> str:
    """Newline-normalized, volatile-masked text for comparison.

    A CRLF checkout must not fail a conformance suite, and neither must a final
    newline an implementation does or does not emit.
    """
    out = text.replace("\r\n", "\n").rstrip("\n")
    for pattern, replacement in VOLATILE:
        out = pattern.sub(replacement, out)
    return out


# ── Projections ──────────────────────────────────────────────────────────────
#
# Some baselines are deliberately *projections* of a response rather than the
# response: `01-minimal-screening.validation.json` records the deduplicated,
# sorted set of (code, severity) pairs, because pinning the full issue list
# would make every message-wording change a corpus edit.
#
# So the driver needs to project too — and the projection has to be named in
# the case file rather than inferred, or the driver starts guessing at baseline
# shapes. The vocabulary is deliberately tiny and closed; a new one is a
# considered addition to the case format, not a per-fixture escape hatch.


def project(actual, name: str | None):
    if not name:
        return actual
    if name == "issue-code-severity-set":
        if not isinstance(actual, dict):
            return actual
        seen = {}
        for issue in actual.get("issues", []):
            seen.setdefault(
                (issue.get("code"), issue.get("severity")),
                {"code": issue.get("code"), "severity": issue.get("severity")},
            )
        # RFC 0109: Format 5.2 findings are deal flags, projected apart from
        # issues as (code, band) pairs; an expectation omitting them still holds.
        flags = {}
        for flag in actual.get("deal_flags", []):
            flags.setdefault(
                (flag.get("code"), flag.get("band")),
                {"code": flag.get("code"), "band": flag.get("band")},
            )
        return {
            "overall_status": actual.get("overall_status"),
            "stage_readiness": actual.get("stage_readiness"),
            "issues": sorted(seen.values(), key=lambda i: (i["code"] or "", i["severity"] or "")),
            "deal_flags": sorted(flags.values(), key=lambda f: (f["code"] or "", f["band"] or "")),
        }
    if name == "replacement-funding":
        verification = actual.get("replacement_funding_verification", {})
        result = {"state": verification.get("state")}
        if "reason" in verification:
            result["reason"] = verification["reason"]
        result["codes"] = [i.get("code") for i in verification.get("issues", [])]
        return {"codes": sorted(i["code"] for i in actual.get("issues", [])
                                 if i["code"].startswith(("HDG-", "ESC-"))),
                "verification": result,
                "structural_codes": sorted(i["code"] for i in verification.get("structural_issues", []))}
    if name == "section-verification":
        # RFC 0115: a section report reduced to its verdict and the set of
        # verifier issue codes. A not_applicable report has no verification.
        if not isinstance(actual, dict):
            return actual
        verification = actual.get("verification") or {}
        return {"verdict": verification.get("verdict", actual.get("status")),
                "codes": sorted({i.get("code") for i in verification.get("issues", [])})}
    if name == "receipt-verification":
        # RFC 0115 D4: a receipt verdict and its issue codes, or the typed
        # refusal of a receipt the verifier cannot read.
        if not isinstance(actual, dict):
            return actual
        if isinstance(actual.get("error"), dict):
            return {"refused_code": actual["error"].get("code")}
        return {"verdict": actual.get("verdict"),
                "codes": sorted({i.get("code") for i in actual.get("issues", [])}),
                "recomputed_ids": sorted(r["calc_id"] for r in actual.get("recomputed", []))}
    if name == "property-cash-flow-assembly":
        # RFC 0115: a PropertyCashFlowAssembly, or its CALC-CF-ASSEMBLY refusal,
        # reduced to the fields the assembly baselines name.
        if not isinstance(actual, dict):
            return actual
        error = actual.get("error")
        if isinstance(error, dict):
            result = {"error_code": error.get("code"), "reason": error.get("reason"), "pointer": error.get("pointer")}
            lease_up = ((error.get("evidence") or {}).get("lease_up") or {})
            verdict = ((lease_up.get("evidence") or {}).get("verification") or {}).get("verdict")
            if verdict is not None:
                result["lease_up_verdict"] = verdict
            return result
        rows = (actual.get("series") or {}).get("series", [])
        cells = actual.get("cells", [])
        slots = list(dict.fromkeys(c.get("slot") for c in cells))
        periods = slots[1:-1] if slots[:1] == ["acquisition"] and slots[-1:] == ["disposition"] else slots
        return {
            "amounts": [r.get("amount") for r in rows],
            "dates": [r.get("date") for r in rows],
            "cell_count": len(cells),
            "source_periods": periods,
            "source_paths": [b.get("source_path") for b in actual.get("bindings", [])],
            "sale_deductions": actual.get("sale_deductions"),
            "net_sale_proceeds": actual.get("net_sale_proceeds"),
        }
    raise Failure(f"unknown projection '{name}'")


# ── RFC 0115 comparators ─────────────────────────────────────────────────────
#
# The verifier fixtures pin a verdict and require named codes to appear; they
# do not list every issue. These comparators restate those reference checks
# exactly. The case names the baseline fields read, from a closed set, because
# a document fixture's `expected_codes` are validator codes, not verifier codes.

VERDICT_FIELDS = ("verdict", "expected_code", "expected_codes", "refused_code", "recomputed_ids")


def verdict_codes(expected: dict, actual, fields: list[str]) -> list[str]:
    if not isinstance(actual, dict):
        return ["<root>: expected an object"]
    problems = []
    codes = set(actual.get("codes", []))
    for field in fields:
        if field not in VERDICT_FIELDS:
            raise Failure(f"unknown verdict-codes field '{field}'")
        if field not in expected:
            continue
        want = expected[field]
        if field == "recomputed_ids":
            problems.extend(json_subset(want, actual.get(field), field))
        elif field in ("verdict", "refused_code"):
            if actual.get(field) != want:
                problems.append(f"{field}: {want!r} != {actual.get(field)!r}")
        else:
            for code in [want] if field == "expected_code" else want:
                if code not in codes:
                    problems.append(f"{field}: {code} not reported (saw {sorted(codes)})")
    return problems


def statement_states(expected: dict, actual) -> list[str]:
    """RFC 0099 statement homes against a StatedMetricsReport."""
    if not isinstance(actual, dict):
        return ["<root>: expected an object"]
    evidence = actual.get("evidence", [])
    problems = []
    for item in expected.get("expect", []):
        found = [e for e in evidence if e.get("path") == item["path"]]
        if len(found) != 1:
            problems.append(f"{item['path']}: stated {len(found)} times, expected once")
        elif found[0].get("state") != item["state"]:
            problems.append(f"{item['path']}: {item['state']!r} != {found[0].get('state')!r}")
    for path in expected.get("absent", []):
        if any(e.get("path") == path for e in evidence):
            problems.append(f"{path}: is not a statement, but was reported")
    if "failed" in expected and (actual.get("counts") or {}).get("failed") != expected["failed"]:
        problems.append(f"counts.failed: {expected['failed']!r} != {(actual.get('counts') or {}).get('failed')!r}")
    return problems


def json_pointer(document, pointer: str):
    """RFC 6901, for `expect.baseline_pointer` into a shared baseline file."""
    if pointer == "":
        return document
    for token in pointer.lstrip("/").split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        document = document[int(token)] if isinstance(document, list) else document[token]
    return document


# ── Execution ────────────────────────────────────────────────────────────────


class Failure(Exception):
    pass


def run_case(impl: list[str], case: dict, timeout: float) -> tuple[float, list[str]]:
    """Run one case. Returns (elapsed_seconds, problems)."""
    fixture = REPO_ROOT / case["fixture_dir"] if case.get("fixture_dir") else REPO_ROOT
    args = [
        str((fixture / a).resolve()) if case.get("path_args", True) and (fixture / a).is_file() else a
        for a in case.get("args", [])
    ]
    command = [*impl, case["command"], *args]

    started = time.monotonic()
    try:
        proc = subprocess.run(
            command,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            # Explicit UTF-8, not the platform default. Windows decodes with the
            # ANSI codepage otherwise, which turns every em dash in a rendered
            # fixture into a replacement character and fails 14 cases for a
            # reason that has nothing to do with the implementation.
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return time.monotonic() - started, [f"timed out after {timeout}s"]
    except FileNotFoundError as exc:
        raise Failure(f"implementation not runnable: {exc}") from exc
    elapsed = time.monotonic() - started

    expect = case["expect"]
    expected_exit = expect.get("exit_code", 0)
    if proc.returncode != expected_exit:
        # Exit code 2 is "unrecoverable internal error" in the protocol; stdout
        # is not required to be parseable, so say so rather than showing a diff.
        detail = proc.stderr.strip().splitlines()[-1:] or ["(no stderr)"]
        return elapsed, [f"exit {proc.returncode}, expected {expected_exit}: {detail[0]}"]

    kind = expect["kind"]
    if kind == "exit-only":
        return elapsed, []

    baseline_path = REPO_ROOT / expect["file"] if "/" in expect.get("file", "") else fixture / expect["file"]
    if not baseline_path.is_file():
        return elapsed, [f"baseline not found: {expect['file']}"]

    if kind == "text":
        want = _baseline_text(baseline_path, expect)
        got = normalize_text(proc.stdout)
        return elapsed, [] if want == got else [_text_diff(want, got)]

    try:
        actual = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        # The protocol's one hard requirement on stdout. Reported as its own
        # failure because "the implementation printed a log line" and "the
        # implementation computed the wrong number" are unrelated bugs.
        return elapsed, [f"stdout is not one JSON document: {exc}"]

    if kind == "json-field-text":
        field = expect["field"]
        if field not in actual:
            return elapsed, [f"response has no '{field}' field"]
        want = _baseline_text(baseline_path, expect)
        got = normalize_text(str(actual[field]))
        return elapsed, [] if want == got else [_text_diff(want, got)]

    expected = json.loads(baseline_path.read_text(encoding="utf-8"))
    if "baseline_pointer" in expect:
        expected = json_pointer(expected, expect["baseline_pointer"])
    if expect.get("ignore"):
        # Baseline members a reference-runner check owns (e.g. a validator
        # code list beside an assembly result), named in the case, never guessed.
        expected = {k: v for k, v in expected.items() if k not in expect["ignore"]}
    actual = project(actual, expect.get("project"))
    if kind == "verdict-codes":
        return elapsed, verdict_codes(expected, actual, expect.get("fields", []))
    if kind == "statement-states":
        return elapsed, statement_states(expected, actual)
    if kind == "json-exact":
        return elapsed, [] if canonical(expected) == canonical(actual) else json_subset(expected, actual) or [
            "canonical forms differ"
        ]
    if kind == "json-subset":
        return elapsed, json_subset(expected, actual)
    raise Failure(f"unknown expect.kind '{kind}' in case {case['id']}")


def _baseline_text(path: Path, expect: dict) -> str:
    """The baseline's text, optionally pulled out of a JSON field.

    Some render baselines are stored as the full `RenderResult` envelope
    (`{format, content}`) even though the file is named `.txt`. Naming the field
    in the case beats teaching the driver to sniff, and beats re-baselining
    every rendered fixture to make the extension honest.
    """
    raw = path.read_text(encoding="utf-8")
    field = expect.get("baseline_field")
    if field:
        return normalize_text(str(json.loads(raw)[field]))
    return normalize_text(raw)


def _text_diff(want: str, got: str) -> str:
    want_lines, got_lines = want.split("\n"), got.split("\n")
    for index in range(max(len(want_lines), len(got_lines))):
        a = want_lines[index] if index < len(want_lines) else "<end of output>"
        b = got_lines[index] if index < len(got_lines) else "<end of output>"
        if a != b:
            return f"line {index + 1}: expected {a!r}, got {b!r}"
    return "outputs differ"


def read_manifest(impl: list[str], timeout: float) -> dict | None:
    """Ask the implementation who it is. Absence is reported, never guessed."""
    try:
        proc = subprocess.run(
            [*impl, "manifest"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
        return json.loads(proc.stdout) if proc.returncode == 0 else None
    except (subprocess.SubprocessError, json.JSONDecodeError, FileNotFoundError):
        return None


# ── Main ─────────────────────────────────────────────────────────────────────


def claimed_capabilities(manifest: dict | None) -> set[str] | None:
    """Capabilities the implementation claims, or None meaning "claims everything".

    An absent or empty list is deliberately NOT read as "claims nothing" — that
    would let an implementation skip the entire corpus by omitting a field.
    Forgetting to declare fails closed against the claimant (§II.6a, RFC 0030).
    """
    if not manifest:
        return None
    declared = manifest.get("capabilities")
    if not isinstance(declared, list) or not declared:
        return None
    return {str(c) for c in declared}


def missing_capabilities(case: dict, claimed: set[str] | None) -> list[str]:
    """Which of a case's required capabilities the implementation does not claim."""
    if claimed is None:
        return []
    required = case.get("requires_capabilities") or []
    return sorted(c for c in required if c not in claimed)


def missing_profiles(case: dict, manifest: dict | None) -> list[str]:
    target = case["target"]
    if target not in VOCABULARY["profiles"]:
        return []
    # Profiles require an explicit claim; neither capabilities nor a tier
    # implies one (Protocol §II.3 and §II.5).
    claimed = manifest.get("profiles", []) if manifest else []
    return [] if isinstance(claimed, list) and target in claimed else [target]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--impl",
        default="node packages/uwmd-cli/bin/uwmd.mjs",
        help="Command that speaks the CLI protocol (default: the reference implementation).",
    )
    parser.add_argument("--cases", default=str(CASES_DIR), help="Directory of *.case.json files.")
    parser.add_argument("--tier", default="", help="reader, or verifier (includes Reader).")
    parser.add_argument("--profile", default="", help="Comma-separated optional verification profiles.")
    parser.add_argument("--starter-products", action="store_true", help="Select non-normative product checks.")
    parser.add_argument(
        "--format-version",
        default="",
        help="Comma-separated Format versions (rule sets, RFC 0111) whose cases to run; default all.",
    )
    parser.add_argument("--manifest-out", default="", help="Write the JSON manifest here.")
    parser.add_argument("--timeout", type=float, default=60.0, help="Per-case timeout in seconds.")
    parser.add_argument(
        "--no-skip",
        action="store_true",
        help="Treat a capability skip as a failure. CI runs the reference implementation "
        "this way so the skip mechanism cannot quietly erode its own coverage.",
    )
    args = parser.parse_args()

    impl = shlex.split(args.impl)

    case_files = sorted(Path(args.cases).glob("*.case.json"))
    cases = [json.loads(p.read_text(encoding="utf-8")) for p in case_files]
    try:
        cases = select_cases(cases, args.tier, args.profile, args.starter_products, args.format_version)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if not cases:
        print("no cases matched", file=sys.stderr)
        return 2

    manifest = read_manifest(impl, args.timeout)
    manifest_tier = None
    if manifest and "tier" in manifest:
        try:
            manifest_tier = read_tier(str(manifest["tier"]))
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2

    print("TAP version 14")
    print(f"1..{len(cases)}")
    if manifest:
        print(f"# implementation: {manifest.get('id')}@{manifest.get('version')}")
    else:
        # Not fatal: the manifest subcommand is how an implementation identifies
        # itself for aggregation, not a prerequisite for running the corpus.
        print("# implementation: unidentified (no `manifest` subcommand)")

    claimed = claimed_capabilities(manifest)

    results = []
    failed = 0
    skipped = 0
    unverifiable = 0
    skipped_by_capability: dict[str, int] = {}
    for number, case in enumerate(cases, start=1):
        unclaimed_profiles = missing_profiles(case, manifest)
        if unclaimed_profiles:
            unverifiable += 1
            print(f"ok {number} - {case['id']} # SKIP unverifiable: profile not claimed: {', '.join(unclaimed_profiles)}")
            results.append({"id": case["id"], **result_owner(case), "ok": None,
                            "skipped": False, "unverifiable": True,
                            "missing_profiles": unclaimed_profiles, "problems": []})
            continue
        absent = missing_capabilities(case, claimed)
        if absent and not args.no_skip:
            # A skip is a reported outcome, never a pass. "Passes the corpus"
            # has to be said with the skip count attached or it means nothing.
            skipped += 1
            for capability in absent:
                skipped_by_capability[capability] = skipped_by_capability.get(capability, 0) + 1
            print(f"ok {number} - {case['id']} # SKIP capability not claimed: {', '.join(absent)}")
            results.append(
                {
                    "id": case["id"],
                    **result_owner(case),
                    "ok": True,
                    "skipped": True,
                    "missing_capabilities": absent,
                    "problems": [],
                }
            )
            continue
        try:
            elapsed, problems = run_case(impl, case, args.timeout)
        except Failure as exc:
            print(f"Bail out! {exc}")
            return 2
        if absent:
            # --no-skip: the case ran anyway, and not claiming it is the failure.
            problems = [
                f"capability not claimed: {', '.join(absent)} (--no-skip)",
                *problems,
            ]
        ok = not problems
        if not ok:
            failed += 1
        print(f"{'ok' if ok else 'not ok'} {number} - {case['id']} # {elapsed * 1000:.0f}ms")
        if not ok:
            print("  ---")
            for problem in problems[:10]:
                print(f"  - {problem}")
            if len(problems) > 10:
                print(f"  - ... and {len(problems) - 10} more")
            print("  ...")
        results.append(
            {
                "id": case["id"],
                **result_owner(case),
                "ok": ok,
                "skipped": False,
                "problems": problems,
            }
        )

    report = {
        "implementation": (
            f"{manifest.get('id')}@{manifest.get('version')}" if manifest else "unidentified"
        ),
        "manifest": manifest,
        "manifest_tier": manifest_tier,
        "tiers": sorted({c["target"] for c in cases if c["target"] in ("reader", "verifier")}),
        "profiles": sorted({c["target"] for c in cases if c["target"] in VOCABULARY["profiles"]}),
        "format_versions": sorted({c["format_version"] for c in cases}),
        "by_target": {target: {
            "passed": sum(r["target"] == target and r["ok"] is True and not r["skipped"] for r in results),
            "failed": sum(r["target"] == target and r["ok"] is False for r in results),
            "skipped": sum(r["target"] == target and r["skipped"] for r in results),
            "unverifiable": sum(r["target"] == target and r.get("unverifiable", False) for r in results),
        } for target in sorted({c["target"] for c in cases})},
        "summary": {
            "total": len(cases),
            "passed": len(cases) - failed - skipped - unverifiable,
            "unverifiable": unverifiable,
            "failed": failed,
            "skipped": skipped,
            "skipped_by_capability": skipped_by_capability,
        },
        "results": results,
    }
    if args.manifest_out:
        Path(args.manifest_out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for target, counts in report["by_target"].items():
        print(f"# {target}: {counts['passed']} passed, {counts['failed']} failed, {counts['skipped']} skipped, {counts['unverifiable']} unverifiable")
    print(f"# {report['summary']['passed']}/{report['summary']['total']} passed")
    if skipped:
        detail = ", ".join(f"{cap} x{n}" for cap, n in sorted(skipped_by_capability.items()))
        print(f"# {skipped} skipped for capabilities not claimed: {detail}")

    if unverifiable:
        print(f"# {unverifiable} unverifiable: verification profile not claimed")
    return 1 if failed or (args.no_skip and unverifiable) else 0


if __name__ == "__main__":
    sys.exit(main())
