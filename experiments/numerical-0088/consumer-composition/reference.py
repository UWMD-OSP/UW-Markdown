"""Independent Python composition of seven accepted consumers, not a producer."""
import importlib.util,json,math,struct,sys
from fractions import Fraction
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('consumer_dated_reference',HERE.parent/'dated-conventions/python_graph.py')
dates=importlib.util.module_from_spec(spec);spec.loader.exec_module(dates)
prior=dates.prior;raw=prior.raw
finite=lambda x:isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
def encoded(v):
    if v is None or isinstance(v,(str,bool)):return v
    if isinstance(v,(int,float)):return prior.encoded(float(v))
    if isinstance(v,list):return list(map(encoded,v))
    return {k:encoded(x) for k,x in v.items()}
def rounded(value,dp):
    # Existing consumer scaled Math.round, NOT Protocol VIII.5 quantization.
    factor=raw.pow(10.,float(dp));scaled=value*factor
    if scaled==0:return scaled/factor
    if not finite(scaled):return scaled/factor
    magnitude=Fraction.from_float(abs(scaled));n=(magnitude+Fraction(1,2)).numerator//(magnitude+Fraction(1,2)).denominator
    return (-float(n) if scaled<0 else float(n))/factor

def yearfrac(a,b,convention,trace):return dates.fractions(dict(dates=[a,b],day_count=convention),trace)[1]
def annual_service(t,trace):
    if t.get('accrual')=='accrued':return 0.
    if t.get('accrual')=='split':return t['amount']*t['cash_rate'] if t['class']=='preferred_equity' and t.get('cash_rate') is not None else None
    if t['class']=='common_equity':return 0.
    if t.get('rate') is None:return None
    if t['class']=='preferred_equity':return t['amount']*t['rate']
    months=t.get('amortization_months') or 0
    if months<=0:return t['amount']*t['rate']
    r=trace.operation('capital','divide',t['rate'],12.)
    if r==0:monthly=trace.operation('capital','divide',t['amount'],float(months))
    else:
        numerator=trace.operation('capital','multiply',t['amount'],r)
        base=trace.operation('capital','add',1.,r)
        discount=trace.operation('capital','pow',base,-float(months))
        monthly=trace.operation('capital','divide',numerator,trace.operation('capital','subtract',1.,discount))
    return trace.operation('capital','multiply',monthly,12.)
def capital(case):
    trace=prior.Trace();tranches=case['stack']['tranches'];context=case['context'];ds=[annual_service(t,trace) for t in tranches]
    results=[];issues=[]
    for fig in case['stack'].get('sizing',[]):
        fn=fig['fn'];v=None;noi=context.get('noi');through=fig.get('through');owned=[i for i,t in enumerate(tranches) if through is not None and t['position']<=through]
        if fn=='coverage':
            i=next((i for i,t in enumerate(tranches) if t['id']==fig.get('over')),None)
            if i is not None and noi is not None and ds[i] is not None and ds[i]!=0:v=raw.divide(noi,ds[i])
        elif fn=='blended_coverage':
            if through is not None and noi is not None and all(ds[i] is not None for i in owned):
                total=0.
                for i in owned:total+=ds[i]
                if total!=0:v=raw.divide(noi,total)
        elif fn in ('debt_yield_through','ltc_through','ltv_through'):
            denominator=noi if fn=='debt_yield_through' else context.get('total_cost' if fn=='ltc_through' else 'total_value')
            if through is not None and denominator is not None:
                total=0.
                for i in owned:
                    if tranches[i]['class'] in ('senior_debt','mezzanine_debt','bridge','seller_financing','other_debt'):total+=tranches[i]['amount']
                if fn=='debt_yield_through':v=raw.divide(noi,total) if total!=0 else None
                elif denominator!=0:v=total/denominator
        elif fn=='weighted_cost':
            weighted=base=0.
            for t in tranches:
                if t.get('rate') is not None:weighted+=t['amount']*t['rate'];base+=t['amount']
            if base!=0:v=weighted/base
        if v is None:ok=False;issues.append(dict(code='CS-SIZING-UNEVALUABLE',severity='indeterminate'))
        else:
            dp=2 if fn in ('coverage','blended_coverage') else 4
            ok=finite(fig['value']) and finite(v) and prior.reporting(raw.to_bits(fig['value']),dp)['bits']==prior.reporting(raw.to_bits(v),dp)['bits']
            if not ok:issues.append(dict(code='CS-SIZING-DISAGREES',severity='failure'))
        results.append(dict(id=fig['id'],fn=fn,stated=fig['value'],recomputed=v,agrees=ok))
    verdict='failed' if any(x['severity']=='failure' for x in issues) else 'unverifiable' if issues else 'verified'
    return dict(id=case['id'],service=ds,verification=dict(verdict=verdict,issues=issues,sizing=results),trace=trace.rows)

