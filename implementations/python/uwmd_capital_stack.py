"""Independent point-in-time sizing: Format4.24 and accepted RFC0092 4b.1.

Stabilized annual service is not an IO-payment schedule. Original tranche
order governs every sum; missing facts and zero denominators stay unavailable.
"""
from uwmd_calc_errors import CalcError
from uwmd_binding_sources import finite
from uwmd_fdlibm import pinned_pow,divide
from uwmd_numeric import quantize
from uwmd_validation_selection import field
from uwmd_verifier_common import selected,result,finding

DEBT=frozenset(('senior_debt','mezzanine_debt','bridge','seller_financing','other_debt'))
DECIMALS=dict(coverage=2,blended_coverage=2,debt_yield_through=4,ltc_through=4,ltv_through=4,weighted_cost=4)


def annual_service(tranche):
    amount=tranche.get('amount')
    if not finite(amount): return None
    accrual=tranche.get('accrual')
    kind=tranche.get('class')
    if accrual=='accrued': return 0.0
    if accrual=='split':
        return amount*tranche['cash_rate'] if kind=='preferred_equity' and finite(tranche.get('cash_rate')) else None
    if kind=='common_equity': return 0.0
    rate=tranche.get('rate')
    if not finite(rate): return None
    if kind=='preferred_equity': return amount*rate
    n=tranche.get('amortization_months')
    if n is None or finite(n) and n<=0: return amount*rate
    if not finite(n): return None
    i=rate/12.0
    monthly=amount/n if i==0 else divide(amount*i,1.0-pinned_pow(1.0+i,-n))
    return monthly*12.0


def context(document):
    def value(section,path):
        try:block=selected(document,section)
        except CalcError:return None
        v=field(block.parsed.value,path) if block else None
        return v if finite(v) else None
    cost=value('sources_uses','uses.total')
    return dict(noi=value('noi_model','net_operating_income'),
                total_cost=cost if cost is not None else value('sources_uses','total_uses'),
                total_value=value('valuation','underwritten_value'))


def sizing_value(stack,figure,ctx):
    tranches=stack.get('tranches',[])
    fn=figure.get('fn')
    if fn=='weighted_cost':
        if figure.get('over')!='*' or 'through' in figure: return None
        weighted=base=0.0
        for tranche in tranches:
            rate,amount=tranche.get('rate'),tranche.get('amount')
            if rate is None: continue
            if not finite(rate) or not finite(amount): return None
            weighted=weighted+amount*rate
            base=base+amount
        return weighted/base if base!=0 else None
    if fn=='coverage':
        matches=[t for t in tranches if t.get('id')==figure.get('over')]
        if len(matches)!=1 or 'through' in figure: return None
        denominator=annual_service(matches[0])
    else:
        through=figure.get('through')
        if not finite(through) or through<1 or not float(through).is_integer() or 'over' in figure: return None
        chosen=[t for t in tranches if finite(t.get('position')) and t['position']<=through]
        denominator=0.0
        if fn=='blended_coverage':
            for t in chosen:
                service=annual_service(t)
                if service is None: return None
                denominator=denominator+service
        elif fn in ('debt_yield_through','ltc_through','ltv_through'):
            for t in chosen:
                if t.get('class') in DEBT:
                    if not finite(t.get('amount')): return None
                    denominator=denominator+t['amount']
            if fn in ('ltc_through','ltv_through'):
                base=ctx.get('total_cost' if fn=='ltc_through' else 'total_value')
                return denominator/base if finite(base) and base!=0 else None
        else: return None
    noi=ctx.get('noi')
    return noi/denominator if finite(noi) and finite(denominator) and denominator!=0 else None


def verify_capital_stack(stack,ctx):
    issues=[]
    sizing=[]
    for figure in stack.get('sizing') or []:
        fn=figure['fn']
        raw=sizing_value(stack,figure,ctx)
        agrees=finite(raw) and quantize(figure['value'],DECIMALS[fn])==quantize(raw,DECIMALS[fn])
        sizing.append(dict(id=figure['id'],fn=fn,stated=figure['value'],recomputed=raw if finite(raw) else None,agrees=agrees))
        if not finite(raw):
            issues.append(finding('CS-SIZING-UNEVALUABLE','indeterminate','Sizing inputs are unavailable'))
        elif not agrees:
            issues.append(finding('CS-SIZING-DISAGREES','failure','Sizing disagrees',expected=str(figure['value']),actual=str(raw)))
    return result(issues,sizing=sizing)


def capital_stack_report(document,variant=None):
    block=selected(document,'capital_stack',variant)
    if block is None: return dict(section='capital_stack',variant=None,status='not_applicable',verification=None)
    verification=verify_capital_stack(block.parsed.value,context(document))
    return dict(section='capital_stack',variant=dict(block.attributes).get('variant'),status=verification['verdict'],verification=verification)
