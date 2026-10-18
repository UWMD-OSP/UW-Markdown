"""Freeze operands, not answers, for independent native/JS candidate comparison."""
from pathlib import Path
import argparse, hashlib, json, struct
HERE=Path(__file__).resolve().parent
LAB=HERE.parent

def bits(x): return struct.pack('>d',x).hex()
def build():
    cases=[]
    def add(op,x,y='0000000000000000',n=0,label=''):
        cases.append({'id':f'{len(cases):05d}-{label or op}','op':op,'x':x,'y':y,'n':n})
    words=['0000000000000000','8000000000000000','0000000000000001','0000000000100000',
      '000fffffffffffff','0010000000000000','0010000000000001','3fe0000000000000',
      '3fefffffffffffff','3ff0000000000000','3ff0000000000001','4000000000000000',
      'bff0000000000000','c000000000000000','7fefffffffffffff','ffefffffffffffff',
      '7ff0000000000000','fff0000000000000','7ff8000000000001']
    for x in words:
        for y in words: add('pow',x,y)
        for op in ['log','exp','sqrt','fabs']: add(op,x)
        for n in [-2147483648,-50001,-1075,-1074,-1022,-54,-1,0,1,54,1023,1074,50001,2147483647]: add('scalbn',x,n=n)
        for y in ['0000000000000000','8000000000000000']: add('copysign',x,y)
    for name in ['power-procedures','integer-dispatch']:
        data=json.loads((LAB/name/'inputs.json').read_text())
        for row in data['cases']: add('pow',row['x'],row['y'],label=name+'-'+row['id'])
    for x,y in [(2.0,-0.5),(1.2,31.0),(2.0,1.5)]: add('pow',bits(x),bits(y),label='accuracy-control')
    for op,centers in [('exp',[1.0,-745.0,-744.4400719213812,709.782712893384,0.0]),('log',[1.0,2.0,0.5]),('sqrt',[2.0])]:
        for center in centers:
            w=int(bits(center),16)
            for offset in range(-8,9):
                if 0<=w+offset<2**64: add(op,f'{w+offset:016x}',label='boundary')
    add('exp','3fd62e41ffffffff',label='accuracy-control')
    for i in range(512):
        digest=hashlib.sha256(b'UWMD0088-native-reference-v1'+i.to_bytes(4,'big')).hexdigest()
        x,y=digest[:16],digest[16:32]
        add('pow',x,y,label='sha256-operand')
        for op in ['log','exp','sqrt','fabs']: add(op,x,label='sha256-operand')
        add('scalbn',x,n=int(digest[32:40],16)%2201-1100,label='sha256-operand')
    for row in json.loads((LAB/'pinned-fdlibm'/'math-inputs.json').read_text())['cases']:
        add(row['op'],row['x'],row.get('y','0000000000000000'),row.get('n',0),label='independent-math-'+row['id'])
    return {'status':'UNACCEPTED frozen operands; no host pow/log/exp answers',
      'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':cases}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    text=json.dumps(build(),indent=2)+'\n';path=HERE/'inputs.json'
    if args.check:
        if path.read_text()!=text: raise SystemExit('Frozen operand mismatch')
        print('PASS frozen native-reference operands')
    else:
        path.write_text(text,encoding='utf-8',newline='\n');print('WROTE',len(json.loads(text)['cases']),'isolated operand records')