def waterfall(case):
    w=case['waterfall'];series=case['series'];trace=prior.Trace()
    def new():return dict(unreturned=0.,accrued=0.,contributions=0.,distributions=0.,roc=0.,pref=0.,flows=[])
    states=[new(),new()];schedule=[];allocation=None
    if series is not None:
        rows=series['series'];convention=series.get('day_count','actual/365f');anchor=rows[0]['date']
        times=dates.fractions(dict(dates=[r['date'] for r in rows],day_count=convention),trace)
        preferred=next((x for x in w['tiers'] if x['type']=='preferred_return'),None);previous=None
        def hurdle(p,rate,t):
            f=p['flows'];value=prior.cash_value(rate,[x[1] for x in f],[x[0] for x in f],trace,'hurdle')
            balance=trace.operation('waterfall/hurdle','multiply',-value,trace.operation('waterfall/hurdle','pow',trace.operation('waterfall/hurdle','add',1.,rate),t))
            return balance if balance>0 else 0.
        for i,row in enumerate(rows):
            date=row['date'];t=times[i];amount=row['amount']
            if preferred is not None and previous is not None:
                dt=yearfrac(previous,date,convention,trace)
                if dt>0:
                    for p in states:
                        if preferred['accrual']=='simple':p['accrued']+=p['unreturned']*preferred['rate']*dt
                        else:
                            factor=trace.operation('waterfall/preference','pow',trace.operation('waterfall/preference','add',1.,preferred['rate']),dt)
                            increment=trace.operation('waterfall/preference','multiply',trace.operation('waterfall/preference','add',p['accrued'],p['unreturned']),trace.operation('waterfall/preference','subtract',factor,1.))
                            p['accrued']=trace.operation('waterfall/preference','add',p['accrued'],increment)
            previous=date
            if amount<0:
                for party,p in zip(('lp','gp'),states):
                    portion=-amount*w['equity_split'][party]
                    if portion!=0:p['unreturned']+=portion;p['contributions']+=portion;p['flows'].append((t,-portion))
                continue
            if amount==0:continue
            remaining=amount;cells=[];lp,gp=states
            for ti,tier in enumerate(w['tiers']):
                if not remaining>0:break
                lp_pay=gp_pay=0.;kind=tier['type']
                if kind=='return_of_capital':
                    cap=lp['unreturned']+gp['unreturned'];pay=min(remaining,cap)
                    if pay<=0 or cap<=0:continue
                    lp_pay=pay*(lp['unreturned']/cap);gp_pay=pay-lp_pay
                    for p,payment in zip(states,(lp_pay,gp_pay)):p['unreturned']-=payment;p['roc']+=payment
                elif kind=='preferred_return':
                    cap=lp['accrued']+gp['accrued'];pay=min(remaining,cap)
                    if pay<=0 or cap<=0:continue
                    lp_pay=pay*(lp['accrued']/cap);gp_pay=pay-lp_pay
                    for p,payment in zip(states,(lp_pay,gp_pay)):p['accrued']-=payment;p['pref']+=payment
                elif kind=='catch_up':
                    denominator=tier['gp_share']-tier['target_promote']
                    profit=lp['distributions']-lp['roc']+gp['distributions']-gp['roc'];gp_profit=gp['distributions']-gp['roc']
                    cap=max(0.,(tier['target_promote']*profit-gp_profit)/denominator);pay=min(remaining,cap)
                    if pay<=0:continue
                    gp_pay=pay*tier['gp_share'];lp_pay=pay-gp_pay
                elif kind=='split':
                    cap=float('inf');has_em=tier.get('until_lp_em') is not None;has_irr=tier.get('until_lp_irr') is not None
                    if has_em or has_irr:
                        if not tier['lp_share']>0:continue
                        em=max(0.,tier['until_lp_em']*lp['contributions']-lp['distributions'])/tier['lp_share'] if has_em else None
                        irr=hurdle(lp,tier['until_lp_irr'],t)/tier['lp_share'] if has_irr else None
                        cap=min(em,irr) if has_em and has_irr and tier.get('hurdle_mode')=='any' else max(em,irr) if has_em and has_irr else em if has_em else irr
                    pay=min(remaining,cap)
                    if pay<=0:continue
                    lp_pay=pay*tier['lp_share'];gp_pay=pay-lp_pay
                else:raise ValueError('bounded fixture tier domain')
                pay=lp_pay+gp_pay
                if pay<=0:continue
                for p,payment in zip(states,(lp_pay,gp_pay)):
                    p['distributions']+=payment
                    if payment!=0:p['flows'].append((t,payment))
                cells.append(dict(tier=ti,lp=lp_pay,gp=gp_pay));remaining-=pay
            if remaining>1e-9*amount:raise ValueError('bounded fixture residue')
            if cells:schedule.append(dict(date=date,by_tier=cells))
        def party_result(p):
            result=prior.solve([x[1] for x in p['flows']],[x[0] for x in p['flows']],trace) if len(p['flows'])>=2 else None
            xirr=raw.from_bits(result['raw']['bits']) if result is not None and result['status']=='returned' else None
            return dict(contributions=p['contributions'],distributions=p['distributions'],roc_received=p['roc'],pref_received=p['pref'],moic=p['distributions']/p['contributions'] if p['contributions']>0 else None,xirr=xirr)
        promote=gp['distributions']-gp['roc']-gp['pref'];provision=w.get('clawback');clawback=None
        if provision is not None:
            basis=provision['basis']
            shortfall=lp['unreturned']+lp['accrued'] if basis=='lp_preferred_shortfall' else provision['floor_multiple']*lp['contributions']-lp['distributions'] if basis=='lp_em_floor' else hurdle(lp,provision['floor_rate'],times[-1])
            gross=min(shortfall,max(0.,promote));tax=provision.get('net_of_tax_rate')
            clawback=0. if not shortfall>0 else gross*(1-tax) if finite(tax) and tax>0 else gross
        allocation=dict(lp=party_result(lp),gp=party_result(gp),promote_total=promote,profit_total=lp['distributions']+gp['distributions']-lp['contributions']-gp['contributions'],clawback=clawback,schedule=schedule)
    issues=[];stated=w.get('stated_outcomes') or {};stated_schedule=w.get('stated_schedule') or []
    def issue(code,severity,field=None):issues.append(dict(code=code,severity=severity,**({'field':field} if field is not None else {})))
    def compare_currency(field,claim,actual,dp=2,code='WF-OUTCOME-DISAGREES'):
        if finite(claim):
            want=rounded(claim,dp);got=rounded(actual,dp);trace.emit('consumer_reporting',field=field,places=dp,claim=prior.encoded(claim),actual=prior.encoded(actual),want=prior.encoded(want),got=prior.encoded(got))
            if want!=got:issue(code,'failure',field)
    if (stated or stated_schedule) and allocation is None:issue('WF-UNEVALUABLE','indeterminate')
    elif allocation is not None:
        for name in ('lp','gp'):
            claim=stated.get(name) or {};actual=allocation[name]
            for key in ('contributions','distributions'):compare_currency(f'stated_outcomes.{name}.{key}',claim.get(key),actual[key])
            for key,dp,refusal in [('moic',4,'WF-UNEVALUABLE'),('xirr',6,'WF-PROCEDURE-REFUSES')]:
                if finite(claim.get(key)):
                    if actual[key] is None:issue(refusal,'indeterminate' if key=='moic' else 'failure',f'stated_outcomes.{name}.{key}')
                    else:compare_currency(f'stated_outcomes.{name}.{key}',claim[key],actual[key],dp)
        for key in ('promote_total','profit_total'):compare_currency('stated_outcomes.'+key,stated.get(key),allocation[key])
        if finite(stated.get('clawback_amount')):
            if allocation['clawback'] is None:issue('WF-UNEVALUABLE','indeterminate','stated_outcomes.clawback_amount')
            else:compare_currency('stated_outcomes.clawback_amount',stated['clawback_amount'],allocation['clawback'])
        if stated_schedule:
            actual_dates={r['date']:{c['tier']:c for c in r['by_tier']} for r in allocation['schedule']};claim_dates={r['date']:{c['tier']:c for c in r['by_tier']} for r in stated_schedule}
            for date in sorted(set(actual_dates)|set(claim_dates)):
                for tier in range(len(w['tiers'])):
                    for name in ('lp','gp'):
                        claim=claim_dates.get(date,{}).get(tier,{}).get(name,0.);actual=actual_dates.get(date,{}).get(tier,{}).get(name,0.)
                        compare_currency(f'stated_schedule[{date}].tier[{tier}].{name}',claim,actual,2,'WF-SCHEDULE-DISAGREES')
    verdict='failed' if any(x['severity']=='failure' for x in issues) else 'unverifiable' if issues else 'verified'
    return dict(id=case['id'],allocation=allocation,verification=dict(verdict=verdict,issues=issues),trace=trace.rows)

