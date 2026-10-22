"""Reproduce four real no-issue/partial validation CLI cases at a frozen WIP.

Read-only research; no diagnostic allocation or conformance expectation update.
Run from any checkout containing CHECKPOINT: python -B <this-file>.
Only temporary files are created. Stdout is the reproducible JSON observation.
"""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

CHECKPOINT = "df7831e6d3675881d3f7714da42230c7163da256"
ROOT = Path(__file__).resolve().parents[2]


def main():
    archive = subprocess.run(["git", "archive", "--format=tar", CHECKPOINT,
        "implementations/python", "spec", "conformance/lease-up", "conformance/recoveries"],
        cwd=ROOT, check=True, capture_output=True).stdout
    with tempfile.TemporaryDirectory(prefix="uwmd-0096-payload-") as temporary:
        root = Path(temporary)
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            source.extractall(root, filter="data")
        module = root / "implementations/python"
        sys.path.insert(0, str(module))
        from test_validation import well_formed
        from test_validation_cli import property_source
        from test_validation_optional_shapes import cash, stack, waterfall
        cases = (
            ("LU unknown model_type", property_source()+well_formed("lease_up_schedule",
                model_type="unknown", period_granularity="monthly", schedule=[dict(period="2026-01")])),
            ("REC admin_fee_pct string", property_source()+well_formed("rent_roll",
                as_of_date="2026-03-01", tenants=[dict(recovery_terms=dict(method="net", admin_fee_pct="bad"))])),
            ("CS sizing wrong container", property_source()+well_formed("capital_stack", **stack("bad"))),
            ("WF stated_outcomes false", property_source()+cash()+well_formed("distribution_waterfall",
                **waterfall(stated_outcomes=False))),
        )
        observations = []
        for name, raw in cases:
            path = root / "input.uwx.md"
            path.write_bytes(raw)
            actual = subprocess.run([sys.executable, "-B", str(module/"uwmd.py"),
                "validate", str(path), "--json"], cwd=root, capture_output=True, encoding="utf8", timeout=30)
            response = json.loads(actual.stdout)
            partial = response["partial_validation_result"]
            assert actual.returncode == 1 and actual.stderr == ""
            assert "overall_status" not in response and partial["issues"] == []
            assert path.read_bytes() == raw
            observations.append(dict(case=name, source_sha256=hashlib.sha256(raw).hexdigest(),
                exit=actual.returncode, stderr=actual.stderr, partial=True,
                has_top_level_overall=False, issues=partial["issues"], source_unchanged=True))
        print(json.dumps(dict(checkpoint=CHECKPOINT, actual_cli=observations), indent=2))


if __name__ == "__main__":
    main()
