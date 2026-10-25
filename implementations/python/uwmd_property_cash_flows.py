"""Independent ProtocolVIII.9.5/9.6 explicit projection and coverage assembly.

Only authored cash is copied. Coverage and zeros are assertions, not inferred
cash, source completeness, financing, reserve accounting or a projection model.
"""
import copy
import json
import re
from uwmd_binding_sources import finite,lease_source_issues,cash_source_issues
from uwmd_calc_errors import CalcError
from uwmd_cash_flows import verify_cash_flow_series
from uwmd_envelope import source_digest
from uwmd_lease_up import verify_lease_up_schedule,lease_up_context
from uwmd_numeric import calendar_date,quantize
from uwmd_spec_data import schema
from uwmd_validation_optional_shapes import _violations
from uwmd_validation_selection import current_blocks,is_externalized

OWNED=('rent','concessions','ti_lc')
PERIOD=('other_income','operating_expenses','other_capex','reserve_net')
CLOSING={'acquisition':('purchase_price','transaction_costs','reserve_net'),'disposition':('gross_sale','transaction_costs','reserve_net')}
ASSERTIONS=('cash_amounts_only','no_financing_or_investor_tax','no_overlapping_economic_amounts','reserve_spending_excluded','gross_sale_excludes_reserve_release','no_terminal_restricted_reserve','hold_only_and_exit_settled')

class AssemblyError(CalcError):
    def __init__(self,reason,pointer,message,evidence=None):
        super().__init__('CALC-CF-ASSEMBLY',message)
        self.reason,self.pointer,self.evidence=reason,pointer,evidence
    def projection(self):
        value=dict(category='calc',code=self.code,reason=self.reason,message=str(self),pointer=self.pointer)
        if self.evidence is not None:value['evidence']=self.evidence
        return value

class ProjectionError(CalcError):
    def __init__(self,pointer,message,evidence=None):
        super().__init__('CALC-LU-PROJECTION',message)
        self.pointer,self.evidence=pointer,evidence
    def projection(self):
        value=dict(category='calc',code=self.code,message=str(self),pointer=self.pointer)
        if self.evidence is not None:value['evidence']=self.evidence
        return value


def _source(document,section,variant):
    matches=[b for b in current_blocks(document,section,include_external=True) if dict(b.attributes).get('variant')==variant]
    if len(matches)!=1 or is_externalized(matches[0]):
        raise CalcError('CALC-PERIOD-003','Exact current source variant is unavailable')
    return matches[0]


def project_lease_up_cash_flows(document,plan):
    document,plan=copy.deepcopy((document,plan))
    spec=schema('lease-up-cash-flow-plan.schema.json')
    problems=_violations(plan,spec,spec,'plan')
    if problems:raise ProjectionError(problems[0]['field'],problems[0]['message'])
    try:block=_source(document,'lease_up_schedule',plan['source_variant'])
    except CalcError as error:raise ProjectionError('plan.source_variant',str(error),dict(selection=error.projection())) from error
    payload=block.parsed.value
    pointer='sections.lease_up_schedule['+json.dumps(plan['source_variant'])+']'
    structural=lease_source_issues(payload)
    if structural:raise ProjectionError(pointer,'Lease-up structure refuses: '+structural[0])
    verification=verify_lease_up_schedule(payload,lease_up_context(document))
    if verification['verdict']!='verified':raise ProjectionError(pointer,'Lease-up verification refuses',dict(verification=verification))
    mapping={}
    for index,entry in enumerate(plan['cash_dates']):
        period=entry['period']
        if period in mapping:raise ProjectionError('plan.cash_dates['+str(index)+']','Duplicate period mapping')
        mapping[period]=entry['date']
    periods=[row['period'] for row in payload['schedule']]
    if len(mapping)!=len(periods) or set(mapping)!=set(periods):raise ProjectionError('plan.cash_dates','Mapping must cover each source period exactly once')
    rows=[];bindings=[];previous=None
    for index,row in enumerate(payload['schedule']):
        path='lease_up_schedule.schedule@'+row['period']+'.net_cash_flow'
        amount=row.get('net_cash_flow');date=mapping[row['period']]
        if not finite(amount):raise ProjectionError(pointer+'.schedule['+str(index)+'].net_cash_flow','Explicit finite cash amount required')
        if previous is not None and date<previous:raise ProjectionError('plan.cash_dates','Cash dates must follow source period order')
        previous=date
        rows.append(dict(date=date,amount=amount,kind='other',label=path))
        bindings.append(dict(source_path=path,date=date,amount=amount))
    return dict(source_envelope_digest=source_digest(document),source_variant=plan['source_variant'],
                series=dict(label='Lease-up receipts and TI/LC only',day_count=plan['day_count'],series=rows),bindings=bindings)


def _bounds(period):
    year=int(period[:4]);tail=period[5:]
    month=3*(int(tail[1])-1)+1 if tail.startswith('Q') else int(tail)
    width=3 if tail.startswith('Q') else 1
    next_month=month+width;next_year=year
    if next_month>12:next_month-=12;next_year+=1
    return f'{year:04d}-{month:02d}-01',f'{next_year:04d}-{next_month:02d}-01'


