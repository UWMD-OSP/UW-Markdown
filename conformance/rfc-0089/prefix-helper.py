# Import/output-only adaptation of the retained independent closure helper.
import json,sys
from pathlib import Path
import xml.etree.ElementTree as ET
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'implementations/python'))
from uwmd_xml_names import ascii_prefixes
rows=[]
value='uw:value xmlns:uw= literal > &quot; &#0;'
for prefix in ['uw','n75_77','n6e_37_35_5f_37_37','\u037f','\U00010000','\U000effff']:
    source=f'<{prefix}:document xmlns:{prefix}="urn:synthetic" {prefix}:a="{value}" plain="&amp;#0; &#x75;w:value">{value}</{prefix}:document>'
    # Bare lexical &#0; is invalid; test exactly-once decoding with escaped ampersands.
    source=source.replace(' &#0;', ' &amp;#0;')
    transformed=ascii_prefixes(source)
    raw_value=source[source.index(' a='):] if ' a=' in source else None
    element=ET.fromstring(transformed)
    assert element.tag=='{urn:synthetic}document'
    assert element.attrib['{urn:synthetic}a']=='uw:value xmlns:uw= literal > " &#0;'
    assert element.attrib['plain']=='&#0; uw:value'
    assert element.text=='uw:value xmlns:uw= literal > " &#0;'
    rows.append(dict(prefix=ascii(prefix),quoted_values_and_text_preserved=True,passed=True))
(Path(sys.argv[1])/'closure-prefix-helper.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(dict(prefixes=len(rows),passed=True)))
