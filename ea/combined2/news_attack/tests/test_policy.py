#!/usr/bin/env python3
"""Executes the actual pure MQL policy after array-syntax adaptation to C++.
This is NOT a MetaEditor/MT5 compiler, broker execution, or financial backtest.
"""
from pathlib import Path
import re,subprocess,tempfile,argparse,hashlib,json
HERE=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--base',type=Path,default=HERE.parent);args=ap.parse_args();BASE=args.base
core=(BASE/'src/C2Core.mqh').read_text()
source=core+'\n'+(HERE/'src/C2NewsPolicy.mqh').read_text()
types='C2Bar|C2Pivot|C2Zone|C2Key|C2NewsItem'
cpp=re.sub(r'(const\s+)?('+types+r')\s*&\s*(\w+)\[\]',lambda m:('const ' if m[1] else '')+'std::vector<'+m[2]+'>& '+m[3],source)
cpp=re.sub(r'\b('+types+r'|double)\s+(\w+)\[\];',lambda m:'std::vector<'+m[1]+'> '+m[2]+';',cpp)
shim='''#include <vector>
#include <string>
#include <algorithm>
#include <iostream>
#include <cmath>
#include <cstdlib>
using string=std::string;
#define MathMin(a,b) ((a)<(b)?(a):(b))
#define MathMax(a,b) ((a)>(b)?(a):(b))
#define MathAbs(a) std::abs(a)
template<class T> int ArraySize(const std::vector<T>& a){return (int)a.size();}
template<class T> int ArrayResize(std::vector<T>& a,int n,int reserve=0){a.resize(n);return n;}
template<class T> void ArraySort(std::vector<T>& a){std::sort(a.begin(),a.end());}
template<class T> void ZeroMemory(T& a){a=T{};}
template<class T,int N> void ArrayInitialize(T (&a)[N],T value){std::fill(a,a+N,value);}
int passed=0;
void test(bool ok,const char* name){if(!ok){std::cerr<<"FAIL "<<name<<"\\n";std::exit(1);}passed++;std::cout<<"PASS "<<name<<"\\n";}
'''
harness=r'''
int main(){
 const long T=1790944200;const int pre=600,delay=120,end=900;int k=-1;
 std::vector<C2NewsItem> events{{1,T,T-3600,"USD HIGH FIXTURE"}};
 auto route=[&](long now,bool healthy=true){return C2NewsRoute(events,now,T-10000,T+10000,healthy,pre,delay,end,k);};
 test(route(T-601)==C2_NEWS_NORMAL,"Before pre-lock is normal");
 test(route(T-600)==C2_NEWS_LOCK,"Pre-lock starts inclusively");
 test(route(T-1)==C2_NEWS_LOCK,"One second before release blocked");
 test(route(T)==C2_NEWS_LOCK,"Release instant blocked");
 test(route(T+119)==C2_NEWS_LOCK,"Cooldown end minus one blocked");
 test(route(T+120)==C2_NEWS_ATTACK,"Attack opens at +2min");
 test(route(T+899)==C2_NEWS_ATTACK,"Final attack second accepted");
 test(route(T+900)==C2_NEWS_NORMAL,"+15min excluded from attack");
 test(route(T+121,false)==C2_NEWS_DATA_WAIT,"Unhealthy data always WAIT");
 test(C2NewsRoute(events,T+121,T,T+10000,true,pre,delay,end,k)==C2_NEWS_DATA_WAIT,"Insufficient lookback coverage rejected");
 test(C2NewsRoute(events,T+121,T-10000,T+121+pre,true,pre,delay,end,k)==C2_NEWS_DATA_WAIT,"Coverage ending at forward horizon rejected");
 events[0].known=T+1;test(route(T+121)==C2_NEWS_LATE,"Live event first seen after release cannot attack");events[0].known=T-3600;
 events.push_back({2,T,T+1,"SIMULTANEOUS FIXTURE"});test(route(T+121)==C2_NEWS_ATTACK&&events[k].id==1,"Simultaneous known release stays one group");
 events.push_back({3,T+300,T-3600,"SECOND RELEASE"});test(route(T+121)==C2_NEWS_LOCK,"Next event pre-lock overrides first attack");
 test(route(T+419)==C2_NEWS_LOCK,"Next event cooldown overrides first attack");
 test(route(T+420)==C2_NEWS_ATTACK&&events[k].id==3,"Latest release owns overlapping attack");
 events.resize(1);
 test(C2NewsNormalRange(events,T-1000,T-601,pre,end),"Normal candle wholly outside reserved window");
 test(!C2NewsNormalRange(events,T-1000,T-600,pre,end),"Normal cannot bypass lock at send time");
 test(!C2NewsNormalRange(events,T+600,T+1000,pre,end),"Normal retest cannot cross prior news episode");
 test(C2NewsNormalRange(events,T+900,T+1000,pre,end),"New normal candle after full episode allowed");
 test(!C2NewsNormalRange(events,T+1000,T+900,pre,end),"Future normal retest rejected");
 test(C2NewsTriggerTime(T+120,T+180,T+180,T+60,T,delay,end),"First eligible M1 retest closes at +3min");
 test(!C2NewsTriggerTime(T+60,T+120,T+120,T,T,delay,end),"Cooldown retest cannot enter at attack-open instant");
 test(!C2NewsTriggerTime(T+120,T+180,T+180,T-1,T,delay,end),"M1 CB1 must break after release");
 test(!C2NewsTriggerTime(T+120,T+180,T+180,T+121,T,delay,end),"CB1 break cannot come after retest start");
 test(!C2NewsTriggerTime(T+840,T+900,T+900,T+600,T,delay,end),"Retest close exactly at attack end rejected");
 test(!C2NewsTriggerTime(T+120,T+180,T+179,T+60,T,delay,end),"Forming retest cannot enter");
 C2Event c{};c.stage=C2_WAIT_RETEST;c.dir=1;c.cb=100;c.breakAt=T;c.known=T;
 test(C2NewsM5Policy(c,1,101,T+120,3600),"M5 same-direction confirmed break supports M1");
 test(!C2NewsM5Policy(c,-1,99,T+120,3600),"M5 opposite side rejected");
 test(!C2NewsM5Policy(c,1,100,T+120,3600),"M5 last close at CB1 is not beyond it");
 test(!C2NewsM5Policy(c,1,101,T+3601,3600),"M5 confirmation age expires");
 c.known=T+121;test(!C2NewsM5Policy(c,1,101,T+120,3600),"No future M5 pivot confirmation");c.known=T;
 c.breakAt=T+121;test(!C2NewsM5Policy(c,1,101,T+120,3600),"No future M5 break");c.breakAt=T;
 c.stage=C2_WAIT_BREAK;test(!C2NewsM5Policy(c,1,101,T+120,3600),"M5 unbroken CB1 rejected");
 c.stage=C2_EXPIRED;test(!C2NewsM5Policy(c,1,101,T+120,3600),"Expired M5 retest not reused");
 c.stage=C2_INVALID;test(!C2NewsM5Policy(c,1,101,T+120,3600),"Invalid M5 structure rejected");
 c.stage=C2_AMBIGUOUS;test(!C2NewsM5Policy(c,1,101,T+120,3600),"Ambiguous M5 structure rejected");
 c.stage=C2_VALID;c.dir=-1;test(C2NewsM5Policy(c,-1,99,T+120,3600),"SELL mirrored confirmation");
 std::vector<C2NewsItem> empty;
 test(C2NewsRoute(empty,T,T-10000,T+10000,true,pre,delay,end,k)==C2_NEWS_NORMAL,"Verified empty calendar is normal, not fabricated news");
 test(C2NewsRoute(empty,T,0,0,false,pre,delay,end,k)==C2_NEWS_DATA_WAIT,"Missing calendar is not a news-free calendar");
 // Exhaustively compare second-level boundaries against the simple single-event definition.
 for(long now=T-1200;now<T+2000;now++){
  int expected=now<T-pre||now>=T+end?C2_NEWS_NORMAL:now<T+delay?C2_NEWS_LOCK:C2_NEWS_ATTACK;
  if(route(now)!=expected)return 2;
 }
 test(true,"3200 second-level boundary checks");
 std::cout<<"POLICY_TESTS "<<passed<<"\n";
}
'''
with tempfile.TemporaryDirectory() as temp:
 path=Path(temp);(path/'policy.cpp').write_text(shim+cpp+harness)
 subprocess.run(['g++','-std=c++17','-O2',str(path/'policy.cpp'),'-o',str(path/'test')],check=True,capture_output=True,text=True)
 result=subprocess.run([str(path/'test')],check=True,capture_output=True,text=True).stdout
