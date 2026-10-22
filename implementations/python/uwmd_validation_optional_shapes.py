"""Local admission for authored REC/CS/WF fields not allocated validator codes.

Only the named normative schema fragments are inspected. This is not a general
JSON Schema library, financial verifier or new registered diagnostic family.
"""
import re

from uwmd_binding_sources import finite
from uwmd_numeric import calendar_date
from uwmd_spec_data import schema as spec_schema
from uwmd_validation_selection import current_blocks
from uwmd_validation_core import BUILTINS
from uwmd_validation_lease import _POOL
from uwmd_validation_payload_admission import payload_findings,same_payload_owner



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
        problem("Value is outside the fixed schema enumeration", ("enum", tuple(schema["enum"])))
    if "const" in schema and not _same(value,schema["const"]):
        problem("Value differs from the fixed schema constant", ("const",schema["const"]))
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
            problem("Array has fewer than the fixed minimum items", ("minItems", schema["minItems"]))
        if "items" in schema:
            for index,item in enumerate(value):
                out.extend(_violations(item,schema["items"],root,path+"["+str(index)+"]"))
    if isinstance(value,str):
        if len(value)<schema.get("minLength",0):
            problem("String is shorter than the fixed minimum")
        if "pattern" in schema and re.search(schema["pattern"],value,re.ASCII) is None:
            problem("String does not match the fixed schema pattern", ("pattern", schema["pattern"]))
        if schema.get("format")=="date" and not calendar_date(value):
            problem("A real authored calendar date is required", ("format", "date"))
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



