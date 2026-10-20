"""Execute unchanged portable validate cases against the real Python command.

This development evidence intentionally does not claim the advertised capability:
manifest remains parse-only. The shared run_case performs every subprocess and
comparison unchanged; an observer retains the runner's decoded process evidence.
Captured stream hashes include text-mode newline normalization, not raw bytes.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path,value):
    path.write_text(json.dumps(value,ensure_ascii=True,allow_nan=False,indent=2)+"\n",
                    encoding="utf8",newline="\n")


def run(output):
    output=Path(output)
    if output.exists():
        if any(output.iterdir()):
            raise ValueError("Evidence directory must be empty")
    else:
        output.mkdir(parents=True)
    spec=importlib.util.spec_from_file_location("shared_validate_case_driver",
        ROOT/"conformance/runner/runner.py")
    driver=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(driver)
    implementation=[sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py")]
    original_run=subprocess.run
    manifest_process=original_run([*implementation,"manifest"],cwd=ROOT,capture_output=True,
                                encoding="utf8",timeout=60)
    manifest=json.loads(manifest_process.stdout)
    head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    tree=subprocess.check_output(["git","rev-parse","HEAD^{tree}"],cwd=ROOT,text=True).strip()
    paths=[]
    for path in sorted((ROOT/"conformance/runner/cases").glob("*.case.json")):
        case=json.loads(path.read_text(encoding="utf8"))
        if case["command"]=="validate":
            paths.append((path,case))
    print("TAP version 14",flush=True)
    print("1.."+str(len(paths)),flush=True)
    print("# actual portable validate-case execution; parse-only discovery; not a capability gate",flush=True)
    results=[]
    for ordinal,(path,case) in enumerate(paths,1):
        fixture=ROOT/case["fixture_dir"]
        baseline=ROOT/case["expect"]["file"] if "/" in case["expect"]["file"] else fixture/case["expect"]["file"]
        sources=[fixture/arg for arg in case.get("args",()) if (fixture/arg).is_file()]
        retained={str(p):digest(p) for p in (path,baseline,*sources)}
        captured=[]
        def observe(*args,**kwargs):
            completed=original_run(*args,**kwargs)
            captured.append((args,kwargs,completed))
            return completed
        # Only observe the subprocess; return the exact CompletedProcess without
        # modifying argv, streams, exit, case, capability or comparison.
        with patch.object(driver.subprocess,"run",side_effect=observe):
            elapsed,problems=driver.run_case(implementation,case,60)
        if retained!={str(p):digest(p) for p in (path,baseline,*sources)}:
            problems=[*problems,"Source, case or expected bytes changed"]
        process=None
        if len(captured)==1:
            args,kwargs,completed=captured[0]
            stdout=output/(case["id"]+".stdout.json")
            stderr=output/(case["id"]+".stderr.txt")
            stdout.write_text(completed.stdout,encoding="utf8",newline="")
            stderr.write_text(completed.stderr,encoding="utf8",newline="")
            process=dict(command=args[0],cwd=str(kwargs["cwd"]),exit_code=completed.returncode,
                         stdout=str(stdout),stdout_sha256=digest(stdout),
                         stderr=str(stderr),stderr_sha256=digest(stderr))
        else:
            problems=[*problems,"Expected exactly one observed actual subprocess"]
        item=dict(id=case["id"],target=case["target"],requires_capabilities=case.get("requires_capabilities"),
                  input_sha256=retained,expect=case["expect"],process=process,
                  elapsed_seconds=elapsed,problems=problems,passed=not problems)
        results.append(item)
        print(("ok " if not problems else "not ok ")+str(ordinal)+" - "+case["id"]+
              " # "+str(round(elapsed*1000))+"ms",flush=True)
        for problem in problems:
            print("# "+str(problem),flush=True)
    report=dict(label="Actual unchanged portable validate cases; no advertised validate capability",
        head=head,tree=tree,implementation=implementation,discovery=manifest,
        discovery_exit_code=manifest_process.returncode,shared_driver_sha256=digest(ROOT/"conformance/runner/runner.py"),
        advertised_capability_gate_run=False,
        summary=dict(total=len(results),passed=sum(r["passed"] for r in results),
                     failed=sum(not r["passed"] for r in results),skipped=0),
        results=results)
    report_path=output/"report.json"
    write_json(report_path,report)
    print("# "+json.dumps(dict(report=str(report_path),sha256=digest(report_path),
                               summary=report["summary"]),sort_keys=True),flush=True)
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",default=None)
    args=parser.parse_args()
    output=Path(args.output_dir) if args.output_dir else Path(tempfile.mkdtemp(prefix="uwmd-python-real-validate-"))
    report=run(output)
    return 1 if report["summary"]["failed"] else 0


if __name__=="__main__":
    sys.exit(main())
