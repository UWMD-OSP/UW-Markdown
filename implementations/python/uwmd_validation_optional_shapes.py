"""Local admission for authored REC/CS/WF fields not allocated validator codes.

Only the named normative schema fragments are inspected. This is not a general
JSON Schema library, financial verifier or new registered diagnostic family.
"""
import json
from pathlib import Path
import re

from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date
from uwmd_validation_selection import current_blocks
from uwmd_validation_core import BUILTINS

_SCHEMAS=Path(__file__).resolve().parents[2]/"spec/schemas"


_KEYWORDS=frozenset(("$schema","$id","$comment","title","description","examples","default","$defs",
    "$ref","type","enum","const","required","properties","additionalProperties","dependentSchemas",
    "items","minItems","minLength","pattern","format","minimum","maximum","exclusiveMinimum",
    "exclusiveMaximum","allOf","oneOf","not","if","then","else"))
_PATTERNS=frozenset((r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$",r"^\d{4}-\d{2}-\d{2}$"))


def _reference(schema,root):
    reference=schema["$ref"]
    if not reference.startswith("#/"):
        raise ValueError("External references are outside the reviewed fragments")
    target=root
    for key in reference[2:].split("/"):
        target=target[key.replace("~1","/").replace("~0","~")]
    return target


def _unsupported(schema,root,parents=()):
    """Reject unsupported validation keywords before evaluating any branch."""
    if not isinstance(schema,dict):
        return ["Boolean/nonobject schema is outside the reviewed fragments"]
    if id(schema) in parents:
        return ["Recursive schema references are outside the reviewed fragments"]
    parents=(*parents,id(schema))
    out=["Unsupported fixed-schema keyword: "+key for key in schema if key not in _KEYWORDS]
    if "pattern" in schema and schema["pattern"] not in _PATTERNS:
        out.append("Pattern is outside the reviewed ASCII date patterns")
    if "format" in schema and schema["format"]!="date":
        out.append("Format is outside the reviewed calendar-date contract")
    if "additionalProperties" in schema and not isinstance(schema["additionalProperties"],bool):
        out.append("Additional-property schemas are outside the reviewed fragments")
    if "$ref" in schema:
        try:out.extend(_unsupported(_reference(schema,root),root,parents))
        except (KeyError,TypeError,ValueError) as error:out.append(str(error))
    for key in ("properties","dependentSchemas"):
        for child in schema.get(key,{}).values():out.extend(_unsupported(child,root,parents))
    for key in ("items","not","if","then","else"):
        if key in schema:out.extend(_unsupported(schema[key],root,parents))
    for key in ("allOf","oneOf"):
        for child in schema.get(key,()):out.extend(_unsupported(child,root,parents))
    return out


def _same(left,right):
    if isinstance(left,bool) or isinstance(right,bool):
        return type(left) is type(right) and left==right
    return left==right


def _violations(value,schema,root,path=""):
    """Evaluate the keywords used by these fixed schema fragments only."""
    if "$ref" in schema:
        target=_reference(schema,root)
        siblings={key:item for key,item in schema.items() if key!="$ref"}
        return _violations(value,target,root,path)+_violations(value,siblings,root,path)
    out=[]
    def problem(message, constraint=None):
        out.append(dict(field=path,message=message,_constraint=constraint))
    kinds=schema.get("type",())
    if isinstance(kinds,str):kinds=(kinds,)
    matches=(not kinds or value is None and "null" in kinds
        or isinstance(value,bool) and "boolean" in kinds
        or isinstance(value,str) and "string" in kinds
        or isinstance(value,dict) and "object" in kinds
        or isinstance(value,list) and "array" in kinds
        or finite(value) and "number" in kinds
        or finite(value) and int(value)==value and "integer" in kinds)
    if not matches:
        return [dict(field=path,message="Value does not satisfy the fixed schema type",
                     _constraint=("type", tuple(kinds)))]
    if "enum" in schema and not any(_same(value,item) for item in schema["enum"]):
        problem("Value is outside the fixed schema enumeration")
    if "const" in schema and not _same(value,schema["const"]):
        problem("Value differs from the fixed schema constant")
    if isinstance(value,dict):
        for key in schema.get("required",()):
            if key not in value:
                out.append(dict(field=path+("." if path else "")+key,message="Required authored member is absent",
                                _constraint=("required", None)))
        properties=schema.get("properties",{})
        for key,item in value.items():
            target=path+("." if path else "")+key
            if key in properties:
                out.extend(_violations(item,properties[key],root,target))
            elif schema.get("additionalProperties") is False:
                out.append(dict(field=target,message="Member is outside the fixed closed object"))
        for key,dependent in schema.get("dependentSchemas",{}).items():
            if key in value:out.extend(_violations(value,dependent,root,path))
    if isinstance(value,list):
        if len(value)<schema.get("minItems",0):
            problem("Array has fewer than the fixed minimum items")
        if "items" in schema:
            for index,item in enumerate(value):
                out.extend(_violations(item,schema["items"],root,path+"["+str(index)+"]"))
    if isinstance(value,str):
        if len(value)<schema.get("minLength",0):
            problem("String is shorter than the fixed minimum")
        if "pattern" in schema and re.search(schema["pattern"],value,re.ASCII) is None:
            problem("String does not match the fixed schema pattern")
        if schema.get("format")=="date" and not calendar_date(value):
            problem("A real authored calendar date is required")
    if finite(value):
        for key,valid in (("minimum",lambda bound:value>=bound),
                          ("maximum",lambda bound:value<=bound),
                          ("exclusiveMinimum",lambda bound:value>bound),
                          ("exclusiveMaximum",lambda bound:value<bound)):
            if key in schema and not valid(schema[key]):
                problem("Number is outside the fixed "+key+" bound", (key, schema[key]))
    for child in schema.get("allOf",()):
        out.extend(_violations(value,child,root,path))
    if "oneOf" in schema:
        admitted=sum(not _violations(value,child,root,path) for child in schema["oneOf"])
        if admitted!=1:problem("Value must satisfy exactly one fixed union branch")
    if "not" in schema and not _violations(value,schema["not"],root,path):
        problem("Value matches an excluded fixed schema shape")
    if "if" in schema:
        key="else" if _violations(value,schema["if"],root,path) else "then"
        if key in schema:out.extend(_violations(value,schema[key],root,path))
    return out


def optional_shape_assessments(document, *, registered_recovery_shapes=None,
                               registered_recovery_issues=()):
    """Current inline payload admission; history is not financially reclassified."""
    represented = registered_recovery_shapes or {}
    result={name:dict(shape_findings=[]) for name in
            ("lease_recoveries","capital_stack_sizing","waterfall_claims")}
    physical={id(block):index for index,block in enumerate(document.source.blocks)}
    schemas={}
    def check(block,family,value,filename,pointer="",field=""):
        if filename not in schemas:
            schemas[filename]=json.loads((_SCHEMAS/filename).read_text(encoding="utf8"))
        root=schemas[filename];schema=root
        for member in pointer.split("/") if pointer else ():
            schema=schema[member]
        context=dict(block_index=physical[id(block)],variant=dict(block.attributes).get("variant"),
                     body_byte_start=block.body_span.start,body_byte_end=block.body_span.end)
        unsupported=_unsupported(schema,root)
        findings=([dict(field=field,message=message) for message in unsupported]
                  if unsupported else _violations(value,schema,root,field))
        for finding in findings:
            constraint = finding.pop("_constraint", None)
            evidence = dict(section=block.section, **finding, context=dict(context))
            code = (represented.get((physical[id(block)], finding["field"], constraint))
                    if family == "lease_recoveries" else None)
            # Only these two accepted REC-02 parent predicates gain new
            # consumption. An actual emitted error must own the same physical
            # row, section and field; another REC-02 cannot cover its sibling.
            parent = re.fullmatch(r"tenants\[(?:0|[1-9][0-9]*)\]\.recovery_terms(?:\.cap)?",
                                  finding["field"]) if family == "lease_recoveries" else None
            if parent and constraint and constraint[0] == "type":
                kinds = ("object", "null") if finding["field"].endswith(".cap") else ("object",)
                owned = (code == "REC-02" and constraint == ("type", kinds)
                         and any(owner.get("code") == "REC-02"
                             and owner.get("severity") == "error"
                             and owner.get("section") == block.section
                             and owner.get("field") == finding["field"]
                             and type(owner.get("context", {}).get("block_index")) is int
                             and owner["context"]["block_index"] == physical[id(block)]
                             for owner in registered_recovery_issues))
                if not owned:
                    code = None
            if code:
                # Exact physical row, authored field and schema constraint only.
                # Retain evidence; never infer ownership from a generic REC code.
                result[family].setdefault("handled_shape_findings", []).append(dict(
                    **evidence, registered_code=code,
                    disposition="represented_by_registered_recovery_finding"))
            else:
                result[family]["shape_findings"].append(evidence)
    for block in current_blocks(document,"rent_roll"):
        tenants=block.parsed.value.get("tenants")
        if not isinstance(tenants,list):continue
        for index,tenant in enumerate(tenants):
            if not isinstance(tenant,dict):continue
            for key,filename in (("recovery_terms","lease-recovery-terms.schema.json"),
                                 ("recovery_true_up","lease-recovery-true-up.schema.json")):
                if key in tenant and tenant[key] is not None:
                    check(block,"lease_recoveries",tenant[key],filename,field="tenants["+str(index)+"]."+key)
    for block in current_blocks(document,"capital_stack"):
        if "sizing" in block.parsed.value:
            check(block,"capital_stack_sizing",block.parsed.value["sizing"],
                  "section-capital-stack.schema.json","properties/sizing","sizing")
    for block in current_blocks(document,"components"):
        for component,body in block.parsed.value.items():
            if component not in BUILTINS or component in ("mixed_use","land") or not isinstance(body,dict):
                continue
            stack=body.get("capital_stack")
            if isinstance(stack,dict) and "sizing" in stack:
                check(block,"capital_stack_sizing",stack["sizing"],
                      "section-capital-stack.schema.json","properties/sizing",component+".capital_stack.sizing")
    for block in current_blocks(document,"distribution_waterfall"):
        for key in ("clawback","stated_outcomes","stated_schedule"):
            if key in block.parsed.value:
                check(block,"waterfall_claims",block.parsed.value[key],
                      "section-distribution-waterfall.schema.json","properties/"+key,key)
    return result