def _registered_optional_owner(block, index, field, constraint, issues):
    """Closed REC03/04 and WF10/13 predicates; no generic schema ownership.

    Match current data, exact fixed constraint, emitted error and same physical
    block. A broad row diagnostic never consumes its unrelated numeric siblings.
    """
    code, owner_field = None, None
    if block.section == "rent_roll":
        match = re.fullmatch(r"tenants\[(0|[1-9][0-9]*)\]\.(.+)", field)
        tenants = block.parsed.value.get("tenants")
        if not match or not isinstance(tenants, list) or int(match[1]) >= len(tenants):
            return None
        tenant = tenants[int(match[1])]
        if not isinstance(tenant, dict):
            return None
        root, path = "tenants["+match[1]+"].", match[2]
        terms = tenant.get("recovery_terms")
        if isinstance(terms,dict):
            cap=terms.get("cap");cap=cap if isinstance(cap,dict) else {}
            method=terms.get("method");method_needed=any(value is not None for key,value in terms.items() if key not in ("method","cap"))
            if path=="recovery_terms.method":
                invalid=("method" in terms and (not isinstance(method,str) or method not in ("net","base_year_stop","fixed_stop","fixed_amount","none")))
                owned=(invalid and constraint==("enum",("net","base_year_stop","fixed_stop","fixed_amount","none"))
                       or "method" not in terms and method_needed and constraint==("required",None))
                if owned:code,owner_field="REC-02",root+path
            elif path=="recovery_terms.cap.accumulation":
                mp=("method" in terms and method is not None and "pct" in cap and cap["pct"] is not None)
                invalid=cap.get("accumulation") not in ("cumulative","non_cumulative","compounding")
                if mp and invalid and constraint in (("required",None),("type",("string",)),
                    ("enum",("cumulative","non_cumulative","compounding",None))):
                    code,owner_field="REC-02",root+path
            elif path in ("recovery_terms.base_year","recovery_terms.expense_stop_per_sqft","recovery_terms.fixed_recovery_annual"):
                required={"base_year_stop":"base_year","fixed_stop":"expense_stop_per_sqft","fixed_amount":"fixed_recovery_annual"}.get(method) if isinstance(method,str) else None
                name=path.split(".")[-1]
                if name==required and (name not in terms or terms[name] is None) and constraint==("required",None):
                    code,owner_field="REC-02",root+path
        if path.startswith("recovery_terms.recoverable_pool") and isinstance(terms, dict):
            pool = terms.get("recoverable_pool")
            owner_field = root+"recovery_terms.recoverable_pool"
            if path == "recovery_terms.recoverable_pool":
                valid = (pool is not None and not isinstance(pool, list)
                         and constraint == ("type", ("array", "null"))
                         or isinstance(pool, list) and not pool and constraint == ("minItems", 1))
            else:
                child = re.fullmatch(r"recovery_terms\.recoverable_pool\[(0|[1-9][0-9]*)\]", path)
                valid = (child is not None and isinstance(pool, list) and int(child[1]) < len(pool)
                         and not isinstance(pool[int(child[1])], str)
                         and constraint == ("type", ("string",)))
            if valid and pool is not None and (not isinstance(pool, list) or not pool
                    or any(item not in _POOL for item in pool)):
                code = "REC-03"
                if path != "recovery_terms.recoverable_pool": owner_field = root+path
        elif path.startswith("recovery_true_up"):
            entries = tenant.get("recovery_true_up")
            if path == "recovery_true_up":
                if entries is not None and not isinstance(entries, list) and constraint == ("type", ("array",)):
                    code, owner_field = "REC-04", root+path
            else:
                child = re.fullmatch(r"recovery_true_up\[(0|[1-9][0-9]*)\](?:\.(period_start|period_end|settlement|cash_flow_ref))?",path)
                if child and isinstance(entries,list) and int(child[1]) < len(entries):
                    row = entries[int(child[1])]; leaf = child[2]
                    owner_field = root+"recovery_true_up["+child[1]+"]"
                    if leaf in ("period_start","period_end"): owner_field += ".period_start"
                    elif leaf == "settlement": owner_field += ".settlement"
                    if leaf is None:
                        valid = not isinstance(row,dict) and constraint == ("type",("object",))
                    elif isinstance(row,dict) and leaf in ("period_start","period_end"):
                        date = row.get(leaf)
                        valid = ((leaf not in row and constraint == ("required",None))
                            or (leaf in row and not isinstance(date,str) and constraint == ("type",("string",)))
                            or isinstance(date,str) and not calendar_date(date) and constraint in (
                                ("pattern",r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),("format","date")))
                    elif isinstance(row,dict) and leaf == "cash_flow_ref":
                        value=row.get(leaf)
                        valid=value is not None and not isinstance(value,dict) and constraint==("type",("object","null"))
                        if valid:code,owner_field="REC-09",root+path
                    elif isinstance(row,dict) and leaf == "settlement":
                        valid = ("settlement" in row and row[leaf] not in (None,"billed","credited","disputed","unsettled")
                            and constraint == ("enum",("billed","credited","disputed","unsettled",None)))
                    else:
                        valid = False
                    if valid and leaf!="cash_flow_ref": code = "REC-04"
    elif block.section == "distribution_waterfall":
        claim = block.parsed.value.get("clawback")
        if field == "clawback":
            if claim is not None and not isinstance(claim,dict) and constraint == ("type",("object","null")):
                code,owner_field = "WF-10","clawback"
        elif isinstance(claim,dict):
            basis = claim.get("basis")
            if field == "clawback.basis":
                if (("basis" not in claim and constraint == ("required",None)) or
                    ("basis" in claim and basis not in ("lp_preferred_shortfall","lp_irr_floor","lp_em_floor")
                     and constraint == ("enum",("lp_preferred_shortfall","lp_irr_floor","lp_em_floor")))):
                    code,owner_field = "WF-10",field
            elif ((field == "clawback.floor_rate" and basis == "lp_irr_floor") or
                  (field == "clawback.floor_multiple" and basis == "lp_em_floor")):
                value = claim.get(field.split(".")[1]); rate = basis == "lp_irr_floor"
                if value is not None and (
                    not finite(value) and constraint == ("type",("number","null"))
                    or finite(value) and value <= (0 if rate else 1)
                       and constraint == ("exclusiveMinimum",0 if rate else 1)
                    or rate and finite(value) and value >= 1 and constraint == ("exclusiveMaximum",1)):
                    code,owner_field = "WF-10",field
            elif field == "clawback.cap":
                if (("cap" not in claim and constraint==("required",None)) or
                    (claim.get("cap")!="promote_received" and constraint==("const","promote_received"))):
                    code,owner_field="WF-12",field
            elif field == "clawback.net_of_tax_rate":
                value = claim.get("net_of_tax_rate")
                if value is not None and (
                    not finite(value) and constraint == ("type",("number","null"))
                    or finite(value) and value < 0 and constraint == ("minimum",0)
                    or finite(value) and value >= 1 and constraint == ("exclusiveMaximum",1)):
                    code,owner_field = "WF-13",field
    if code and any(issue.get("code") == code and issue.get("severity") == "error"
            and issue.get("section") == block.section and issue.get("field") == owner_field
            and type(issue.get("context",{}).get("block_index")) is int
            and issue["context"]["block_index"] == index for issue in issues):
        return code
    return None