print(result,end='')
ea=(HERE/'dist/CEBONK_COMBINED2_NEWS_ATTACK_v1.10.mq5').read_text();old=(BASE/'src/CEBONK_COMBINED2.mq5').read_text()
def function(s,name):
 start=re.search(r'\b(?:bool|void|long|int|double|string)\s+'+name+r'\s*\(',s).start();a=s.index('{',start);depth=0
 for i in range(a,len(s)):
  if s[i]=='{':depth+=1
  elif s[i]=='}':
   depth-=1
   if depth==0:return s[start:i+1]
 raise AssertionError(name)
for name in ['Prepare','AstrologyMatches','Location','LoadBars','ParseSchedule','C2Musang','C2Zones','C2Select']:
 orig=old if name in ['Prepare','AstrologyMatches','Location','LoadBars','ParseSchedule'] else core
 assert function(ea,name)==function(orig,name),name+' drift'
assert core in ea
assert 'long clock=(long)TimeTradeServer()' in ea
assert 'NowUTC()-exported>InpNewsMaxCacheSeconds' in ea
assert ea.count('OrderSend(')==1
assert ea.index('if(news)ReserveNews(release)')<ea.index('bool sent=OrderSend')
for required in ['InpRunMode=C2_NORMAL_AND_NEWS','InpExecutionTF=PERIOD_M5','InpFixedLot=0.01','InpMaxSpreadPoints=70','InpAutopilot=false','InpAllowRealAccount=false','InpAcceptExperimentalAstro=false','NEWS_EVENT_ALREADY_ATTEMPTED','if(!gTester)GlobalVariablesFlush();','if(gTester)NewsHeartbeat();','CALENDAR_IMPORTANCE_HIGH','CALENDAR_TIMEMODE_DATETIME','"USD"','NetworkSlot()','parse_mode']:
 assert required in ea,required
