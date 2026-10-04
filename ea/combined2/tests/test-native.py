#!/usr/bin/env python3
"""Compiles a syntax-adapted pure price core as C++, NOT an MT5/MetaEditor compile.
Runs differential tests versus repository JS. No financial performance claim.
"""
from pathlib import Path
import json, math, random, re, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[3]
HERE=ROOT/'ea/combined2'
source=(HERE/'src/C2Core.mqh').read_text()
cpp=re.sub(r'(const\s+)?(C2Bar|C2Pivot|C2Zone|C2Key)\s*&\s*(\w+)\[\]',lambda m:('const ' if m[1] else '')+'std::vector<'+m[2]+'>& '+m[3],source)
cpp=re.sub(r'\b(C2Bar|C2Pivot|C2Zone|C2Key|double)\s+(\w+)\[\];',lambda m:'std::vector<'+m[1]+'> '+m[2]+';',cpp)
shim=r'''#include <vector>
#include <algorithm>
#include <iostream>
#include <iomanip>
#include <cmath>
#define MathMin(a,b) ((a)<(b)?(a):(b))
#define MathMax(a,b) ((a)>(b)?(a):(b))
#define MathAbs(a) std::abs(a)
template<class T> int ArraySize(const std::vector<T>& a){return (int)a.size();}
template<class T> int ArrayResize(std::vector<T>& a,int n,int reserve=0){a.resize(n);return n;}
template<class T> void ArraySort(std::vector<T>& a){std::sort(a.begin(),a.end());}
template<class T> void ZeroMemory(T& a){a=T{};}
template<class T,int N> void ArrayInitialize(T (&a)[N],T value){std::fill(a,a+N,value);}
'''
harness=r'''
int main(){std::cout<<std::setprecision(17);char mode;int step,n;long now;
 while(std::cin>>mode>>step>>now>>n){std::vector<C2Bar>b(n);for(auto &x:b)std::cin>>x.time>>x.end>>x.open>>x.high>>x.low>>x.close;
 if(mode=='M'){C2Event r{};C2Musang(b,step,now,r);std::cout<<r.stage<<' '<<r.dir<<' '<<r.known<<' '<<r.cb<<' '<<r.low<<' '<<r.high<<' '<<r.fib0<<' '<<r.fib100<<' '<<r.sl<<' '<<r.entry<<' '<<r.tp1<<' '<<r.tp2<<' '<<r.tp3<<' '<<r.eventStart<<' '<<r.eventEnd<<' '<<r.expires<<'\n';}
 else {std::vector<C2Zone>z;C2Zones(b,step,z);std::cout<<z.size();for(auto &x:z)std::cout<<' '<<x.tf<<' '<<x.dir<<' '<<x.kind<<' '<<x.status<<' '<<x.tests<<' '<<x.origin<<' '<<x.born<<' '<<x.departed<<' '<<x.low<<' '<<x.high<<' '<<x.scale;std::cout<<'\n';}
 }
}
'''
oracle=r'''const A=require(process.argv[2]+'/assets/auto-combined-core.js');const readline=require('node:readline');
readline.createInterface({input:process.stdin}).on('line',s=>{const v=JSON.parse(s),b=v.b.map(x=>({ms:x[0]*1000,end:x[1]*1000,open:x[2],high:x[3],low:x[4],close:x[5]}));
const r=v.mode==='M'?A.musang(b,{60:'M1',300:'M5',900:'M15'}[v.step],v.now*1000):A.zones(b,['MN1','W1','D1','H4','H1'][v.step],v.now*1000);console.log(JSON.stringify(r));});'''
T=1790942400
raw=[[110,111,109,110.5],[111,112,110,111.5],[112,114,111,113],[113,115,112,114],[112,113,111,111.5],[111,112,110,110.5],[110,111,109,110],[111,113,110,112],[112,114,111,113],[114,115,113,114.5],[115,117,114,116],[116,116.5,112,113],[113,114,111,112],[112,113,109.5,110],[110,111,107,108],[108,115.5,107.5,114]]
def bars(values,step=300):return [[T+i*step,T+(i+1)*step,*x] for i,x in enumerate(values)]
cases=[]
for step in [60,300,900]:
 for values in [raw,[[230-o,230-l,230-h,230-c] for o,h,l,c in raw]]:
  for n in range(6,len(values)+1):
   b=bars(values[:n],step);cases.append(dict(mode='M',step=step,now=b[-1][1]+1,b=b))
  b=bars(values,step);cases.append(dict(mode='M',step=step,now=b[-1][1]+step,b=b))
  gap=b[:12]+b[13:];cases.append(dict(mode='M',step=step,now=b[-1][1]+1,b=gap))
rng=random.Random(220202)
for _ in range(120):
 v=[];p=4100
 for i in range(rng.randint(35,130)):
  o=p;p+=rng.uniform(-5,5);h=max(o,p)+rng.random()*2;l=min(o,p)-rng.random()*2;v.append([o,h,l,p])
 b=bars(v);cases.append(dict(mode='M',step=300,now=b[-1][1]+1,b=b))
 h=bars(v,3600);cases.append(dict(mode='Z',step=4,now=h[-1][1]+1,b=h))
