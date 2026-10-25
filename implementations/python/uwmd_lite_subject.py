"""Independent Lite financial subject admission for Receipt5.1 (no bridge/render claim)."""
import hashlib
import math
import re
from uwmd_frontmatter import parse_frontmatter,_scalar
from uwmd_jcs import canonicalize
from uwmd_source import SourceError


def lite_subject(raw):
    text=raw.decode('utf-8-sig').replace('\r\n','\n')
    lines=text.split('\n')
    if not lines or lines[0]!='---':raise SourceError('Lite frontmatter is required')
    end=lines.index('---',1)
    frontmatter=parse_frontmatter(('\n'.join(lines[1:end])+'\n').encode('utf8')).value
    if any(isinstance(value,(dict,list)) for value in frontmatter.values()):raise SourceError('Lite frontmatter admits scalars only')
    if frontmatter.get('uw_version')!='3.0' or frontmatter.get('uw_lite_version') not in ('1.0',1.0):raise SourceError('Explicit kept Format and Lite versions are required')
    fields=[];seen=set()
    for line in lines[end+1:]:
        if '<!--' not in line or 'uw:' not in line:continue
        match=re.fullmatch(r'[ \t]*[-*+][ \t]+(.+?):[ \t]+(.+?)[ \t]+<!--[ \t]*uw:([A-Za-z][A-Za-z0-9_.-]*)(.*?)[ \t]*-->[ \t]*',line)
        if not match:raise SourceError('Malformed anchored Lite field')
        label,display,path,attributes=match.groups()
        attrs={}
        for token in attributes.split():
            pair=re.fullmatch(r'([A-Za-z][A-Za-z0-9_-]*)=([^\s=]+)',token)
            if not pair or pair[1] in attrs:raise SourceError('Malformed or duplicate Lite attribute')
            attrs[pair[1]]=pair[2]
        identity=(path,attrs.get('period'),attrs.get('scenario'))
        if identity in seen:raise SourceError('Duplicate Lite field identity')
        seen.add(identity)
        value,unit=None,None
        number=display.replace(',','')
        numeric=r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?'
        if number.startswith('$') and re.fullmatch(numeric,number[1:]):value=float(number[1:]);unit='USD'
        elif number.endswith('%') and re.fullmatch(numeric,number[:-1]):
            coefficient,_,exponent=number[:-1].lower().partition('e')
            value=float(coefficient+'e'+str(int(exponent or 0)-2));unit='fraction'
        elif number.endswith('x') and re.fullmatch(numeric,number[:-1]):value=float(number[:-1]);unit='ratio'
        elif re.fullmatch(numeric,number):value=float(number)
        else:value=_scalar(display)[0]
        if isinstance(value,float) and not math.isfinite(value):raise SourceError('Nonfinite Lite value')
        fields.append(dict(path=path,value=value,unit=attrs.get('unit',unit),period=attrs.get('period'),scenario=attrs.get('scenario'),
                           attributes={k:v for k,v in attrs.items() if k not in ('unit','period','scenario')}))
    fields.sort(key=lambda field:tuple((field[key] or '').encode('utf-16-be') for key in ('path','period','scenario')))
    # RFC0017's preimage version denotes the representation. RFC0025 changes
    # the scaling procedure and subject canonicalization identity to1.1 while
    # explicitly retaining unaffected digests, so this preimage member stays1.0.
    preimage=canonicalize(dict(canonicalization='uw-lite-financial',version='1.0',fields=fields))
    return dict(digest='sha256:'+hashlib.sha256(preimage.encode('utf8')).hexdigest(),canonicalization_version='1.1',rule_set='3.0',frontmatter=frontmatter,fields=fields)
