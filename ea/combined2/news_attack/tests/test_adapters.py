#!/usr/bin/env python3
"""Actual CSV/dedup/escaping functions in a mocked C++ environment; not MT5 runtime."""
from pathlib import Path
import argparse,re,subprocess,tempfile,json
H=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--base',type=Path,default=H.parent);a=p.parse_args()
news=(H/'src/C2News.mqh').read_text();tg=(H/'src/C2Telegram.mqh').read_text();base=(a.base/'src/CEBONK_COMBINED2.mq5').read_text()
def fn(source,name):
 start=re.search(r'\b(?:bool|void|int|string)\s+'+name+r'\(',source).start();i=source.index('{',start);depth=0
 # tokenize strings/comments so a JSON brace does not end a function
 pattern=re.compile(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/|[{}]')
 for m in pattern.finditer(source,i):
  if m[0]=='{':depth+=1
  elif m[0]=='}':
   depth-=1
   if depth==0:return source[start:m.end()]
 raise AssertionError(name)
src='\n'.join([fn(base,'DigitsOnly'),fn(base,'Q'),fn(news,'NewsValueID'),fn(news,'NewsSort'),fn(news,'NewsCSV'),fn(news,'NewsUsed'),fn(news,'ReserveNews'),fn(tg,'Html'),fn(tg,'RetryAfter')])
src=re.sub(r'(const\s+)?(C2NewsItem|string)\s*&\s*(\w+)\[\]',lambda m:('const ' if m[1] else '')+'std::vector<'+m[2]+'>& '+m[3],src)
src=re.sub(r'\b(C2NewsItem|string)\s+(\w+)\[\];',lambda m:'std::vector<'+m[1]+'> '+m[2]+';',src)
src=src.replace('(string)release','std::to_string(release)').replace('(string)gNews[i].id','std::to_string(gNews[i].id)')
assert '(string)' not in src
shim=r'''
#include <algorithm>
#include <string>
#include <vector>
#include <unordered_map>
#include <sstream>
#include <iostream>
#include <climits>
#include <cctype>
#include <cstdio>
#include <cstdlib>
using string=std::string;using ushort=unsigned short;
#define MathMin(a,b) ((a)<(b)?(a):(b))
#define MathMax(a,b) ((a)>(b)?(a):(b))
const int FILE_READ=1,FILE_TXT=2,FILE_ANSI=4,FILE_SHARE_READ=8,FILE_COMMON=16,CP_UTF8=65001,INVALID_HANDLE=-1;
struct C2NewsItem {ulong id;long utc,known;string name;};
std::vector<C2NewsItem> gNews;std::vector<long>gNewsAttempted;std::vector<ulong>gNewsAttemptIDs;
long gNewsFrom=0,gNewsTo=0,gNewsUpdated=0,mockNow=1790944200;
bool gTester=true,InpAllowNewsCSVReplay=true,InpCSVCommonFolder=false,gNewsOK=false;
string gNewsError,InpNewsCSV="test.csv",gScope="scope.",fileText;size_t fp=0;
std::unordered_map<string,double>globals;int flushes=0;const int InpNewsMaxCacheSeconds=180;
long NowUTC(){return mockNow;}
int StringLen(const string&s){return (int)s.size();}
ushort StringGetCharacter(const string&s,int i){return (unsigned char)s.at(i);}
string ShortToString(ushort c){return string(1,(char)c);}
string StringSubstr(const string&s,int p,int count=-1){return s.substr(p,count<0?string::npos:count);}
int StringFind(const string&s,const string&q,int p=0){auto i=s.find(q,p);return i==string::npos?-1:(int)i;}
long StringToInteger(const string&s){try{return std::stol(s);}catch(...){return 0;}}
string StringFormat(const char*fmt,int c){char s[64];snprintf(s,64,fmt,c);return s;}
void StringReplace(string&s,const string&a,const string&b){size_t p=0;while((p=s.find(a,p))!=string::npos){s.replace(p,a.size(),b);p+=b.size();}}
void StringTrimRight(string&s){while(!s.empty()&&std::isspace((unsigned char)s.back()))s.pop_back();}
int StringSplit(const string&s,int ch,std::vector<string>&v){v.clear();size_t a=0,p;while((p=s.find((char)ch,a))!=string::npos){v.push_back(s.substr(a,p-a));a=p+1;}v.push_back(s.substr(a));return (int)v.size();}
template<class T>int ArraySize(const std::vector<T>&v){return (int)v.size();}
template<class T>int ArrayResize(std::vector<T>&v,int n){v.resize(n);return n;}
int FileOpen(string,int,int,int){fp=0;return 1;}void FileClose(int){}
size_t FileSize(int){return fileText.size();}
bool FileIsEnding(int){return fp>=fileText.size();}
string FileReadString(int){if(fp>=fileText.size())return "";size_t p=fileText.find('\n',fp);if(p==string::npos)p=fileText.size();string r=fileText.substr(fp,p-fp);fp=p+1;return r;}
void NewsStatus(bool ok,const string&error){gNewsOK=ok;gNewsError=error;}
bool GlobalVariableCheck(const string&s){return globals.count(s)>0;}
void GlobalVariableSet(const string&s,double v){globals[s]=v;}
void GlobalVariablesFlush(){flushes++;}
int passed=0;void check(bool b,const char*s){if(!b){std::cerr<<"FAIL "<<s<<"\n";exit(1);}std::cout<<"PASS "<<s<<"\n";passed++;}
'''
harness=r'''
string csv(string rows,int count=1){return "CEBONK_NEWS_V1,1790900000,1791000000,1790940000,"+std::to_string(count)+"\nvalue_id,release_epoch,currency,importance,name\n"+rows;}
int main(){
 ulong id;check(NewsValueID("18446744073709551615",id)&&id==ULONG_MAX,"Full unsigned ID accepted");
 check(!NewsValueID("18446744073709551616",id),"Unsigned overflow rejected");
 check(!NewsValueID("0",id)&&!NewsValueID("-1",id)&&!NewsValueID("1x",id),"Zero negative malformed IDs rejected");
 fileText=csv("1,1790944200,USD,HIGH,Test fixture\n");check(NewsCSV()&&gNews.size()==1&&gNews[0].known==0,"Explicit retrospective CSV replay accepted");
 InpAllowNewsCSVReplay=false;check(!NewsCSV()&&gNewsError=="TESTER_REQUIRES_EXPLICIT_NEWS_CSV_REPLAY","Tester replay consent required");InpAllowNewsCSVReplay=true;
 fileText=csv("1,1790944200,EUR,HIGH,Test\n");check(!NewsCSV(),"Wrong currency rejected");
 fileText=csv("1,1790944200,USD,LOW,Test\n");check(!NewsCSV(),"Wrong importance rejected");
 fileText=csv("1,1790944200,USD,HIGH,Test\n",2);check(!NewsCSV(),"Truncated CSV count rejected");
 fileText=csv("1,1790944200,USD,HIGH,Test\n1,1790944300,USD,HIGH,Test\n",2);check(!NewsCSV(),"Duplicate news IDs rejected");
 fileText=csv("2,1790944800,USD,HIGH,Second\n1,1790944200,USD,HIGH,First\n",2);check(NewsCSV()&&gNews[0].id==1,"Chronological sorting independent of file order");
 fileText=csv("1,1791100000,USD,HIGH,Outside\n");check(!NewsCSV(),"Event outside coverage rejected");
 fileText="CEBONK_NEWS_V1,0,0,0,0\nvalue_id,release_epoch,currency,importance,name\n";check(!NewsCSV(),"Packaged placeholder fails closed");
 fileText="";check(!NewsCSV(),"Empty file not treated as no events");
 fileText=csv("",0);check(NewsCSV()&&gNews.empty(),"Verified zero-row coverage accepted");
 fileText=csv("1,1790944200,USD,HIGH,Test\n");gTester=false;mockNow=1790940001;check(NewsCSV()&&gNews[0].known==1790940000,"Live CSV retains export observation time");
 mockNow=1790940180;check(NewsCSV(),"Live snapshot valid at cache limit");mockNow++;check(!NewsCSV(),"Repeated reads cannot refresh stale live CSV");
 mockNow=1790930000;check(!NewsCSV(),"Future-dated live snapshot rejected");mockNow=1790944200;
 gNews={{1,1790944200,0,"a"},{2,1790944200,0,"b"},{3,1790944800,0,"c"}};
 check(!NewsUsed(1790944200),"New event has no attempt");ReserveNews(1790944200);
 check(NewsUsed(1790944200)&&flushes==1,"Group reserved and flushed once before send");
 check(globals.count("scope.NEWS.I.1")&&globals.count("scope.NEWS.I.2"),"All simultaneous IDs reserved");
 check(!NewsUsed(1790944800),"Distinct later event still eligible");
 gNewsAttempted.clear();gNewsAttemptIDs.clear();check(NewsUsed(1790944200),"Restart retains group cap");
 gNews[0].utc=1790949000;check(NewsUsed(1790949000),"Rescheduled stable ID cannot trade again");
 gTester=true;gNewsAttempted.clear();gNewsAttemptIDs.clear();check(!NewsUsed(1790944200),"Tester does not inherit live terminal reservation");ReserveNews(1790944200);check(NewsUsed(1790944200),"Tester in-memory event cap works");
 check(Html("<tag>&\"")=="&lt;tag&gt;&amp;&quot;","HTML dynamic values escaped");
 check(Q("a\"b\\c\nx")=="\"a\\\"b\\\\c\\nx\"","JSON quote slash newline escaped");
 check(RetryAfter("{\"parameters\":{\"retry_after\": 71}}") ==71,"Telegram retry_after parsed");
 check(RetryAfter("{}") ==60,"Retry fallback bounded");
 check(RetryAfter("{\"retry_after\":90000}") ==3600,"Retry upper bound");
 std::cout<<"ADAPTER_TESTS "<<passed<<"\n";
}
'''
with tempfile.TemporaryDirectory() as t:
 d=Path(t);(d/'a.cpp').write_text(shim+src+harness)
 r=subprocess.run(['g++','-std=c++17','-O2',str(d/'a.cpp'),'-o',str(d/'t')],capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr)
 result=subprocess.run([str(d/'t')],capture_output=True,text=True,check=True).stdout
print(result,end='')
report=json.loads((H/'dist/VALIDATION.json').read_text());report['mocked_adapter_tests']=int(re.search(r'ADAPTER_TESTS (\d+)',result)[1]);report['calendar_csv_dedup_html_json']='PASS in mocked C++ environment'
(H/'dist/VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