A=[-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.38357751867269e2,-3.066479806614716e1,2.506628277459239]
B=[-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1]
C=[-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783]
D=[7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416]
def normal_value(p,trace):
    if not p>0 or not p<1:raise ValueError('RangeError')
    def horner(x,coeffs):
        v=coeffs[0]
        for c in coeffs[1:]:v=trace.operation('normal/horner','add',trace.operation('normal/horner','multiply',v,x),c)
        return v
    low=.02425;high=1-low
    if p<low or p>high:
        value=p if p<low else trace.operation('normal/upper','subtract',1.,p)
        logarithm=raw.log(value);trace.emit('normal_log',tail='lower' if p<low else 'upper',argument=prior.encoded(value),result=prior.encoded(logarithm))
        q=raw.sqrt(trace.operation('normal/tail','multiply',-2.,logarithm))
        numerator=horner(q,C);denominator=horner(q,D+[1.]);answer=trace.operation('normal/tail','divide',numerator,denominator)
        return answer if p<low else -answer
    q=trace.operation('normal/central','subtract',p,.5);r=trace.operation('normal/central','multiply',q,q)
    numerator=trace.operation('normal/central','multiply',horner(r,A),q);return trace.operation('normal/central','divide',numerator,horner(r,B+[1.]))
def normal(case):
    trace=prior.Trace();p=raw.from_bits(case['p'])
    try:
        z=normal_value(p,trace);draw=case['mean']+case['stddev']*z;result=dict(status='returned',z=z,draw=draw)
    except ValueError:result=dict(status='refused',error='RangeError')
    return dict(id=case['id'],result=result,trace=trace.rows)
