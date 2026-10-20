"""Ordinary SRC and ROLE current-view populations, distinct from all-physical META."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_source_metadata_optional import body
from test_source_validation import fence
from test_composition import external, part, index_parts
from uwmd_composition import resolve_composition
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation import _validate_source, validate_document


def value(section="property",bad=False,actor="author"):
    payload=body();payload["_meta"]["section"]=section
    payload["_meta"]["provenance"]["actor"]=actor
    if bad:
        payload["_meta"]["provenance"].update(source="not-an-actor",resolution="not-a-resolution")
        payload["_role"]="not-a-role"
        payload["_overrides"]=[dict(path="value",source="user_input",resolution="manual")]
    return payload


def ordinary(result):
    return [(i["code"],i["section"],i["field"],i["context"]["block_index"])
            for i in result["issues"] if i["code"].startswith(("SRC-","ROLE-"))]


class SourcePopulationTests(unittest.TestCase):
    def both(self,raw):
        document=parse(raw);before=copy.deepcopy(document)
        source=asyncio.run(_validate_source(raw));model=asyncio.run(validate_document(document))
        self.assertEqual(document,before);self.assertEqual(document.source.raw,raw)
        self.assertEqual(ordinary(source),ordinary(model))
        return source,model,document

    def test_overwritten_singleton_excludes_ordinary_findings_but_retains_actor(self):
        raw=HEADER+fence(value(bad=True,actor=""))+fence(value())
        source,model,document=self.both(raw)
        self.assertEqual(ordinary(source),[])
        for result in (source,model):
            self.assertEqual([(i["code"],i.get("field"),i["context"]["block_index"])
                              for i in result["issues"] if i["code"].startswith("META-")],
                             [("META-01","_meta.provenance.actor",0)])
        # The independently usable inventory deliberately retains broad evidence.
        self.assertEqual(len([i for i in inspect_source_roles(document)["issues"]
                              if i["code"].startswith(("SRC-","ROLE-"))]),5)

    def test_history_fence_and_canonical_flags_are_not_ordinary_current(self):
        for annotation in (False,True):
            historical=value(bad=True,actor="")
            if not annotation:historical["_meta"]["lifecycle"]["superseded"]=True
            raw=HEADER+fence(historical,superseded=annotation)+fence(value())
            source,_,_=self.both(raw)
            self.assertEqual(ordinary(source),[])
            self.assertEqual([i["field"] for i in source["errors"]],["_meta.provenance.actor"])

    def test_current_variant_peers_survive_while_same_identity_is_overwritten(self):
        section="operating_statement"
        first=value(section,bad=True);current=value(section);current["_meta"]["lifecycle"]["revision"]=2
        raw=HEADER+fence(first,section=section,variant="base")+fence(current,section=section,variant="base")
        raw+=fence(value(section,bad=True),section=section,variant="stress")
        source,_,_=self.both(raw)
        self.assertEqual([(i[0],i[3]) for i in ordinary(source)],
            [("ROLE-01",2),("SRC-01",2),("SRC-03",2),("SRC-02",2),("SRC-03",2)])

    def test_extensions_are_role_only_and_current_same_identity_and_history_apply(self):
        section="x_population"
        raw=HEADER+fence(value(section,bad=True),section=section)+fence(value(section),section=section)
        raw+=fence(value(section,bad=True),section=section,superseded=True)
        source,_,_=self.both(raw);self.assertEqual(ordinary(source),[])
        raw+=fence(value(section,bad=True),section=section)
        source,_,_=self.both(raw)
        self.assertEqual(ordinary(source),[("ROLE-01",section,"_role",3)])
        # Unknown non-x sections live in the ordinary sections view.
        section="future_population"
        source,_,_=self.both(HEADER+fence(value(section,bad=True),section=section))
        self.assertEqual([i[0] for i in ordinary(source)],
                         ["ROLE-01","SRC-01","SRC-03","SRC-02","SRC-03"])

    def test_all_active_append_entries_are_role_only_without_history_reclassification(self):
        raw=HEADER;expected=[];index=0
        for section in ("pipeline_log","custom_calculations","custom_scenarios"):
            for _ in range(2):
                raw+=fence(value(section,bad=True),section=section)
                expected.append(("ROLE-01",section,"_role",index));index+=1
            raw+=fence(value(section,bad=True),section=section,superseded=True);index+=1
        source,_,document=self.both(raw)
        self.assertEqual(ordinary(source),expected)
        broad=inspect_source_roles(document)
        self.assertEqual(len([i for i in broad["issues"] if i["code"].startswith("SRC-")]),24)

    def test_model_current_values_not_stale_raw_or_private_inventory_are_authority(self):
        raw=HEADER+fence(value(bad=True))+fence(value())
        _,_,document=self.both(raw)
        current=document.source.blocks[1].parsed.value
        current.update(_role="invalid")
        current["_meta"]["provenance"]["source"]="user_input"
        result=asyncio.run(validate_document(document))
        self.assertEqual(ordinary(result),[("ROLE-01","property","_role",1),
                                          ("SRC-02","property","_meta.provenance.source",1)])
        self.assertEqual(document.source.raw,raw)

    def test_meta01_through06_stay_all_physical_after_ordinary_population_filter(self):
        raw=HEADER
        payloads=[value(bad=True) for _ in range(6)]
        payloads[0]["_meta"]["provenance"]["actor"]=""
        payloads[1]["_meta"]["quality"]["human_review_required"]=None
        payloads[2]["_meta"]["lifecycle"]["superseded"]=None
        payloads[3]["_meta"]["quality"]["confidence"]="invalid"
        payloads[4]["_meta"]["quality"]["flags"]=[False]
        payloads[5]["_meta"]["provenance"]["market_data_ref"]={}
        for payload in payloads:raw+=fence(payload)
        raw+=fence(value())
        source,_,_=self.both(raw)
        self.assertEqual(ordinary(source),[])
        self.assertEqual([(i["code"],i["context"]["block_index"]) for i in source["issues"]
                          if i["code"].startswith("META-")],
                         [("META-01",0),("META-02",1),("META-03",2),("META-04",3),
                          ("META-05",4),("META-06",5),("META-06",5),("META-06",5)])

    def test_composition_original_only_refs_never_widen_ordinary_populations(self):
        root=external(["whole"],collection=False)
        root.source.blocks[0].parsed.value.update(_role="old-invalid")
        root.source.blocks[0].parsed.value["_meta"]["provenance"]["source"]="old-invalid-actor"
        current=part("whole",value("rent_roll",bad=True),collection=False)
        # Author the negative control into actual bytes for SOURCE as well as
        # the independently supplied MODEL; stale raw must not erase the test.
        raw=HEADER+b"```json uw:section=rent_roll external=true\n"
        raw+=json.dumps(root.source.blocks[0].parsed.value).encode()+b"\n```\n"
        raw+=fence(value("x_population",bad=True),section="x_population")
        raw+=fence(value("pipeline_log",bad=True),section="pipeline_log")
        root=parse(raw)
        model=resolve_composition(root,index_parts([current])).document
        source=asyncio.run(_validate_source(raw,parts=[current.source.raw]))
        result=asyncio.run(validate_document(model))
        for actual in (source,result):
            ordinary_rows=ordinary(actual)
            self.assertEqual([i[0] for i in ordinary_rows],
                ["ROLE-01","ROLE-01","ROLE-01","SRC-01","SRC-03","SRC-02","SRC-03"])
            self.assertEqual([i[1] for i in ordinary_rows],
                ["x_population","pipeline_log","rent_roll","rent_roll","rent_roll","rent_roll","rent_roll"])
            self.assertTrue(all(i[3] != 0 for i in ordinary_rows))

    def test_actual_source_cli_current_extension_append_controls_remain_read_only(self):
        raw=HEADER+fence(value(bad=True))+fence(value())
        raw+=fence(value("x_population",bad=True),section="x_population")
        raw+=fence(value("pipeline_log",bad=True),section="pipeline_log")
        with tempfile.TemporaryDirectory(prefix="uwmd-source-populations-") as directory:
            path=Path(directory)/"record.uwx.md";path.write_bytes(raw)
            process=subprocess.run([sys.executable,"-B",str(Path(__file__).with_name("uwmd.py")),"validate",str(path),"--json"],
                capture_output=True,encoding="utf8",timeout=20)
            result=json.loads(process.stdout);result=result.get("partial_validation_result",result)
            self.assertEqual(process.returncode,1);self.assertEqual(process.stderr,"")
            self.assertEqual(ordinary(result),[("ROLE-01","x_population","_role",2),("ROLE-01","pipeline_log","_role",3)])
            self.assertEqual(path.read_bytes(),raw)


if __name__=="__main__":
    unittest.main()
