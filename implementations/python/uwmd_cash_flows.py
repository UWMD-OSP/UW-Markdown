"""Independent dated verification from Format4.26 and ProtocolVIII.9/RFC0088.

Raw procedures use the accepted pinned power graph and ordered binary64 sums.
No projection, missing value substitution or host transcendental function.
"""
import math
from uwmd_binding_sources import finite, cash_flow_findings
from uwmd_calc_errors import CalcError
from uwmd_fdlibm import pinned_pow
from uwmd_numeric import year_fraction, cash_totals, quantize
from uwmd_verifier_common import selected, result, finding

METRICS=('total_net','moic','xnpv','xirr')


def xnpv(rate, rows, day_count='actual/365f'):
    if not finite(rate) or rate<=-1:
        raise CalcError('CALC-TYPE-001','XNPV requires a finite rate above -1')
    total=0.0
    base=1.0+rate
    for row in rows:
        t=year_fraction(rows[0]['date'],row['date'],day_count)
        total=total+row['amount']*pinned_pow(base,-t)
    return total


def xirr(rows, day_count='actual/365f'):
    lo,hi=-0.999,10.0
    flo,fhi=xnpv(lo,rows,day_count),xnpv(hi,rows,day_count)
    if not math.isfinite(flo) or not math.isfinite(fhi) or flo*fhi>0:
        raise CalcError('CALC-XIRR-DIVERGE','No accepted finite XIRR bracket')
    if flo==0: return lo
    if fhi==0: return hi
    for _ in range(200):
        mid=(lo+hi)/2.0
        residual=xnpv(mid,rows,day_count)
        if abs(residual)<1e-9 or (hi-lo)/2.0<1e-12: return mid
        if flo*residual<0:
            hi=mid
        else:
            lo,flo=mid,residual
    raise CalcError('CALC-XIRR-DIVERGE','XIRR exhausted its accepted procedure')


def verify_cash_flow_series(payload):
    stated=payload.get('stated_metrics') or {}
    checked=[key for key in METRICS if finite(stated.get(key)) or
             key=='xnpv' and isinstance(stated.get(key),dict) and finite(stated[key].get('value'))]
    issues=[]
    structural=[x for x in cash_flow_findings(payload) if x[0] in ('CF-01','CF-02')]
    if structural:
        return result([finding('CF-UNEVALUABLE','indeterminate','Cash flow series is structurally invalid')]),checked
    rows=payload['series']
    day_count=payload.get('day_count') or 'actual/365f'
    total,multiple=cash_totals([row['amount'] for row in rows])
    for key in checked:
        value=stated[key]['value'] if key=='xnpv' else stated[key]
        places={'total_net':2,'moic':4,'xnpv':2,'xirr':6}[key]
        try:
            expected=(total if key=='total_net' else multiple if key=='moic' else
                      xnpv(stated[key]['rate'],rows,day_count) if key=='xnpv' else xirr(rows,day_count))
            if expected is None or not finite(expected):
                issues.append(finding('CF-UNEVALUABLE','indeterminate','Metric has no finite value',metric=key))
            elif quantize(expected,places)!=quantize(value,places):
                issues.append(finding('CF-METRIC-DISAGREES','failure','Stated metric disagrees',metric=key,
                                      expected=str(quantize(expected,places)),actual=str(quantize(value,places))))
        except CalcError as error:
            issues.append(finding('CF-PROCEDURE-REFUSES','failure',str(error),metric=key))
    return result(issues),checked


def cash_flow_report(document,variant=None):
    block=selected(document,'cash_flow_series',variant,period=True)
    report=dict(section='cash_flow_series',variant=None,status='not_applicable',checked_metrics=[],verification=None)
    if block is None: return report
    report['variant']=dict(block.attributes).get('variant')
    verification,checked=verify_cash_flow_series(block.parsed.value)
    if checked:
        report.update(status=verification['verdict'],checked_metrics=checked,verification=verification)
    return report