def uniforms(seed,count):
    modulus=1<<128;state=0;multiplier=47026247687942121848144207491837523525;increment=117397592171526113268558934119004209487
    advance=lambda value:(value*multiplier+increment)%modulus
    state=advance(0);state=advance((state+seed)%modulus);values=[]
    for _ in range(count):
        state=advance(state);folded=((state>>64)^state)&((1<<64)-1);rotation=state>>122
        rotated=((folded>>rotation)|(folded<<(64-rotation)))&((1<<64)-1) if rotation else folded
        values.append(float(rotated>>11)/9007199254740992.)
    return values

def stochastic(case):
    trace=prior.Trace();u=uniforms(case['seed'],case['samples']);values=[]
    for p in u:
        value=case['mean']+case['stddev']*normal_value(5e-324 if p==0 else p,trace)
        values.append(raw.from_bits(prior.reporting(raw.to_bits(value),case['places'])['bits']))
    n=len(values);ordered=sorted(values);total=0.
    for v in values:total+=v
    mean=total/n;variance=0.
    for v in values:variance+=(v-mean)*(v-mean)
    summary=dict(mean=mean,median=ordered[max(0,math.ceil(.5*n)-1)],p10=ordered[max(0,math.ceil(.1*n)-1)],p25=ordered[max(0,math.ceil(.25*n)-1)],p75=ordered[max(0,math.ceil(.75*n)-1)],p90=ordered[max(0,math.ceil(.9*n)-1)],min=ordered[0],max=ordered[-1],stddev=raw.sqrt(variance/(n-1)))
    return dict(id=case['id'],uniforms=u,samples=values,summary=summary,failed_samples=0,trace=trace.rows)
def recovery(case):
    r=case['row'];share=case['share'];issues=[]
    def add(code,field):issues.append(dict(code=code,severity='error',field='tenants[0].recovery_true_up[0].'+field))
    product=rounded(r['pool_actual']*share,2);uncapped=rounded(r['tenant_share_uncapped'],2);capped=rounded(r['tenant_share_capped'],2);difference=rounded(r['tenant_share_capped']-r['estimated_billed'],2);stated=rounded(r['true_up_amount'],2)
    if uncapped!=product:add('REC-06','tenant_share_uncapped')
    if capped>uncapped:add('REC-07','tenant_share_capped')
    if stated!=difference:add('REC-08','true_up_amount')
    return dict(id=case['id'],issues=issues,rounded=dict(product=product,uncapped=uncapped,capped=capped,difference=difference,stated=stated))
def run(inputs):return dict(capital=[capital(c) for c in inputs['capital']],waterfall=[waterfall(c) for c in inputs['waterfall']],normal=[normal(c) for c in inputs['normal']],stochastic=stochastic(inputs['stochastic']),recovery=[recovery(c) for c in inputs['recovery']])
if __name__=='__main__':
    result=run(json.loads((HERE/'inputs.json').read_bytes()));result['recovery']=[{k:v for k,v in row.items() if k!='rounded'} for row in result['recovery']];Path(sys.argv[1]).write_text(json.dumps(dict(raw=encoded(result),comparison=encoded({k:([{a:b for a,b in x.items() if a!='trace'} for x in v] if isinstance(v,list) else {a:b for a,b in v.items() if a!='trace'}) for k,v in result.items()})),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
