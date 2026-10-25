"""Independent ProtocolV.3/V.10 source-authority and visible-supersede checks.

A principal label never repairs a malformed source namespace. History is evidence
for this heuristic only, not proof that all prior revisions were retained.
"""
import fnmatch
import re
from uwmd_binding_sources import finite
from uwmd_source_lifecycle import source_superseded
from uwmd_validation_selection import current_blocks

BUILTIN_POLICIES=(
    dict(source_pattern='agent/*',authority='either',supersede_on_edit=True),
    dict(source_pattern='manual',authority='either',supersede_on_edit=False),
    dict(source_pattern='document/*',authority='either',supersede_on_edit=True),
    dict(source_pattern='system/*',authority='system_only',supersede_on_edit=False),
    dict(source_pattern='institution/*',authority='system_only',supersede_on_edit=False),
    dict(source_pattern='*',authority='either',supersede_on_edit=True))

class ProvenancePolicyUnavailable(ValueError):
    """Explicit caller policy does not cover a source; no authorization is inferred."""


def actor_class(source):
    if source=='manual':return 'human'
    match=re.fullmatch(r'(agent|document|system|institution)/[A-Za-z0-9][A-Za-z0-9._-]*',source)
    if not match:return 'unknown'
    return {'agent':'agent','document':'unknown','system':'system','institution':'system'}[match[1]]


def verify_provenance(document,policies=None):
    policies=BUILTIN_POLICIES if policies is None else policies
    issues=[]
    for section in dict.fromkeys(block.section for block in document.source.blocks):
        for block in current_blocks(document,section):
            payload=block.parsed.value;meta=payload.get('_meta')
            if not isinstance(meta,dict):continue
            provenance=meta.get('provenance')
            if not isinstance(provenance,dict) or not isinstance(provenance.get('source'),str):continue
            source=provenance['source'];matches=[]
            for index,policy in enumerate(policies):
                pattern=policy['source_pattern']
                if fnmatch.fnmatchcase(source,pattern):matches.append((len(pattern.replace('*','')),-index,policy))
            if not matches:raise ProvenancePolicyUnavailable('No policy covers '+source)
            policy=max(matches,key=lambda item:item[:2])[2]
            cls=actor_class(source)
            allows=cls!='system' if policy['authority']=='either' else cls=={'human_only':'human','agent_only':'agent','system_only':'system'}.get(policy['authority'])
            variant=dict(block.attributes).get('variant')
            def issue(code,message):
                issues.append(dict(code=code,severity='error',section=section,message=message,value=dict(variant=variant)))
            if not allows:issue('POL-01','Parsed source actor is not authorized for this policy')
            lifecycle=meta.get('lifecycle') or {}
            revision=lifecycle.get('revision')
            prior=any(b.section==section and dict(b.attributes).get('variant')==variant and source_superseded(b) for b in document.source.blocks)
            if policy['supersede_on_edit'] and finite(revision) and revision>1 and not prior:
                issue('POL-02','Revision claims an edit requiring supersede but no prior revision is visible')
    return dict(ok=not issues,issues=issues,chains_verified=0,chains_with_hashes=0,signatures_present=0,signatures_verified=0)
