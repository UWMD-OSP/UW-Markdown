"""Independent dictionary statements under ProtocolII.2/RFC0079/0099/0100.

The dictionary is normative data, not a copied starter pack. Every current bound
home is inspected; raw expressions quantize once at authored comparison precision.
"""
import re
from uwmd_binding_sources import finite
from uwmd_calc import evaluate_expression
from uwmd_calc_errors import CalcError, CalcUnavailable
from uwmd_expressions import ExpressionError
from uwmd_periods import PeriodError
from uwmd_numeric import quantize
from uwmd_spec_data import metric_dictionary
from uwmd_validation_selection import current_blocks, field


def _precision(token, value):
    if not isinstance(token,str) or re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?',token) is None:
        raise CalcError('CALC-TYPE-001','Original decimal numeric token is required')
    if float(token)!=value:
        raise CalcError('CALC-TYPE-001','Numeric token does not describe the current statement')
    coefficient,_,exponent=token.lower().partition('e')
    return max(0,len(coefficient.partition('.')[2])-int(exponent or 0))


def _pointer(path):
    return '/'+ '/'.join(part.replace('~','~0').replace('/','~1') for part in path.split('.'))


def dictionary_entries(asset_class):
    dictionary=metric_dictionary()
    return [entry for collection in ('calculations',)
            for entry in dictionary.get(collection,()) if asset_class in entry['asset_classes']]


def metric_value(document,entry,context=None):
    try:
        if entry['null_semantics']=='positive_size_denominator':
            # Only declared registered property/component sizes are governed by this
            # guard; ordinary signed operands retain their expression semantics.
            from uwmd_size_contract import SIZE_CONTRACT
            from uwmd_calc import _Inputs
            inputs=_Inputs(document,context or {},entry.get('section_roles',{}),{})
            for path in entry['input_paths']:
                section,_,tail=path.partition('.')
                if section in ('property','components') and tail in SIZE_CONTRACT.get(section,{}):
                    value=field(inputs.section(section),tail)
                    if finite(value) and value<0:
                        return None,'negative_size_denominator'
        value=evaluate_expression(entry['formula'],document,context=context,roles=entry.get('section_roles',{}))
        return (value,None) if finite(value) else (None,'missing_usable_inputs')
    except (CalcError,ExpressionError,PeriodError) as error:
        return None,error.code
    except CalcUnavailable as error:
        return None,str(error)


def verify_stated_metrics(document):
    asset_class=document.frontmatter.value.get('asset_class')
    dictionary=metric_dictionary()
    bindings=dictionary['statement_bindings']
    evidence=[]
    counts=dict(verified=0,failed=0,unverifiable=0)
    for entry in dictionary_entries(asset_class):
        identifier=entry['id']
        homes=[('quick_metrics.'+identifier,document.frontmatter.value,document.frontmatter.numbers,None)]
        paths=[section+'.'+identifier for section in bindings['output_sections']]
        paths.extend(bindings['aliases'].get(identifier,()))
        seen=set()
        for path in paths:
            if path in seen: continue
            seen.add(path)
            section,_,tail=path.partition('.')
            for block in current_blocks(document,section):
                variant=dict(block.attributes).get('variant')
                label=section+('['+variant+']' if variant is not None else '')+'.'+tail
                homes.append((label,block.parsed.value,block.parsed.numbers,(block,tail)))
        for path,payload,tokens,home in homes:
            local='quick_metrics.'+identifier if home is None else home[1]
            stated=field(payload,local)
            if not finite(stated): continue
            token=next((token.lexeme for token in tokens if token.pointer==_pointer(local)),None)
            s=_precision(token,stated)
            context={}
            # RFC0126 pins a land NOI statement's own current physical variant.
            if identifier=='land_carry_noi' and home is not None and home[0].section=='noi_model':
                # Bind every NOI operand to this exact physical current home,
                # including the unlabelled/component case. Missing stays null.
                context={'overrides':{path:field(home[0].parsed.value,path.partition('.')[2])
                         for path in entry['input_paths'] if path.startswith('noi_model.')}}
            value,reason=metric_value(document,entry,context)
            item=dict(id=identifier,path=path,stated=stated,stated_decimals=s,state='unverifiable',computed=None)
            if value is None:
                item['reason']=reason
            else:
                r=entry['round_to']
                d=0 if r is None else min(max(s,entry['minimum_stated_decimals']),r)
                computed=value if r is None else quantize(value,d)
                comparison=stated if r is None or s<=r else quantize(stated,r)
                item.update(computed=computed,comparison=comparison,comparison_decimals=d,
                            state='verified' if computed==comparison else 'failed')
            counts[item['state']]+=1
            evidence.append(item)
    return dict(rule_set=document.frontmatter.value['uw_version'],asset_class=asset_class,counts=counts,evidence=evidence)
