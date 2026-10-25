"""Read-only base Verifier orchestration; this local wrapper is not a new wire contract."""
import copy
from uwmd_reader import parse
from uwmd_validation import _validate_document
from uwmd_validation_selection import current_blocks
from uwmd_provenance import verify_provenance
from uwmd_metrics import verify_stated_metrics
from uwmd_cash_flows import verify_cash_flow_series
from uwmd_capital_stack import verify_capital_stack,context
from uwmd_lease_up import verify_lease_up_schedule,lease_up_context
from uwmd_waterfall import verify_waterfall
from uwmd_reserves import verify_reserve_accounts
from uwmd_reserve_draws import verify_reserve_draw_bindings
from uwmd_property_cash_flows import assemble_property_cash_flows
from uwmd_receipts import verify_receipt


async def verify_source(raw,*,filename=None,receipts=(),inputs=None,reserve_draw_plan=None,assembly_plan=None,signature_verifier=None):
    """Check a fresh source snapshot and every current base-verifier subject.

    External plans/receipts must be supplied explicitly. No profile, modeling,
    inferred cash or signature-backend claim is added by this convenience API.
    """
    raw=bytes(raw)
    receipts,inputs,reserve_draw_plan,assembly_plan=copy.deepcopy((receipts,inputs,reserve_draw_plan,assembly_plan))
    document=parse(raw,filename=filename,require_structured=True)
    validation=await _validate_document(document,_source_order=True)
    provenance=verify_provenance(document)
    report=dict(rule_set=document.frontmatter.value['uw_version'],validation=validation,provenance=provenance,sections=[])
    incomplete=validation['composition_assessment']['status']!='resolved' or bool(validation['metadata_assessment']['shape_findings']) or any(a['shape_findings'] for a in validation['section_assessment'].values())
    if validation['errors'] or incomplete:
        report['status']='failed' if validation['errors'] or not provenance['ok'] else 'unverifiable'
        return report
    report['metrics']=verify_stated_metrics(document)
    statuses=['failed'] if not provenance['ok'] else []
    if report['metrics']['counts']['failed']:statuses.append('failed')
    if report['metrics']['counts']['unverifiable']:statuses.append('unverifiable')
    for section in ('cash_flow_series','capital_stack','lease_up_schedule','distribution_waterfall'):
        for block in current_blocks(document,section):
            payload=block.parsed.value;variant=dict(block.attributes).get('variant')
            if section=='cash_flow_series':
                verification,checked=verify_cash_flow_series(payload)
                if not checked:continue
            elif section=='capital_stack':verification=verify_capital_stack(payload,context(document))
            elif section=='lease_up_schedule':verification=verify_lease_up_schedule(payload,lease_up_context(document))
            else:
                name=(payload.get('cash_flow_ref') or {}).get('variant')
                sources=[b.parsed.value for b in current_blocks(document,'cash_flow_series') if dict(b.attributes).get('variant')==name]
                verification=verify_waterfall(payload,sources[0] if len(sources)==1 else None)
            report['sections'].append(dict(section=section,variant=variant,verification=verification))
            statuses.append(verification['verdict'])
    report['reserve_accounts']=await verify_reserve_accounts(document)
    report['reserve_draws']=await verify_reserve_draw_bindings(document,reserve_draw_plan) if reserve_draw_plan is not None else await verify_reserve_draw_bindings(document)
    for key in ('reserve_accounts','reserve_draws'):
        statuses.append(report[key]['state'])
    binding=validation.get('replacement_funding_verification')
    if binding:statuses.append(binding['state'])
    if assembly_plan is not None:report['assembly']=assemble_property_cash_flows(document,assembly_plan)
    report['receipts']=[verify_receipt(receipt,raw,filename=filename,inputs=inputs,signature_verifier=signature_verifier) for receipt in receipts]
    statuses.extend(receipt['verdict'] for receipt in report['receipts'])
    report['status']='failed' if 'failed' in statuses else 'unverifiable' if 'unverifiable' in statuses else 'verified'
    return report
