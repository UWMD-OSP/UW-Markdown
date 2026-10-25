"""Independent ProtocolVIII.10 tier walk, closed-form hurdles and terminal true-up."""
from uwmd_binding_sources import finite,cash_flow_findings
from uwmd_cash_flows import xnpv,xirr
from uwmd_calc_errors import CalcError
from uwmd_fdlibm import pinned_pow
from uwmd_numeric import year_fraction,quantize
from uwmd_verifier_common import selected,result,finding
from uwmd_validation_selection import current_blocks


def allocate_waterfall(waterfall,series):
    rows=series['series']; dc=series.get('day_count') or 'actual/365f'
    anchor=rows[0]['date']; previous=anchor
    parties={p:dict(unreturned=0.0,pref=0.0,contributions=0.0,distributions=0.0,roc=0.0,pref_received=0.0,flows=[]) for p in ('lp','gp')}
    tiers=waterfall['tiers']
    pref=next((t for t in tiers if t['type']=='preferred_return'),None)
    schedule=[]
    def balance(rate,date):
        t=year_fraction(anchor,date,dc)
        discounted=0.0
        for flow in parties['lp']['flows']:
            ft=year_fraction(anchor,flow['date'],dc)
            discounted=discounted+flow['amount']*pinned_pow(1.0+rate,-ft)
        return -discounted*pinned_pow(1.0+rate,t)
    for row in rows:
        date,amount=row['date'],row['amount']
        dt=year_fraction(previous,date,dc)
        for p in parties.values():
            if pref:
                if pref['accrual']=='simple':
                    p['pref']=p['pref']+(p['unreturned']*pref['rate'])*dt
                else:
                    p['pref']=p['pref']+(p['pref']+p['unreturned'])*(pinned_pow(1.0+pref['rate'],dt)-1.0)
        previous=date
        if amount<0:
            for key,p in parties.items():
                share=(-amount)*waterfall['equity_split'][key]
                p['unreturned']=p['unreturned']+share
                p['contributions']=p['contributions']+share
                p['flows'].append(dict(date=date,amount=-share))
        elif amount>0:
            cash=amount; cells=[]
            for index,tier in enumerate(tiers):
                kind=tier['type']; lp,gp=parties['lp'],parties['gp']
                if kind in ('return_of_capital','preferred_return'):
                    field='unreturned' if kind=='return_of_capital' else 'pref'
                    capacity=lp[field]+gp[field]
                    lp_share=lp[field]/capacity if capacity>0 else 0.0
                    gp_share=gp[field]/capacity if capacity>0 else 0.0
                elif kind=='catch_up':
                    profit=(lp['distributions']-lp['roc'])+(gp['distributions']-gp['roc'])
                    gp_profit=gp['distributions']-gp['roc']
                    capacity=max(0.0,(tier['target_promote']*profit-gp_profit)/(tier['gp_share']-tier['target_promote']))
                    gp_share=tier['gp_share']; lp_share=1.0-gp_share
                else:
                    lp_share,gp_share=tier['lp_share'],tier['gp_share']
                    capacities=[]
                    if tier.get('until_lp_em') is not None:
                        capacities.append(max(0.0,tier['until_lp_em']*lp['contributions']-lp['distributions'])/lp_share)
                    if tier.get('until_lp_irr') is not None:
                        capacities.append(max(0.0,balance(tier['until_lp_irr'],date))/lp_share)
                    capacity=((min(capacities) if tier.get('hurdle_mode')=='any' else max(capacities)) if capacities else cash)
                payment=min(cash,capacity)
                lp_payment,gp_payment=payment*lp_share,payment*gp_share
                if payment>0:
                    cells.append(dict(tier=index,lp=lp_payment,gp=gp_payment))
                    for key,value in (('lp',lp_payment),('gp',gp_payment)):
                        p=parties[key]
                        p['distributions']=p['distributions']+value
                        p['flows'].append(dict(date=date,amount=value))
                        if kind=='return_of_capital':
                            p['unreturned']=p['unreturned']-value; p['roc']=p['roc']+value
                        elif kind=='preferred_return':
                            p['pref']=p['pref']-value; p['pref_received']=p['pref_received']+value
                cash=cash-payment
            schedule.append(dict(date=date,by_tier=cells))
    if any(not finite(p[key]) for p in parties.values() for key in ('unreturned','pref','contributions','distributions','roc','pref_received')):
        raise CalcError('CALC-TYPE-001','Allocation has no finite outcome')
    outcomes={}
    for key,p in parties.items():
        item=dict(contributions=p['contributions'],distributions=p['distributions'],
                  moic=p['distributions']/p['contributions'] if p['contributions']!=0 else None)
        try:
            if not p['contributions']: raise CalcError('CALC-XIRR-DIVERGE','No contributed capital')
            item['xirr']=xirr(p['flows'],dc,anchor=anchor)
        except CalcError:
            item['xirr']=None
        outcomes[key]=item
    gp=parties['gp']; lp=parties['lp']
    promote=(gp['distributions']-gp['roc'])-gp['pref_received']
    outcomes['promote_total']=promote
    outcomes['profit_total']=(lp['distributions']+gp['distributions'])-(lp['contributions']+gp['contributions'])
    clawback=waterfall.get('clawback')
    outcomes['clawback_amount']=None
    if clawback:
        basis=clawback['basis']
        shortfall=(lp['unreturned']+lp['pref'] if basis=='lp_preferred_shortfall' else
                   clawback['floor_multiple']*lp['contributions']-lp['distributions'] if basis=='lp_em_floor' else
                   balance(clawback['floor_rate'],rows[-1]['date']))
        gross=min(max(0.0,shortfall),max(0.0,promote))
        outcomes['clawback_amount']=gross*(1.0-clawback['net_of_tax_rate']) if clawback.get('net_of_tax_rate') is not None else gross
    return dict(outcomes=outcomes,schedule=schedule)