for prohibited in ['iMA(','iATR(','GetActualValue(','GetForecastValue(','PositionModify(','PositionClosePartial(','InpManualAstro']:
 assert prohibited not in ea,prohibited
# Calendar calls stay out of tick execution and asynchronous deal notification.
for fn in ['OnTick','EvaluateBar','EvaluateMode','Prepare','OnTradeTransaction']:
 f=function(ea,fn);assert 'WebRequest(' not in f and 'CalendarValueHistory(' not in f,fn
# Lexical delimiter check after removing comments and strings (not a compiler).
lex=re.sub(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '',ea)
stack=[]
for ch in lex:
 if ch in '({[':stack.append(ch)
 elif ch in ')}]':assert stack and '({['[')}]'.index(ch)]==stack.pop()
assert not stack
assert (HERE/'dist/CEBONK_COMBINED2_NEWS_ATTACK_v1.10.mq5').read_bytes()==(HERE/'dist/CEBONK_COMBINED2_NEWS_ATTACK_v1.10.txt').read_bytes()
print('PASS original normal price/SL/risk/Astrology functions byte-identical; separate routing, protected single order path, UTF8/TXT identity and source guards.')
report={'version':'1.10','policy_tests':41,'second_level_boundary_checks':3200,'normal_core_preserved':True,'source_wiring':'PASS','metaeditor_compile':'NOT_RUN','mt5_backtest':'NOT_RUN','broker_execution':'NOT_RUN','telegram_delivery':'NOT_TESTED_WITH_REAL_CREDENTIALS','profitability':'NOT_ESTABLISHED'}
(HERE/'dist/VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
