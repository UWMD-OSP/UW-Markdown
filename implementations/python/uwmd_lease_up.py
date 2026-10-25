"""Independent Format4.25 arithmetic with accepted RFC0092 native 2/4 quanta."""
from uwmd_calc_errors import CalcError
from uwmd_binding_sources import finite
from uwmd_numeric import quantize
from uwmd_spec_data import metric_dictionary
from uwmd_verifier_common import selected,result,finding
from uwmd_validation_selection import field


def lease_up_context(document):
    try:block=selected(document,'property')
    except CalcError:return dict(total_sf=None)
    if block is None: return dict(total_sf=None)
    payload=block.parsed.value
    cls=document.frontmatter.value.get('asset_class')
    entry=next((e for e in metric_dictionary()['size_intensives'] if cls in e['asset_classes']),None)
    if entry and entry['unit']=='sqft' and finite(field(payload,entry['path'])):
        return dict(total_sf=field(payload,entry['path']))
    for path in ('total_nra_sqft','rentable_square_feet','net_rentable_square_feet'):
        value=field(payload,path)
        if finite(value) and value>0: return dict(total_sf=value)
    return dict(total_sf=None)


def verify_lease_up_schedule(payload,ctx):
    issues=[]
    rows=payload.get('schedule') or []
    if not isinstance(rows,list) or any(not isinstance(row,dict) for row in rows):return result([finding('LU-UNEVALUABLE','indeterminate','Schedule rows are invalid')])
    def compare(stated,raw,places,code,period=None):
        extra={'period':period} if isinstance(period,str) else {}
        if not finite(raw):
            issues.append(finding('LU-UNEVALUABLE','indeterminate','Required stated input is unavailable',**extra))
        elif quantize(stated,places)!=quantize(raw,places):
            issues.append(finding(code,'failure','Stated figure disagrees',expected=str(quantize(stated,places)),actual=str(quantize(raw,places)),**extra))
    for row in rows:
        if not finite(row.get('net_cash_flow')): continue
        parts=[row.get(k) for k in ('rent_revenue','concessions','ti_lc_capex')]
        raw=(parts[0]+parts[1])+parts[2] if all(map(finite,parts)) else None
        compare(row['net_cash_flow'],raw,2,'LU-NCF-DISAGREES',row.get('period'))
    summary=payload.get('stabilized_summary') or {}
    final=rows[-1] if rows else {}
    if finite(summary.get('occupied_sf')):
        compare(summary['occupied_sf'],final.get('occupied_sf'),2,'LU-SUMMARY-DISAGREES')
    if finite(summary.get('occupancy_rate')):
        sf=final.get('occupied_sf')
        if not finite(sf): sf=summary.get('occupied_sf')
        total=ctx.get('total_sf')
        raw=sf/total if finite(sf) and finite(total) and total>0 else None
        compare(summary['occupancy_rate'],raw,4,'LU-SUMMARY-DISAGREES')
    return result(issues)


def lease_up_report(document,variant=None):
    block=selected(document,'lease_up_schedule',variant)
    if block is None: return dict(section='lease_up_schedule',variant=None,status='not_applicable',verification=None)
    verification=verify_lease_up_schedule(block.parsed.value,lease_up_context(document))
    return dict(section='lease_up_schedule',variant=dict(block.attributes).get('variant'),status=verification['verdict'],verification=verification)
