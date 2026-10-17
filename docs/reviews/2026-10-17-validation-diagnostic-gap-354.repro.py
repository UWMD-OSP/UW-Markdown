"""Read-only RFC0091 evidence, not an activated validator or baseline updater.

Run after npm run build from the repository root. Writes only the supplied output
path. Python and Node separately assess the two proposed boolean predicates.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "implementations/python"))
from uwmd_reader import parse
from uwmd_source_validation import _metadata_routing
from uwmd_source_lifecycle import source_superseded

NINE = [
    "recoveries/reject-cap-without-accumulation/deal.uwx.md",
    "recoveries/reject-share-as-percent/deal.uwx.md",
    "recoveries/reject-member-without-method/deal.uwx.md",
    "documents/malformed/02-low-confidence-no-review.uwx.md",
    "documents/malformed/03-sources-uses-mismatch.uwx.md",
    "documents/malformed/10-property-section-missing.uwx.md",
    "documents/malformed/20-flat-meta.uwx.md",
    "documents/malformed/21-section-id-wrapper.uwx.md",
    "documents/malformed/29-actor-shape-precedence.uwx.md",
]
SCHEMAS = """debt-rate-hedge expense-targeted-capex lease-co-tenancy
lease-escalation-schedule lease-recovery-terms lease-recovery-true-up
lease-termination-option renovation-draw rent-roll-hospitality section-capital-stack
section-cash-flow-series section-components section-dc-capacity section-dc-power
section-dc-revenue section-distribution-waterfall section-gaps section-hotel-brand
section-hotel-food-beverage section-hotel-metrics section-lease-up-schedule
section-mhc-sites section-reserve-accounts sources-uses-escrow tax-abatement
tax-reassessment tax-terminal""".split()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def node(paths, script):
    result = subprocess.run(["node", "--input-type=module", "-e", script],
        cwd=ROOT, input=json.dumps(paths), capture_output=True, text=True,
        encoding="utf-8", check=True)
    return json.loads(result.stdout)


def capture():
    sources, admitted, refused, exposure = [], [], [], []
    for path in sorted((ROOT / "conformance").rglob("*.uwx.md")):
        name = path.relative_to(ROOT).as_posix()
        raw = path.read_bytes()
        sources.append(dict(path=name, sha256=sha(raw)))
        try:
            document = parse(raw, filename=path.name)
        except Exception as error:
            refused.append(dict(path=name, type=type(error).__name__,
                code=getattr(error, "code", None), message=str(error)))
            continue
        admitted.append(name)
        findings = []
        for ordinal, block in enumerate(document.source.blocks):
            body = block.parsed.value
            if "_meta" not in body or _metadata_routing(body):
                continue
            meta = body["_meta"]
            for parent, field, code in [("quality", "human_review_required", "META-02"),
                    ("lifecycle", "superseded", "META-03")]:
                owner = meta.get(parent)
                if isinstance(owner, dict) and not isinstance(owner.get(field), bool):
                    findings.append(dict(block_index=ordinal, section=block.section,
                        variant=dict(block.attributes).get("variant"),
                        field=f"_meta.{parent}.{field}", proposed_code=code,
                        state="absent" if field not in owner else "null" if owner[field] is None else "nonboolean",
                        history=source_superseded(block)))
        if findings:
            exposure.append(dict(path=name, findings=findings))
    js = r"""
import fs from 'node:fs';
import {parseUWFile} from './packages/uwmd-verify/dist/index.js';
import {parsedPhysicalBlocks} from './packages/uwmd-verify/dist/parser.js';
const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const out=[];
for(const path of JSON.parse(fs.readFileSync(0,'utf8'))){
 const findings=[];
 for(const [block_index,b] of parsedPhysicalBlocks(parseUWFile(fs.readFileSync(path,'utf8'))).entries()){
  const body=b.content,m=body._meta;
  if(Object.hasOwn(body,'section_id') || !object(m) || !object(m.provenance) || !object(m.lifecycle))continue;
  for(const [parent,key,proposed_code] of [['quality','human_review_required','META-02'],['lifecycle','superseded','META-03']]){
   const owner=m[parent];
   if(object(owner)&&typeof owner[key]!=='boolean')findings.push({block_index,field:`_meta.${parent}.${key}`,proposed_code,state:!Object.hasOwn(owner,key)?'absent':owner[key]===null?'null':'nonboolean'});
  }
 }
 if(findings.length)out.push({path,findings});
}
console.log(JSON.stringify(out));
"""
    independent = node(admitted, js)
    comparison = [dict(path=r["path"], findings=[{k:f[k] for k in
        ("block_index", "field", "proposed_code", "state")} for f in r["findings"]]) for r in exposure]
    assert independent == comparison, "Independent Node/Python predicate inventories disagree"
    reference = node(["conformance/" + name for name in NINE], r"""
import fs from 'node:fs';
import {parseUWFile,validateUWFile} from './packages/uwmd-verify/dist/index.js';
console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(path=>({path,result:validateUWFile(parseUWFile(fs.readFileSync(path,'utf8')))}))));
""")
    affected = {row["path"]:row for row in exposure}
    portable = []
    for path in sorted((ROOT / "conformance/runner/cases").glob("*.case.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        if case.get("command") != "validate":
            continue
        source = (Path(case["fixture_dir"]) / case["args"][0]).as_posix()
        if source in affected:
            portable.append(dict(id=case["id"], source=source,
                original_exit=case["expect"]["exit_code"],
                expected_new_codes=sorted({f["proposed_code"] for f in affected[source]["findings"]})))
    # No new validator, result or fixture is generated. These are predicate
    # exposures; owning operations must be measured before governed activation.
    return dict(scope="Draft-only two-boolean sensitivity and nine-case reference reproduction",
        authority_main="001cc001d36d8b4a219bb6516f40db69d1a8dc34",
        sources=sources, parse_refusals=refused,
        schema_hashes=[dict(path=f"spec/schemas/{s}.schema.json",
            sha256=sha((ROOT / f"spec/schemas/{s}.schema.json").read_bytes())) for s in SCHEMAS],
        nine_reference=reference, two_boolean_exposure=exposure,
        portable_validate_exposure=portable,
        summary=dict(sources=len(sources), parsed=len(admitted), refused=len(refused),
            exposed_sources=len(exposure), predicates=sum(len(r["findings"]) for r in exposure),
            historical_predicates=sum(f["history"] for r in exposure for f in r["findings"]),
            portable_validate_exposed=len(portable),
            portable_exit_zero_exposed=sum(r["original_exit"] == 0 for r in portable)),
        independent_node_python_inventory_equal=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    output = capture()
    args.out.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output["summary"], sort_keys=True))
