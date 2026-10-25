"""Independent Receipt5/10 preflights, authenticate-first order and RFC0123 dictionary results.

No starter pack, signature backend, registry lookup or reference process is loaded.
Callers may supply a signature verifier and explicit held-input digests. The
independent engine identity remains truthful and never impersonates @uwmd/verify.
"""
import copy
import hashlib
from uwmd_calc import evaluate_expression
from uwmd_calc_errors import CalcError,CalcUnavailable
from uwmd_binding_sources import finite
from uwmd_envelope import source_digest
from uwmd_expressions import ExpressionError,parse_expression,expression_references
from uwmd_jcs import canonicalize
from uwmd_lite_subject import lite_subject
from uwmd_metrics import metric_value
from uwmd_numeric import quantize
from uwmd_periods import PeriodError
from uwmd_reader import parse
from uwmd_spec_data import schema,metric_dictionary
from uwmd_validation_optional_shapes import _violations
from uwmd_verifier_common import finding

ENGINE='org.uwmd.python'
ENGINE_VERSION='0.0.0-dev'

class ReceiptError(ValueError):
    code='RCP_MALFORMED'
    def projection(self):return dict(code=self.code,message=str(self))


def _hash(value):return 'sha256:'+hashlib.sha256(canonicalize(value).encode('utf8')).hexdigest()


def verify_receipt(receipt,raw,*,filename=None,inputs=None,signature_verifier=None,engine=ENGINE,engine_version=ENGINE_VERSION):
    receipt=copy.deepcopy(receipt)
    spec=schema('uw-receipt.schema.json')
    problems=_violations(receipt,spec,spec)
    if problems:raise ReceiptError(problems[0]['field']+': '+problems[0]['message'])
    seen=set()
    for item in receipt.get('inputs_provenance',[]):
        if item['document_id'] in seen:raise ReceiptError('Duplicate referenced input identity')
        seen.add(item['document_id'])
    def report(verdict,issues,**extra):return dict(verdict=verdict,issues=issues,**extra)
    def issue(code,message,**extra):return finding(code,'indeterminate' if code in ('RCP-05','RCP-06','RCP-07','RCP-08','RCP-09','RCP-10','RCP-11') else 'failure',message,**extra)
    try:
        if receipt['subject']['representation']=='uw-lite-markdown':
            subject=lite_subject(raw);digest=subject['digest'];version='1.1';rule='3.0';document=None
        else:
            document=parse(raw,filename=filename,require_structured=True)
            digest=source_digest(document);version='2.0';rule=document.frontmatter.value['uw_version']
    except (ValueError,TypeError,UnicodeError,OverflowError) as error:
        return report('unverifiable',[issue('RCP-09','Record cannot canonicalize: '+str(error))])
    base=dict(rule_set=rule)
    if digest!=receipt['subject']['digest']:
        code='RCP-10' if version!=receipt['subject']['canonicalization_version'] else 'RCP-01'
        return report('unverifiable' if code=='RCP-10' else 'failed',[issue(code,'Subject digest differs')],**base)
    held=inputs or {};unavailable=[];mismatches=[]
    for item in receipt.get('inputs_provenance',[]):
        identifier=item['document_id']
        actual=held.get(identifier) if item['source'] in ('market_data','child_record') else None
        if actual is None:unavailable.append(issue('RCP-11','Referenced input unavailable: '+identifier))
        elif actual!=item['digest']:mismatches.append(issue('RCP-12','Referenced input digest differs: '+identifier))
    if mismatches:return report('failed',mismatches,**base)
    computation=receipt['computation']
    if computation['rule_set']!=rule:return report('failed',[issue('RCP-13','Receipt names another rule set')],**base)
    pack=[issue('RCP-05','Named starter-pack output coverage is unavailable')]
    signature=receipt.get('signature')
    if unavailable or signature is not None and signature_verifier is None:
        return report('unverifiable',[*unavailable,*pack,*([issue('RCP-08','No signature backend')] if signature is not None and signature_verifier is None else [])],**base)
    if signature is not None:
        signed=copy.deepcopy(receipt);signed['signature']=None
        try:payload=canonicalize(signed)
        except (ValueError,UnicodeError):return report('failed',[issue('RCP-01','Malformed signing payload')],**base)
        if not signature_verifier(signature,payload):return report('failed',[issue('RCP-01','Signature did not authenticate')],**base)
    recomputed=[];disagreements=[]
    # Lite compilation belongs to an optional representation profile. Its
    # canonical subject can still decide digest/input/authentication findings.
    entries={e['id']:e for e in metric_dictionary()['calculations'] if document.frontmatter.value.get('asset_class') in e['asset_classes']} if document else {}
    cache={};visiting=set()
    def compute(identifier):
        if identifier in cache:return cache[identifier]
        if identifier in visiting:raise CalcError('CALC-RESOLVE-001','Cyclic dictionary dependency')
        visiting.add(identifier);entry=entries[identifier];prior={}
        for ref in expression_references(parse_expression(entry['formula'])):
            if ref.head in entries and ref.head!=identifier:
                prior[ref.head]=compute(ref.head)
        # Positive-size admission is a dictionary prerequisite, separate from
        # typed expression refusal. No negative size can produce a positive claim.
        guard,reason=metric_value(document,entry)
        if reason=='negative_size_denominator':value=None
        else:value=evaluate_expression(entry['formula'],document,roles=entry.get('section_roles',{}),prior_results=prior)
        if value is not None and not finite(value):raise CalcError('CALC-TYPE-001','Dictionary result is not finite')
        visiting.remove(identifier);cache[identifier]=value
        return value
    try:
        for stated in computation['results']:
            identifier=stated['calc_id']
            if identifier not in entries:continue
            entry=entries[identifier];raw_value=compute(identifier)
            value=raw_value if raw_value is None or entry['round_to'] is None else quantize(raw_value,entry['round_to'])
            current=dict(calc_id=identifier,value=value,computed=value is not None,unit=entry['unit'])
            recomputed.append(current)
            if (type(value)!=type(stated['value']) and not (finite(value) and finite(stated['value'])) or value!=stated['value'] or current['computed']!=stated['computed'] or current.get('unit')!=stated.get('unit')):
                disagreements.append(issue('RCP-03','Stated dictionary result disagrees',calc_id=identifier))
    except (CalcError,ExpressionError,PeriodError,CalcUnavailable) as error:
        return report('failed',[issue('RCP-03','Dictionary computation refused: '+str(error))],recomputed=[],**base)
    recomputed.sort(key=lambda item:item['calc_id'].encode('utf-16-be'))
    if disagreements:
        different=(engine,engine_version)!=(computation['engine'],computation['engine_version'])
        return report('unverifiable' if different else 'failed',([issue('RCP-07','Issuing engine identity differs')] if different else [])+disagreements,recomputed=recomputed,**base)
    try:valid_digest=_hash(computation['results'])==computation['results_digest']
    except ValueError:valid_digest=False
    if not valid_digest:return report('failed',[issue('RCP-04','Result digest differs')],recomputed=recomputed,**base)
    return report('unverifiable',pack,recomputed=recomputed,**base)
