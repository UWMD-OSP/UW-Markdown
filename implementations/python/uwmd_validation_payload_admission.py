"""WIP adapter from current assembled Document refs to pure RFC0096 admission."""
from uwmd_composition import _directive
from uwmd_document_sources import source_context
from uwmd_payload_admission import _PayloadView, _payload_admission
from uwmd_reader import PARALLEL
from uwmd_validation_selection import active_blocks,current_blocks,is_externalized


def current_payload_views(document):
    physical={id(block):index for index,block in enumerate(document.source.blocks)}
    views=[]
    for section in ("lease_up_schedule","rent_roll","capital_stack","components","distribution_waterfall"):
        active=active_blocks(document,section)
        mapped=section in PARALLEL or (any("_role" in block.parsed.value for block in active)
                                      and any("variant" in dict(block.attributes) for block in active))
        for block in current_blocks(document,section,include_external=True):
            # Composition §3 requires both the fence marker and an admitted
            # directive. A malformed MODEL placeholder must not hide independent
            # payload findings; the SOURCE resolver retains its own refusals.
            body=block.parsed.value
            if is_externalized(block) and "external" in body and not _directive(body["external"]):
                continue
            key=dict(block.attributes).get("variant","default") if mapped else None
            views.append(_PayloadView(section,block.parsed.value,key,
                         source_context(document,physical[id(block)],block)))
    return tuple(views)


def payload_findings(document):
    return _payload_admission(current_payload_views(document),asset_class=document.frontmatter.value.get("asset_class"))


def payload_rules(ledger):
    ledger.issues.extend(payload_findings(ledger.document))


def same_payload_owner(prediction,issues):
    """A current predicate, exact field/block and actual error are all required."""
    index=prediction.get("context",{}).get("block_index")
    return type(index) is int and any(
        issue.get("code")==prediction["code"] and issue.get("severity")=="error"
        and issue.get("section")==prediction["section"] and issue.get("field")==prediction["field"]
        and type(issue.get("context",{}).get("block_index")) is int
        and issue["context"]["block_index"]==index for issue in issues)