def verify_waterfall(waterfall,series):
    if series is None or any(f[0] in ('CF-01','CF-02') for f in cash_flow_findings(series)):
        return result([finding('WF-UNEVALUABLE','indeterminate','Referenced series is absent or invalid')])
    issues=[]
    try:
        computed=allocate_waterfall(waterfall,series)
    except (CalcError,ValueError,ZeroDivisionError,OverflowError):
        return result([finding('WF-PROCEDURE-REFUSES','failure','Allocation procedure refused')])
    def compare(path,stated,value,places,code):
        if not finite(stated): return
        if value is None or not finite(value):
            refusal=path.endswith('.xirr')
            issues.append(finding('WF-PROCEDURE-REFUSES' if refusal else 'WF-UNEVALUABLE',
                                  'failure' if refusal else 'indeterminate','No recomputed stated figure',field=path))
        elif quantize(stated,places)!=quantize(value,places):
            issues.append(finding(code,'failure','Stated allocation disagrees',field=path,
                                  expected=str(quantize(stated,places)),actual=str(quantize(value,places))))
    stated=waterfall.get('stated_outcomes') or {}
    for party in ('lp','gp'):
        for metric in ('contributions','distributions','moic','xirr'):
            compare('stated_outcomes.'+party+'.'+metric,(stated.get(party) or {}).get(metric),
                    computed['outcomes'][party][metric],4 if metric=='moic' else 6 if metric=='xirr' else 2,'WF-OUTCOME-DISAGREES')
    for metric in ('promote_total','profit_total','clawback_amount'):
        compare('stated_outcomes.'+metric,stated.get(metric),computed['outcomes'][metric],2,'WF-OUTCOME-DISAGREES')
    if waterfall.get('stated_schedule') is not None:
        def cells(rows):
            values={}
            for row in rows:
                for cell in row['by_tier']:
                    for party in ('lp','gp'):
                        key=(row['date'],cell['tier'],party)
                        amount=cell.get(party)
                        if finite(amount): values[key]=values.get(key,0.0)+amount
            return values
        expected,actual=cells(waterfall['stated_schedule']),cells(computed['schedule'])
        for key in dict.fromkeys([*expected,*actual]):
            date,tier,party=key
            compare('stated_schedule.'+date+'.'+str(tier)+'.'+party,expected.get(key,0.0),actual.get(key,0.0),2,'WF-SCHEDULE-DISAGREES')
    return result(issues)


def waterfall_report(document,variant=None):
    block=selected(document,'distribution_waterfall',variant)
    if block is None: return dict(section='distribution_waterfall',variant=None,status='not_applicable',verification=None)
    payload=block.parsed.value
    ref=(payload.get('cash_flow_ref') or {}).get('variant')
    matches=[b for b in current_blocks(document,'cash_flow_series') if dict(b.attributes).get('variant','default')==ref]
    source=matches[0].parsed.value if len(matches)==1 else None
    verification=verify_waterfall(payload,source)
    return dict(section='distribution_waterfall',variant=dict(block.attributes).get('variant'),status=verification['verdict'],verification=verification)
