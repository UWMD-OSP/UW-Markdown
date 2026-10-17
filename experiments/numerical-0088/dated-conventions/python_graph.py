"""Independent Gregorian sum-of-complete-years calendar composed with prior solver."""
import importlib.util
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('dated_prior_graph',HERE.parent/'financial-trajectories/python_graph.py')
prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
raw=prior.raw

def ordinal(parts):
    year,month,day=parts
    # Separate from JS civil-date eras and production ceil-count expression.
    leap=lambda y:y%4==0 and (y%100!=0 or y%400==0)
    total=sum(366 if leap(y) else 365 for y in range(year))
    months=[31,29 if leap(year) else 28,31,30,31,30,31,31,30,31,30,31]
    return total+sum(months[:month-1])+day-1

def fractions(case,trace):
    a=tuple(map(int,case['dates'][0].split('-')))
    values=[]
    for row,date in enumerate(case['dates']):
        b=tuple(map(int,date.split('-')))
        fields=dict(row=row,anchor=case['dates'][0],date=date,convention=case['day_count'])
        if case['day_count']=='30/360us':
            first=min(a[2],30); last=30 if b[2]==31 and first==30 else b[2]
            numerator=(b[0]-a[0])*360+(b[1]-a[1])*30+last-first;denominator=360
            fields.update(first_day=first,last_day=last)
        else:
            if case['day_count'] not in ('actual/365f','actual/360'):raise ValueError('convention')
            numerator=ordinal(b)-ordinal(a);denominator=365 if case['day_count']=='actual/365f' else 360
        trace.emit('calendar',**fields,numerator=numerator,denominator=denominator)
        values.append(trace.operation(f'calendar/{row}','divide',float(numerator),float(denominator)))
    return values

def evaluate(case):
    trace=prior.Trace();times=fractions(case,trace)
    flows=[raw.from_bits(s) for s in case['flows']]
    if case['op']=='xirr': result=prior.solve(flows,times,trace)
    elif case['op']=='xnpv':
        rate=raw.from_bits(case['rate'])
        if not prior.finite(rate) or rate<=-1:result=dict(status='refused',code='CALC-TYPE-001')
        else:result=dict(status='returned',raw=prior.encoded(prior.cash_value(rate,flows,times,trace,'direct')))
    else:raise ValueError('op')
    if result['status']=='returned':result['reporting']=prior.reporting(result['raw']['bits'],case['places'])
    return dict(id=case['id'],op=case['op'],result=result,trace=trace.rows)