def assemble_property_cash_flows(document,plan):
    document,plan=copy.deepcopy((document,plan))
    def refuse(reason,pointer,message,evidence=None):raise AssemblyError(reason,pointer,message,evidence)
    if not isinstance(plan,dict):refuse('plan','plan','Plan object required')
    spec=copy.deepcopy(schema('property-cash-flow-plan.schema.json'))
    # Economic assertions and denomination are evaluated at their specified
    # semantic stage after the closed transport/type shape, not as schema codes.
    spec['properties']['basis']={'type':'string'};spec['properties']['tax_basis']={'type':'string'}
    for key in ('currency_code',):spec['properties'][key]={'type':'string'}
    for group in ('lease_up','supplemental'):spec['properties'][group]['properties']['currency_code']={'type':'string'}
    assertions=spec['properties']['assertions']
    assertions['required']=[]
    assertions['properties']={key:{'type':'boolean'} for key in ASSERTIONS}
    problems=_violations(plan,spec,spec,'plan')
    if problems:
        problem=problems[0]
        pointer=problem['field']
        if problem['message']=='Member is outside the fixed closed object':pointer=pointer.rsplit('.',1)[0]
        refuse('plan',pointer,problem['message'])
    if plan['basis']!='unlevered' or plan['tax_basis']!='pre_tax':refuse('basis_currency','plan','Only unlevered pre-tax cash is admitted')
    currency=plan['currency_code']
    if re.fullmatch('[A-Z]{3}',currency) is None:refuse('basis_currency','plan.currency_code','Explicit uppercase currency required')
    for group in ('lease_up','supplemental'):
        if plan[group]['currency_code']!=currency:refuse('basis_currency','plan.'+group+'.currency_code','Source currency assertion differs')
    for key in ASSERTIONS:
        if plan['assertions'].get(key) is not True:refuse('coverage','plan.assertions.'+key,'Literal true economic assertion required')
    try:
        lease=_source(document,'lease_up_schedule',plan['lease_up']['source_variant'])
        supplemental=_source(document,'cash_flow_series',plan['supplemental']['source_variant'])
    except CalcError as error:refuse('selection','plan',str(error),dict(selection=error.projection()))
    lp='sections.lease_up_schedule['+json.dumps(plan['lease_up']['source_variant'])+']'
    sp='sections.cash_flow_series['+json.dumps(plan['supplemental']['source_variant'])+']'
    supplement=supplemental.parsed.value
    structural=cash_source_issues(supplement)
    if structural:refuse('structure',sp,structural[0])
    if supplement.get('day_count')!=plan['day_count']:refuse('basis_currency',sp+'.day_count','Supplemental day count must be explicitly identical')
    try:
        projection=project_lease_up_cash_flows(document,dict(source_variant=plan['lease_up']['source_variant'],day_count=plan['day_count'],cash_dates=plan['lease_up']['cash_dates']))
    except ProjectionError as error:refuse('verification','plan.lease_up',str(error),dict(lease_up=error.projection()))
    except (ValueError,TypeError,OverflowError,UnicodeError) as error:refuse('structure','sections','Source envelope cannot canonicalize: '+str(error))
    verification,checked=verify_cash_flow_series(supplement)
    if checked and verification['verdict']!='verified':refuse('verification',sp+'.stated_metrics','Supplemental metric verification refuses',dict(verification=verification))
    periods=[row['period'] for row in lease.parsed.value['schedule']]
    acquisition,disposition=plan['acquisition_date'],plan['disposition_date']
    first_start,first_end=_bounds(periods[0]);last_start,last_end=_bounds(periods[-1])
    final_ok=last_start<=disposition and (len(last_end)>10 or disposition<last_end) or plan.get('disposition_period_rule')=='allow_exclusive_end' and len(last_end)==10 and disposition==last_end
    if not (first_start<=acquisition and (len(first_end)>10 or acquisition<first_end)) or not acquisition<disposition or not final_ok:refuse('date_horizon','plan','Closing dates are outside admitted source periods')
    for index,row in enumerate(projection['series']['series']):
        if not acquisition<=row['date']<=disposition:refuse('date_horizon',lp+'.schedule['+str(index)+']','Lease-up cash date lies outside the hold')
    for index,row in enumerate(supplement['series']):
        if not acquisition<=row['date']<=disposition:refuse('date_horizon',sp+'.series['+str(index)+'].date','Supplemental cash date lies outside the hold')
    required=[(slot,category) for slot in ['acquisition',*periods,'disposition'] for category in (CLOSING[slot] if slot in CLOSING else PERIOD)]
    coverage={};row_cells={}
    for index,entry in enumerate(plan['coverage']):
        cell=(entry['slot'],entry['category']);pointer='plan.coverage['+str(index)+']'
        if cell not in required or cell in coverage:refuse('coverage',pointer,'Unknown, lease-up-owned or duplicate coverage cell')
        coverage[cell]=entry
        if 'zero' in entry:
            if not entry['zero'].strip():refuse('coverage',pointer+'.zero','Nonblank zero explanation required')
            if cell==('acquisition','purchase_price'):refuse('amount_sign',pointer,'Purchase cannot be declared zero')
        else:
            for row_index in entry['rows']:
                if not isinstance(row_index,(int,float)) or isinstance(row_index,bool) or row_index!=int(row_index) or not 0<=row_index<len(supplement['series']) or row_index in row_cells:
                    refuse('coverage',pointer+'.rows','Every supplemental row identity must be valid and used once')
                row_cells[int(row_index)]=cell
    if set(coverage)!=set(required) or len(row_cells)!=len(supplement['series']):refuse('coverage','plan.coverage','Every required cell and source row must be accounted for')
    for row_index,cell in row_cells.items():
        row=supplement['series'][row_index];slot,category=cell
        if slot in CLOSING and row['date']!=plan[slot+'_date']:refuse('date_horizon',sp+'.series['+str(row_index)+'].date','Closing-slot cash must occur on its closing date')
    for row_index,cell in row_cells.items():
        amount=supplement['series'][row_index]['amount'];category=cell[1]
        if (category=='purchase_price' and amount>=0 or category in ('gross_sale','other_income') and amount<0 or category in ('transaction_costs','operating_expenses','other_capex') and amount>0):
            refuse('amount_sign',sp+'.series['+str(row_index)+'].amount','Cash sign disagrees with declared category')
    ordered=[]
    for index,row in enumerate(projection['series']['series']):
        ordered.append((row['date'],0,index,row,'lease_up_schedule',plan['lease_up']['source_variant'],[dict(slot=periods[index],category=k) for k in OWNED]))
    for index,row in enumerate(supplement['series']):
        path='cash_flow_series.series['+str(index)+'].amount'
        slot,category=row_cells[index]
        ordered.append((row['date'],1,index,dict(date=row['date'],amount=row['amount'],kind='other',label=path),'cash_flow_series',plan['supplemental']['source_variant'],[dict(slot=slot,category=category)]))
    ordered.sort(key=lambda entry:entry[:3])
    bindings=[];output=[];cell_rows={};supplemental_outputs={}
    for date,kind,index,row,section,variant,cells in ordered:
        ordinal=len(output);output.append(row)
        bindings.append(dict(output_row_index=ordinal,source_section=section,source_variant=variant,source_path=row['label'],date=date,amount=row['amount'],cells=cells))
        if kind==1:supplemental_outputs[index]=ordinal
        for cell in cells:cell_rows.setdefault((cell['slot'],cell['category']),[]).append(ordinal)
    cell_evidence=[]
    for slot in ['acquisition',*periods,'disposition']:
        for category in (CLOSING[slot] if slot in CLOSING else (*OWNED,*PERIOD)):
            entry=dict(slot=slot,category=category)
            declared=coverage.get((slot,category),{})
            if 'zero' in declared:entry['zero']=declared['zero']
            else:entry['output_rows']=cell_rows[(slot,category)]
            cell_evidence.append(entry)
    result=dict(source_envelope_digest=projection['source_envelope_digest'],plan=plan,coverage='declared_complete',
                series=dict(label='Unlevered pre-tax property cash flow',day_count=plan['day_count'],series=output),bindings=bindings,cells=cell_evidence,
                source_verification=dict(lease_up='verified',supplemental_metrics='verified' if checked else 'not_stated'),net_sale_proceeds=dict(status='not_stated'))
    costs=coverage[('disposition','transaction_costs')].get('rows',[])
    if 'sale_deductions' in plan:
        deductions=[];seen=set()
        for index,deduction in enumerate(plan['sale_deductions']):
            pointer='plan.sale_deductions['+str(index)+']';row=int(deduction['row']);name=deduction['name']
            if name in ('prepayment_penalty','defeasance','loan_payoff'):refuse('sale_deduction',pointer+'.name','Financing deduction is outside unlevered scope')
            if row not in costs or row in seen:refuse('sale_deduction',pointer+'.row','Deduction must name each sale-cost row exactly once')
            seen.add(row)
            if name=='other' and not deduction.get('label','').strip() or name!='other' and 'label' in deduction:refuse('sale_deduction',pointer+'.label','Only other requires an explicit nonblank label')
            item=dict(output_row_index=supplemental_outputs[row],name=name,amount=supplement['series'][row]['amount'])
            if 'label' in deduction:item['label']=deduction['label']
            deductions.append(item)
        if seen!=set(costs):refuse('sale_deduction','plan.sale_deductions','All sale-cost rows must be named')
        result['sale_deductions']=deductions
    if 'net_sale_proceeds' in plan:
        gross=coverage[('disposition','gross_sale')].get('rows',[])
        if not gross:refuse('sale_deduction','plan.net_sale_proceeds','A gross-sale row is required')
        computed=0.0
        for index in sorted([*gross,*costs]):computed=computed+supplement['series'][int(index)]['amount']
        stated=plan['net_sale_proceeds']
        if quantize(computed,2)!=quantize(stated,2):refuse('sale_deduction','plan.net_sale_proceeds','Net sale proceeds disagree')
        result['net_sale_proceeds']=dict(status='verified',stated=stated,computed=computed)
    return result