def optional_shape_assessments(document, *, registered_recovery_shapes=None,
                               registered_recovery_issues=()):
    """Current inline payload admission; history is not financially reclassified."""
    represented = registered_recovery_shapes or {}
    result={name:dict(shape_findings=[]) for name in
            ("lease_recoveries","capital_stack_sizing","waterfall_claims")}
    physical={id(block):index for index,block in enumerate(document.source.blocks)}
    schemas={}
    predictions=payload_findings(document)
    new_fields={}
    for prediction in predictions:
        code=prediction["code"]
        family={"REC-11":"lease_recoveries","CS-03":"capital_stack_sizing","WF-16":"waterfall_claims"}.get(code)
        if family is None:continue
        index=prediction["context"]["block_index"]
        new_fields[index,prediction["field"]]=prediction
        evidence=dict(section=prediction["section"],field=prediction["field"],message=prediction["message"],
                      context=dict(prediction["context"]))
        if same_payload_owner(prediction,registered_recovery_issues):
            result[family].setdefault("handled_shape_findings",[]).append(dict(**evidence,
                registered_code=code,disposition="represented_by_registered_payload_admission"))
        else:result[family]["shape_findings"].append(evidence)
    def check(block,family,value,filename,pointer="",field=""):
        if filename not in schemas:
            schemas[filename]=spec_schema(filename)
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
            if (physical[id(block)],finding["field"]) in new_fields:
                continue  # Fresh exact predicate evidence above owns its local DTO.
            # RFC0096's M/P contract supersedes an old schema presence-only
            # accumulation trigger. Keep that obsolete assertion as evidence,
            # without making absent/null optional accumulation a local refusal.
            match=re.fullmatch(r"tenants\[(0|[1-9][0-9]*)\]\.recovery_terms\.cap\.accumulation",finding["field"])
            tenants=block.parsed.value.get("tenants")
            if match and isinstance(tenants,list) and int(match[1])<len(tenants):
                tenant=tenants[int(match[1])];terms=tenant.get("recovery_terms") if isinstance(tenant,dict) else None
                cap=terms.get("cap") if isinstance(terms,dict) else None
                if isinstance(cap,dict):
                    mp=("method" in terms and terms["method"] is not None and "pct" in cap and cap["pct"] is not None)
                    if not mp and cap.get("accumulation") is None:
                        result[family].setdefault("excluded_shape_findings",[]).append(dict(section=block.section,
                            **finding,context=dict(context),disposition="optional_nullable_accumulation_without_M_and_P"))
                        continue
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
            if code is None:
                code = _registered_optional_owner(block,physical[id(block)],finding["field"],
                                                  constraint,registered_recovery_issues)
            if code:
                # Exact physical row, authored field and schema constraint only.
                # Retain evidence; never infer ownership from a generic REC code.
                result[family].setdefault("handled_shape_findings", []).append(dict(
                    **evidence, registered_code=code,
                    disposition="represented_by_registered_admission_finding"))
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
    # CS sizing and WF stated-claim structures now use the explicit accepted
    # union/lexical predicates above, rather than generic schema union/date guesses.
    for block in current_blocks(document,"distribution_waterfall"):
        if "clawback" in block.parsed.value:
            check(block,"waterfall_claims",block.parsed.value["clawback"],
                  "section-distribution-waterfall.schema.json","properties/clawback","clawback")
    return result