# Deliberate displacement origins, prefix invariance, broken/tested and gap branches.
for mirror in [False,True]:
 v=[[105,106+(i%2)*.1,104,105] for i in range(70)]
 v[22]=[101,105,98,102];v[23]=[103,110,102,109];v[24]=[109,112,108,111]
 for i in range(25,70):v[i]=[110,113+(i%3)*.1,109,112]
 v[49]=[102,103,98.5,102];v[60]=[100,102,96,97]
 if mirror:v=[[220-o,220-l,220-h,220-c] for o,h,l,c in v]
 for n in [30,45,50,61,70]:
  b=bars(v[:n],3600);cases.append(dict(mode='Z',step=4,now=b[-1][1]+1,b=b))
  gap=b[:27]+b[28:];cases.append(dict(mode='Z',step=4,now=b[-1][1]+1,b=gap))
stages={'NO_SETUP':0,'WAIT_CB1_BREAK':1,'WAIT_RETEST':2,'RETEST_VALID':3,'EXPIRED':4,'INVALID':5,'AMBIGUOUS':6,'DATA_GAP':7,'EARLY_BREAK':8,'CONFLICT':9}
def close(a,b,label):assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-8),(label,a,b)
with tempfile.TemporaryDirectory() as temp:
 temp=Path(temp);(temp/'core.cpp').write_text(shim+cpp+harness);(temp/'oracle.cjs').write_text(oracle)
 subprocess.run(['g++','-std=c++17','-O2','-Wall','-Wextra',str(temp/'core.cpp'),'-o',str(temp/'core')],check=True,capture_output=True)
 stdin=''.join(f"{c['mode']} {c['step']} {c['now']} {len(c['b'])}\n"+'\n'.join(' '.join(map(str,b)) for b in c['b'])+'\n' for c in cases)
 native=subprocess.run([str(temp/'core')],input=stdin,text=True,capture_output=True,check=True).stdout.splitlines()
 expected=subprocess.run(['node',str(temp/'oracle.cjs'),str(ROOT)],input='\n'.join(json.dumps(c) for c in cases)+'\n',text=True,capture_output=True,check=True).stdout.splitlines()
 assert len(native)==len(cases)==len(expected)
 valid=0;zones=0
 for number,(case,line,js) in enumerate(zip(cases,native,expected)):
  out=list(map(float,line.split()));ref=json.loads(js)
  if case['mode']=='M':
   assert out[0]==stages[ref['stage']],(number,ref['stage'],out[0]);s=ref.get('setup')
   if not s:continue
   close(out[1],1 if s['direction']=='BUY' else -1,'direction');close(out[2],s['knownAt']/1000,'known')
   for at,key in [(3,'cb1'),(6,'fib0'),(8,'sl')]:close(out[at],s[key],key)
   close(out[4],s['zone']['low'],'low');close(out[5],s['zone']['high'],'high')
   if ref['stage']=='RETEST_VALID':valid+=1
   if 'entry' in ref:
    for at,key in [(7,'fib100'),(9,'entry')]:close(out[at],ref[key],key)
    for j,tp in enumerate(ref['targets']):close(out[10+j],tp['price'],'tp')
    for at,key in [(13,'eventStart'),(14,'eventAt'),(15,'expiresAt')]:close(out[at],ref[key]/1000,key)
  else:
   assert int(out[0])==len(ref),(number,int(out[0]),len(ref));zones+=len(ref)
   actual=[out[1+i*11:1+(i+1)*11] for i in range(len(ref))]
   lookup={(z['kind'],z['originMs']/1000):z for z in ref}
   for a in actual:
    kind=('DEMAND' if a[1]==1 else 'SUPPLY') if a[2]==1 else ('SUPPORT' if a[1]==1 else 'RESISTANCE')
    r=lookup[(kind,a[5])]
    assert a[3]=={'FRESH':0,'TESTED':1,'BROKEN':2,'DATA_GAP':3}[r['status']]
    for at,val in [(4,r['tests']),(6,r['bornAt']/1000),(7,r['departedAt']/1000),(8,r['low']),(9,r['high']),(10,r['scale'])]:close(a[at],val,'zone')
 assert valid>=2 and zones>0
print(f'PASS differential: {len(cases)} synthetic cases; {valid} live observations; {zones} zone records match JS. NOT MT5 compile/backtest.')
# Source wiring guards: do not accidentally wire legacy C1 or unprotected orders.
ea=(HERE/'src/CEBONK_COMBINED2.mq5').read_text()
for text in ['InpExecutionTF=PERIOD_M5','InpAutopilot=false','InpFixedLot=0.01','InpMaxSpreadPoints=70','InpMagic=220202','C2_MODEL','if(gTester||InpAstroSource==C2_ASTRO_LOCAL_CSV)','OrderCheck(req,check)','GlobalVariablesFlush()','s.eventStart<gArmedAt','DEAL_ENTRY_IN','DEAL_REASON_TP','req.sl=sl','req.tp=tp']:
 assert text in ea,text
for forbidden in ['iMA(','iATR(','PositionModify(','PositionClosePartial(','InpManualAstro','/astro-signal']:
 assert forbidden not in ea,forbidden
assert ea.count('OrderSend(')==1
print('PASS source wiring/defaults/protected order guards. MetaEditor compile still required.')
