// SEKTE MUSANG TEORY CEBONK COMPANY 22 — SINCE 2016
// Independent D1/H4/H1/M30 Harmonic + WEB ASTRO WEEKLY DIRECTION ONLY + M5 CB1 MARKET.
// Experimental research EA. Demo only until MetaEditor + real-tick validation.
#property strict
#property version "1.21"
#property description "D1/H4/H1/M30 Harmonic, weekly Astro V1 dominance, M5 CB1; Fibonacci TP RR>=2"
#property tester_file "CEBONK_C2_ASTRO.csv"
#include <Trade/Trade.mqh>
#ifndef CEBONK_HARMONIC_SCANNER
#define CEBONK_HARMONIC_SCANNER
// Confirmed closed-candle zigzag pivots followed by an in-progress D on CLOSED bars.
// Screening definitions are explicit research approximations, not a promise of profitability.
enum HarmonicType { HP_NONE=0, HP_GARTLEY=1, HP_BAT=2, HP_ALT_BAT=3,
  HP_BUTTERFLY=4, HP_CRAB=5, HP_DEEP_CRAB=6, HP_CYPHER=7,
  HP_SHARK=8, HP_FIVE_ZERO=9, HP_THREE_DRIVES=10,
  HP_ABCD=11, HP_ALT_ABCD=12, HP_IMPULSE_ABCD=13, HP_CORRECTIVE_ABCD=14,
  HP_NESTED_ABCD=15, HP_BACK_TO_BACK_ABCD=16 };
#define HP_COUNT 16

input group "03 | HARMONIC PATTERN SWITCHES"
input bool PatternGartley=true;
input bool PatternBat=true;
input bool PatternAlternateBat=true;
input bool PatternButterfly=true;
input bool PatternCrab=true;
input bool PatternDeepCrab=true;
input bool PatternCypher=true;
input bool PatternShark=true;
input bool PatternFiveZero=true;
input bool PatternThreeDrives=true;
input bool PatternABCD=true;
input bool PatternAlternateABCD=true;
input bool PatternImpulseABCD=true;
input bool PatternCorrectiveABCD=true;
input bool PatternNestedABCD=true;
input bool PatternBackToBackABCD=true;

struct HPSwing { int bar; int side; double price; datetime at; };
struct HPSetup { bool valid; int dir; int regime; int pat; ENUM_TIMEFRAMES tf;
  datetime dAt; double d; double a; double cb1; double sl; double target382; double target618;
  long signature; };

string HPName(const int n){
 switch(n){
  case HP_GARTLEY:return "GARTLEY"; case HP_BAT:return "BAT";
  case HP_ALT_BAT:return "ALTERNATE BAT"; case HP_BUTTERFLY:return "BUTTERFLY";
  case HP_CRAB:return "CRAB"; case HP_DEEP_CRAB:return "DEEP CRAB";
  case HP_CYPHER:return "CYPHER"; case HP_SHARK:return "SHARK";
  case HP_FIVE_ZERO:return "5-0"; case HP_THREE_DRIVES:return "THREE DRIVES";
  case HP_ABCD:return "AB=CD"; case HP_ALT_ABCD:return "ALTERNATE AB=CD";
  case HP_IMPULSE_ABCD:return "IMPULSE AB=CD";
  case HP_CORRECTIVE_ABCD:return "CORRECTIVE AB=CD";
  case HP_NESTED_ABCD:return "NESTED AB=CD";
  case HP_BACK_TO_BACK_ABCD:return "BACK-TO-BACK AB=CD";
 }
 return "NONE";
}

bool HPEnabled(const int n){
 switch(n){
 case HP_GARTLEY:return PatternGartley; case HP_BAT:return PatternBat;
 case HP_ALT_BAT:return PatternAlternateBat; case HP_BUTTERFLY:return PatternButterfly;
 case HP_CRAB:return PatternCrab; case HP_DEEP_CRAB:return PatternDeepCrab;
 case HP_CYPHER:return PatternCypher; case HP_SHARK:return PatternShark;
 case HP_FIVE_ZERO:return PatternFiveZero; case HP_THREE_DRIVES:return PatternThreeDrives;
 case HP_ABCD:return PatternABCD; case HP_ALT_ABCD:return PatternAlternateABCD;
 case HP_IMPULSE_ABCD:return PatternImpulseABCD;
 case HP_CORRECTIVE_ABCD:return PatternCorrectiveABCD;
 case HP_NESTED_ABCD:return PatternNestedABCD;
 case HP_BACK_TO_BACK_ABCD:return PatternBackToBackABCD;
 } return false;
}

bool HPNear(const double x,const double target,const double t){ return MathAbs(x-target)<=t; }
bool HPRange(const double x,const double low,const double high,const double tol){
 return x>=low-tol && x<=high+tol;
}

bool HPPivot(MqlRates &a[],const int n,const int i,const int depth,const int side){
 if(i-depth<1 || i+depth>=n)return false;
 for(int j=1;j<=depth;j++){
  if(side>0 && (a[i].high<=a[i-j].high || a[i].high<=a[i+j].high)) return false;
  if(side<0 && (a[i].low>=a[i-j].low || a[i].low>=a[i+j].low)) return false;
 }
 return true;
}

// Ascending chronological order, alternating pivot highs/lows.
int HPBuildSwings(MqlRates &a[],const int n,const int depth,HPSwing &sw[]){
 ArrayResize(sw,0);
 for(int i=n-depth-1;i>depth;i--){
  bool h=HPPivot(a,n,i,depth,1),l=HPPivot(a,n,i,depth,-1);
  if(h==l)continue;
  HPSwing p; p.bar=i;p.side=h?1:-1;p.price=h?a[i].high:a[i].low;p.at=a[i].time;
  int used=ArraySize(sw);
  if(used>0&&sw[used-1].side==p.side){
    bool more=(p.side>0 ? p.price>sw[used-1].price : p.price<sw[used-1].price);
    if(more)sw[used-1]=p;
  } else {
   if(used>=90){ for(int k=1;k<used;k++)sw[k-1]=sw[k];used--;ArrayResize(sw,used); }
   ArrayResize(sw,used+1);sw[used]=p;
  }
 }
 return ArraySize(sw);
}

// X-A-B-C-(D) family. Five-zero and Three Drives use their own six-point geometry.
int HPClassify(const HPSwing &sw[],const int ci,const double d,const double tol){
 if(ci<3)return HP_NONE;
 HPSwing X=sw[ci-3],A=sw[ci-2],B=sw[ci-1],C=sw[ci];
 double xa=MathAbs(A.price-X.price),ab=MathAbs(B.price-A.price),bc=MathAbs(C.price-B.price),cd=MathAbs(d-C.price);
 if(xa<=0||ab<=0||bc<=0||cd<=0)return HP_NONE;
 double b=ab/xa,c=bc/ab,ad=MathAbs(d-A.price)/xa,ext=cd/bc,eq=cd/ab;
 bool classic=HPRange(c,0.382,0.886,tol);
 bool internal=(C.side>0 ? d>X.price : d<X.price);
 bool external=!internal;
 if(HPEnabled(HP_GARTLEY)&&classic&&HPNear(b,0.618,tol)&&HPNear(ad,0.786,tol)&&
    HPRange(ext,1.272,1.618,tol*2)&&internal)return HP_GARTLEY;
 if(HPEnabled(HP_BAT)&&classic&&HPRange(b,0.382,0.5,tol)&&HPNear(ad,0.886,tol)&&
    HPRange(ext,1.618,2.618,tol*2)&&internal)return HP_BAT;
 if(HPEnabled(HP_ALT_BAT)&&classic&&HPRange(b,0.30,0.50,tol)&&HPNear(ad,1.13,tol)&&
    HPRange(ext,2.0,3.618,tol*2)&&external)return HP_ALT_BAT;
 if(HPEnabled(HP_BUTTERFLY)&&classic&&HPNear(b,0.786,tol)&&HPRange(ad,1.272,1.618,tol)&&
    HPRange(ext,1.618,3.618,tol*2)&&external)return HP_BUTTERFLY;
 if(HPEnabled(HP_DEEP_CRAB)&&classic&&HPNear(b,0.886,tol)&&HPNear(ad,1.618,tol)&&
    HPRange(ext,2.618,3.618,tol*2)&&external)return HP_DEEP_CRAB;
 if(HPEnabled(HP_CRAB)&&classic&&HPRange(b,0.382,0.618,tol)&&HPNear(ad,1.618,tol)&&
    HPRange(ext,2.24,3.618,tol*2)&&external)return HP_CRAB;
 // Cypher C extends the XA leg. D is ~78.6% retracement of the *XC* swing.
 double xc=MathAbs(C.price-X.price),cr=(xc>0 ? cd/xc:0);
 if(HPEnabled(HP_CYPHER)&&HPRange(b,0.382,0.618,tol)&&
    HPRange(xc/xa,1.272,1.414,tol)&&HPNear(cr,0.786,tol)&&internal)return HP_CYPHER;
 // Shark O-X-A-B-C correspondence (X,A,B,C,D here), using explicit range screening.
 double ox=xa,xaShark=ab,abShark=bc,bcShark=cd;
 if(HPEnabled(HP_SHARK)&&HPRange(xaShark/ox,0.382,0.886,tol)&&
    HPRange(abShark/xaShark,1.13,1.618,tol)&&
    HPRange(bcShark/abShark,1.618,2.24,tol)&&
    HPRange(MathAbs(d-X.price)/ox,0.886,1.13,tol))return HP_SHARK;
 // AB=CD variants: separate extension measurements; nested/back-to-back require extra structure.
 if(classic&&HPEnabled(HP_ABCD)&&HPNear(eq,1.0,0.10))return HP_ABCD;
 if(classic&&HPEnabled(HP_ALT_ABCD)&& (HPNear(eq,1.272,tol)||HPNear(eq,1.618,tol)))return HP_ALT_ABCD;
 if(HPEnabled(HP_IMPULSE_ABCD)&&HPRange(c,0.618,0.786,tol)&&
    HPRange(eq,1.272,1.618,tol)&&xa>ab)return HP_IMPULSE_ABCD;
 if(HPEnabled(HP_CORRECTIVE_ABCD)&&HPRange(c,0.382,0.618,tol)&&
    HPRange(eq,0.618,0.786,tol)&&ab<xa)return HP_CORRECTIVE_ABCD;
 return HP_NONE;
}

// Real additional contextual structure required; not aliases for normal AB=CD.
int HPClassifyContext(const HPSwing &sw[],const int ci,const double d,const double tol){
 if(ci<4)return HP_NONE;
 double ab=MathAbs(sw[ci-2].price-sw[ci-1].price); // B-C leg in sequence
 double newAB=MathAbs(sw[ci-2].price-sw[ci-3].price);
 double cd=MathAbs(sw[ci].price-d);
 double prior=MathAbs(sw[ci-4].price-sw[ci-3].price);
 if(prior<=0||ab<=0||newAB<=0||cd<=0)return HP_NONE;
 // Back-to-back: prior measured leg and current measured leg comparable, with shared turn.
 if(HPEnabled(HP_BACK_TO_BACK_ABCD) && ci>=5){
  double p1=MathAbs(sw[ci-5].price-sw[ci-4].price);
  double p2=MathAbs(sw[ci-3].price-sw[ci-2].price);
  if(p1>0&&HPNear(prior/p1,1.0,0.12)&&HPNear(cd/p2,1.0,0.12)&&
     HPRange(ab/newAB,0.382,0.886,tol))return HP_BACK_TO_BACK_ABCD;
 }
 // Nested measured move: last two waves smaller than preceding parent wave.
 if(HPEnabled(HP_NESTED_ABCD) && ci>=5){
  double outer=MathAbs(sw[ci-5].price-sw[ci-2].price);
  if(outer>0&&ab<outer*0.8&&cd<outer*0.8&&HPNear(cd/newAB,1.0,0.12)&&
     HPRange(ab/newAB,0.382,0.886,tol))return HP_NESTED_ABCD;
 }
 return HP_NONE;
}

int HPClassifySix(const HPSwing &sw[],const int ci,const double d,const double tol){
 if(ci<4)return HP_NONE;
 HPSwing O=sw[ci-4],X=sw[ci-3],A=sw[ci-2],B=sw[ci-1],C=sw[ci];
 double ox=MathAbs(X.price-O.price),xa=MathAbs(A.price-X.price),ab=MathAbs(B.price-A.price),bc=MathAbs(C.price-B.price),cd=MathAbs(d-C.price);
 if(ox<=0||xa<=0||ab<=0||bc<=0||cd<=0)return HP_NONE;
 if(HPEnabled(HP_FIVE_ZERO)&&HPRange(xa/ox,1.13,1.618,tol)&&
    HPRange(ab/xa,1.618,2.24,tol)&&HPRange(bc/ab,1.13,1.618,tol)&&
    HPNear(cd/bc,0.50,tol)) return HP_FIVE_ZERO;
 // Three Drives: O->X drive 1, X->A correction, A->B drive 2,
 // B->C correction, C->D drive 3. Drives 2/3 must extend corresponding correction.
 if(HPEnabled(HP_THREE_DRIVES)&&HPRange(xa/ox,0.50,0.786,tol)&&
    HPRange(bc/ab,0.50,0.786,tol)&&HPRange(ab/xa,1.272,1.618,tol)&&
    HPRange(cd/bc,1.272,1.618,tol))return HP_THREE_DRIVES;
 return HP_NONE;
}

// Per timeframe find most recent *eligible* structure, not exclusively final four pivots.
// D is low/high of CLOSED candles after C, never current candle. Duplicate timestamp is stable.
bool HPFind(const ENUM_TIMEFRAMES tf,const int depth,const int lookback,const int maxDAge,
            const double fibTol,const double minXApts,HPSetup &out){
 out.valid=false;
 MqlRates a[]; ArraySetAsSeries(a,true);
 int n=CopyRates(_Symbol,tf,0,lookback,a);
 if(n<lookback)return false;
 HPSwing sw[];int count=HPBuildSwings(a,n,depth,sw);
 if(count<4)return false;
 for(int ci=count-1;ci>=3;ci--){
  if(ci!=count-1)break; // Only most recent confirmed C: no stale parent setups
  HPSwing X=sw[ci-3],A=sw[ci-2],B=sw[ci-1],C=sw[ci];
  if(C.bar<=1||C.bar>maxDAge+depth+12)continue;
  double xa=MathAbs(A.price-X.price);
  if(xa<minXApts*_Point)continue;
  int dir=(C.side>0?1:-1); // C high -> D low -> BUY; C low -> D high -> SELL.
  double D=(dir>0?DBL_MAX:-DBL_MAX);int di=-1;
  for(int i=1;i<C.bar;i++){
   double v=(dir>0?a[i].low:a[i].high);
   if((dir>0&&v<D)||(dir<0&&v>D)){D=v;di=i;}
  }
  if(di<1||di>maxDAge)continue;
  if(dir>0 ? !(A.price>C.price && C.price>B.price && D<B.price):
               !(A.price<C.price && C.price<B.price && D>B.price)){
    // A strict gate applies to classic XABCD; extension geometries may exceed A.
    if(dir>0 ? !(D<B.price):!(D>B.price))continue;
  }
  int pat=HPClassifySix(sw,ci,D,fibTol);
  if(pat==HP_NONE)pat=HPClassifyContext(sw,ci,D,fibTol);
  if(pat==HP_NONE)pat=HPClassify(sw,ci,D,fibTol);
  if(pat==HP_NONE)continue;
  // A->D Fibonacci targets in trade direction; TP 0.382 / 0.618 as candidates.
  double distance=MathAbs(A.price-D);
  if(distance<minXApts*_Point*0.25)continue;
  out.valid=true;out.dir=dir;out.pat=pat;out.tf=tf;
  out.dAt=a[di].time;out.d=D;out.a=A.price;
  out.target382=D+dir*distance*0.382;
  out.target618=D+dir*distance*0.618;
  out.signature=(long)out.dAt;out.cb1=0;out.sl=0;out.regime=0;
  return true;
 }
 return false;
}
#endif

#ifndef CEBONK_ASTRO_WEB_FEED
#define CEBONK_ASTRO_WEB_FEED
// Published V1 model drives the UPDATED web weekly panel's Monday-Friday dominance.
// Weekly core on the website uses the legacy V1 model; the browser daily UI says v2.0.
// Never confuse model version with UI version.
// Feed is from user's GitHub Pages site. It is V1 *published historical schedule*,
// NOT the on-page V2 browser runtime. Never imply V1/V2 prediction parity.
#define AC_MODEL "CEBONK_C2_WEB_V1_35ce78b4"
#define AC_WEB "https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/"
enum AC_SOURCE { ASTRO_WEB_CSV=0, ASTRO_LOCAL_CSV=1, ASTRO_OFF=2 };
input group "02 | ASTRODOX SOURCE (WEB)"
input AC_SOURCE AstroSource=ASTRO_WEB_CSV;
input bool AcceptExperimentalAstro=false;
input string AstroBaseURL=AC_WEB;
input string AstroLocalCSV="CEBONK_C2_ASTRO.csv";
input int AstroHTTPTimeoutMs=3500;
input int AstroLiveCacheMinutes=180;
input bool AstroAutoServerUTC=true;
input int AstroFixedServerUTCMinutes=180;
input group "03 | WEEKLY DOMINANCE (SENIN–JUMAT WIB)"
input bool UseWeeklyDominance=true;
input int WeeklyMinSharePercent=55;

struct ACWindow{long from,to;int dir;string id;};
ACWindow acRows[];
string acMonth="",acError="NOT_LOADED";
bool acLoaded=false;
long acLastGood=0,acNextTry=0;

bool ACDigits(const string s){
 if(StringLen(s)<1||StringLen(s)>20)return false;
 for(int k=0;k<StringLen(s);k++){ushort c=StringGetCharacter(s,k);if(c<48||c>57)return false;}
 return true;
}
int ACOffset(){
 if(MQLInfoInteger(MQL_TESTER) || !AstroAutoServerUTC)return AstroFixedServerUTCMinutes*60;
 double diff=(double)TimeTradeServer()-(double)TimeGMT();
 return (int)MathRound(diff/900.0)*900;
}
long ACNowUTC(){
 if(MQLInfoInteger(MQL_TESTER))return (long)TimeCurrent()-ACOffset();
 return (long)TimeGMT();
}
long ACFromServer(const datetime t){return (long)t-ACOffset();}
string ACMonthWIB(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);
 return StringFormat("%04d-%02d",d.year,d.mon);
}
long ACWeekMondayUTC(const long utc){
 MqlDateTime d;
 TimeToStruct((datetime)(utc+7*3600),d);
 int offset=(d.day_of_week+6)%7; // Monday=0, Sunday=6
 d.hour=0;d.min=0;d.sec=0;
 return (long)StructToTime(d)-7*3600-(long)offset*86400;
}
string ACWeekCacheKey(const long utc){
 long monday=ACWeekMondayUTC(utc);
 string m1=ACMonthWIB(utc);
 string m2=ACMonthWIB(monday+6*3600);
 string m3=ACMonthWIB(monday+4*86400+6*3600);
 return m1+"/"+m2+"/"+m3;
}
bool ACParse(const string content){
 ACWindow temp[];string lines[];int n=StringSplit(content,10,lines);
 if(n<2){acError="EMPTY_ASTRO_CSV";return false;}
 long previous=0;bool header=false;
 for(int i=0;i<n;i++){
  string line=lines[i];StringTrimLeft(line);StringTrimRight(line);
  if(i==0&&StringLen(line)>0&&StringGetCharacter(line,0)==65279)line=StringSubstr(line,1);
  if(line=="")continue;
  if(!header){if(line!="start_epoch,end_epoch,direction,window_id,model")return false;header=true;continue;}
  string v[];if(StringSplit(line,44,v)!=5 || !ACDigits(v[0]) || !ACDigits(v[1]) ||
   v[4]!=AC_MODEL || StringLen(v[3])<2)return false;
  long from=StringToInteger(v[0]),to=StringToInteger(v[1]);
  if(from<946684800||to<=from||from%300!=0||to%300!=0||from<previous)return false;
  int dir=0;
  if(v[2]=="BUY")dir=1;
  else if(v[2]=="SELL")dir=-1;
  else if(v[2]!="NEUTRAL" && v[2]!="TRANSITION" && v[2]!="OUTSIDE")return false;
  int size=ArraySize(temp);if(size>20000)return false;
  ArrayResize(temp,size+1);temp[size].from=from;temp[size].to=to;
  temp[size].dir=dir;temp[size].id=v[3];previous=to;
 }
 if(ArraySize(temp)<1)return false;
 ArrayResize(acRows,ArraySize(temp));
 for(int i=0;i<ArraySize(temp);i++)acRows[i]=temp[i];
 acLoaded=true;acError="";acLastGood=(long)TimeLocal();return true;
}
bool ACReadLocal(){
 int fh=FileOpen(AstroLocalCSV,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
 if(fh==INVALID_HANDLE){acError="ASTRO_LOCAL_FILE_MISSING";return false;}
 string content="";
 while(!FileIsEnding(fh)){
  content+=FileReadString(fh)+"\n";
  if(StringLen(content)>1500000){FileClose(fh);acError="ASTRO_FILE_TOO_LARGE";return false;}
 }
 FileClose(fh);if(!ACParse(content)){acError="ASTRO_LOCAL_FILE_INVALID";return false;}
 return true;
}
bool ACReadWeb(const string month){
 if(MQLInfoInteger(MQL_TESTER)){acError="TESTER_WEBREQUEST_UNSUPPORTED";return false;}
 char send[],reply[];string headers="";ResetLastError();
 int status=WebRequest("GET",AstroBaseURL+month+".csv","Accept: text/csv\r\n",AstroHTTPTimeoutMs,send,reply,headers);
 if(status!=200||ArraySize(reply)<30||ArraySize(reply)>1000000){acError="ASTRO_HTTP_"+IntegerToString(status);return false;}
 if(!ACParse(CharArrayToString(reply,0,WHOLE_ARRAY,CP_UTF8))){acError="ASTRO_WEB_PARSE_FAILED";return false;}
 return true;
}
// Fetch every month required for the CURRENT Mon-Fri week, plus the present
// month (Saturday/Sunday can be in another month). Atomic: no stale partial feed.
bool ACReadWebWeek(const long now){
 long monday=ACWeekMondayUTC(now);
 string required[3];
 required[0]=ACMonthWIB(monday+6*3600);
 required[1]=ACMonthWIB(monday+4*86400+6*3600);
 required[2]=ACMonthWIB(now);
 for(int a=0;a<3;a++)for(int b=a+1;b<3;b++){
  if(required[b]<required[a]){string x=required[a];required[a]=required[b];required[b]=x;}
 }
 ACWindow combined[];ArrayResize(combined,0);
 for(int m=0;m<3;m++){
  if(m>0&&required[m]==required[m-1])continue;
  if(!ACReadWeb(required[m])){acLoaded=false;ArrayResize(acRows,0);return false;}
  int start=ArraySize(combined),count=ArraySize(acRows);
  if(start+count>100000){acLoaded=false;ArrayResize(acRows,0);acError="ASTRO_TOO_MANY_ROWS";return false;}
  if(start>0&&count>0&&acRows[0].from<combined[start-1].to){
   acLoaded=false;ArrayResize(acRows,0);acError="ASTRO_OVERLAPPING_MONTHS";return false;
  }
  ArrayResize(combined,start+count);
  for(int k=0;k<count;k++)combined[start+k]=acRows[k];
 }
 if(ArraySize(combined)<1){acLoaded=false;acError="ASTRO_WEEK_EMPTY";return false;}
 ArrayResize(acRows,ArraySize(combined));
 for(int k=0;k<ArraySize(combined);k++)acRows[k]=combined[k];
 acLoaded=true;acLastGood=(long)TimeLocal();return true;
}
void ACPoll(){
 if(AstroSource==ASTRO_OFF){acLoaded=false;acError="ASTRO_DISABLED";return;}
 long now=ACNowUTC();
 string month=ACWeekCacheKey(now);
 if(AstroSource==ASTRO_LOCAL_CSV||MQLInfoInteger(MQL_TESTER)){
  if(!acLoaded && (long)TimeLocal()>=acNextTry){
   acNextTry=(long)TimeLocal()+60;
   if(!ACReadLocal())acLoaded=false;
  }
  return;
 }
 if(acLoaded && acMonth==month && (long)TimeLocal()<acNextTry)return;
 if((long)TimeLocal()<acNextTry)return;
 // Month must match active lookup; old month data is never reused as fallback.
 acLoaded=false;acMonth=month;acNextTry=(long)TimeLocal()+60;
 if(ACReadWebWeek(now))acNextTry=(long)TimeLocal()+AstroLiveCacheMinutes*60;
}
int ACIndexAt(const long utc){
 if(!acLoaded)return -1;
 int lo=0,hi=ArraySize(acRows)-1;
 while(lo<=hi){int mid=(lo+hi)/2;
  if(utc<acRows[mid].from)hi=mid-1;
  else if(utc>=acRows[mid].to)lo=mid+1;
  else return mid;
 }
 return -1; // missing is NOT neutral
}
int ACDirAt(const long utc){
 int i=ACIndexAt(utc);
 return i<0?0:acRows[i].dir;
}
// Weekly website policy: 5 WIB weekdays * 216 slots (06:00-24:00, 5-minute grid).
// BUY / SELL share is counted across the entire week; NEUTRAL/TRANSITION excluded.
// No DAILY ASTRO FILTER, no intraday window, no opposite-timeframe veto.
bool ACWeeklyGate(const int dir,const datetime nextM5Open){
 if(!UseWeeklyDominance)return true; // Only for explicit technical-only A/B tests.
 if(AstroSource==ASTRO_OFF||!AcceptExperimentalAstro||!acLoaded)return false;
 const long now=ACNowUTC();
 const long closedUTC=ACFromServer(nextM5Open)-1;
 const long monday=ACWeekMondayUTC(now);
 if(monday!=ACWeekMondayUTC(closedUTC))return false;
 MqlDateTime wib;TimeToStruct((datetime)(now+7*3600),wib);
 if(wib.day_of_week<1||wib.day_of_week>5)return false; // Never trade weekends.
 if(AstroSource==ASTRO_WEB_CSV && !MQLInfoInteger(MQL_TESTER) &&
   (acMonth!=ACWeekCacheKey(now)||(long)TimeLocal()-acLastGood>AstroLiveCacheMinutes*60+120))return false;
 int buy=0,sell=0;
 for(int day=0;day<5;day++){
  long start=monday+(long)day*86400+6*3600;
  for(int i=0;i<216;i++){
   long slot=start+(long)i*300;
   int idx=ACIndexAt(slot);
   if(idx<0||acRows[idx].to<slot+300)return false; // Full Mon-Fri coverage or SKIP.
   if(acRows[idx].dir>0)buy++;
   else if(acRows[idx].dir<0)sell++;
  }
 }
 const int directional=buy+sell;
 if(directional==0)return false;
 const int dominant=buy*100>=WeeklyMinSharePercent*directional ? 1 :
                    sell*100>=WeeklyMinSharePercent*directional ? -1 : 0;
 return dominant!=0 && dominant==dir; // Daily direction is irrelevant by design.
}
#endif

enum CH_STRATEGY { FOLLOW_PLUS_REVERSAL=0, FOLLOW_TREND_ONLY=1, REVERSAL_ONLY=2 };
input group "01 | SCANNERS + REGIME"
input bool ScanD1=true;
input bool ScanH4=true;
input bool ScanH1=true;
input bool ScanM30=true;
input CH_STRATEGY StrategyMode=FOLLOW_PLUS_REVERSAL;
input int D1History=320;
input int H4History=320;
input int H1History=340;
input int M30History=360;
input int PivotDepth=2;
input int MaxD1DClosedBars=3;
input int MaxH4DClosedBars=4;
input int MaxH1DClosedBars=6;
input int MaxM30DClosedBars=10;
input double FibTolerance=0.06;
input double MinimumXA_Points=250;
input int M5History=160;
input int M5PivotDepth=1;
input int CB1MaxAgeBars=30;
input int CB1BreakPoints=10;
input double CB1MinBody=0.35;

input group "04 | RISK / EXECUTION"
input double FixedLot=0.01;
input int SLBufferPoints=100;
input int MaxSLPoints=6000;
input int MaxChasePoints=700;
input double MaxRiskPercent=1.0;
input double DailyEquityStopPercent=5.0;
input int MaxOpenPositions=1;
input int MaxSpreadPoints=70;
input int DeviationPoints=20;
input ulong Magic=22100910;
input bool StartAutopilot=false;
input bool AllowRealAccount=false;

input group "05 | NOTIFICATIONS"
input bool EnableMT5Push=false;
input bool EnableTelegram=false;
input bool EnableCloseAlerts=false;
input string TelegramBotToken="";
input string TelegramChatID="";

CTrade chTrade;
int chEMA[4]={INVALID_HANDLE,INVALID_HANDLE,INVALID_HANDLE,INVALID_HANDLE};
ENUM_TIMEFRAMES chTF[4]={PERIOD_D1,PERIOD_H4,PERIOD_H1,PERIOD_M30};
string CHTFName(const ENUM_TIMEFRAMES tf){
 if(tf==PERIOD_D1)return "D1";
 if(tf==PERIOD_H4)return "H4";
 if(tf==PERIOD_H1)return "H1";
 if(tf==PERIOD_M30)return "M30";
 return "UNKNOWN";
}
bool chAuto=false;
string chButton="CHAF_AUTOPILOT";
datetime chLastM5=0;
string chDayKey="";

void CHButton(){
 if(ObjectFind(0,chButton)<0){
  ObjectCreate(0,chButton,OBJ_BUTTON,0,0,0);
  ObjectSetInteger(0,chButton,OBJPROP_XDISTANCE,14);
  ObjectSetInteger(0,chButton,OBJPROP_YDISTANCE,18);
  ObjectSetInteger(0,chButton,OBJPROP_XSIZE,155);
  ObjectSetInteger(0,chButton,OBJPROP_YSIZE,28);
 }
 ObjectSetString(0,chButton,OBJPROP_TEXT,chAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,chButton,OBJPROP_BGCOLOR,chAuto?clrDarkGreen:clrMaroon);
 ObjectSetInteger(0,chButton,OBJPROP_COLOR,clrWhite);
 ObjectSetInteger(0,chButton,OBJPROP_STATE,false);
 ChartRedraw();
}
int CHMyPositions(){
 int count=0;
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);
  if(ticket>0&&PositionSelectByTicket(ticket)&&PositionGetString(POSITION_SYMBOL)==_Symbol&&
     (ulong)PositionGetInteger(POSITION_MAGIC)==Magic)count++;
 }
 return count;
}
string CHDailyKey(){
 MqlDateTime d;TimeToStruct(TimeCurrent(),d);
 return StringFormat("CHAF.D.%I64d.%I64u.%04d%02d%02d",AccountInfoInteger(ACCOUNT_LOGIN),Magic,d.year,d.mon,d.day);
}
bool CHDailyRisk(){
 string key=CHDailyKey();
 if(key!=chDayKey)chDayKey=key;
 if(!GlobalVariableCheck(key)){
  GlobalVariableSet(key,AccountInfoDouble(ACCOUNT_EQUITY));GlobalVariablesFlush();
 }
 double baseline=GlobalVariableGet(key);
 return baseline>0&&AccountInfoDouble(ACCOUNT_EQUITY)>baseline*(1.0-DailyEquityStopPercent/100.0);
}
// Trend classification computed per scanner TF. True countertrend is distinct from no trend.
int CHRegime(const int idx,const HPSetup &s){
 double emaNow[1],emaOld[1];MqlRates b[];ArraySetAsSeries(b,true);
 if(CopyBuffer(chEMA[idx],0,1,1,emaNow)!=1 || CopyBuffer(chEMA[idx],0,5,1,emaOld)!=1 ||
    CopyRates(_Symbol,chTF[idx],0,7,b)!=7)return 0;
 int trend=(b[1].close>emaNow[0]&&emaNow[0]>emaOld[0]?1:
            b[1].close<emaNow[0]&&emaNow[0]<emaOld[0]?-1:0);
 if(trend==0)return 0;
 return trend==s.dir?1:2;
}
// CB1 level = pivot high between two descending M5 lows, mirrored for SELL.
// Entry requires real-body close-break on bar 1, and M5 pivot after D1/H4/H1/M30 D.
bool CHCB1(MqlRates &m[],const int n,const HPSetup &s,double &level){
 HPSwing piv[];int count=HPBuildSwings(m,n,M5PivotDepth,piv);
 int recent=-1,older=-1;
 for(int j=count-1;j>=0;j--){
  if(piv[j].side==-s.dir){
   if(recent<0)recent=j;else{older=j;break;}
  }
 }
 if(older<0)return false;
 HPSwing p=piv[older],q=piv[recent];
 if(q.at<s.dAt||q.bar<2||q.bar>CB1MaxAgeBars||p.bar-q.bar<2)return false;
 if(s.dir>0?q.price>=p.price:q.price<=p.price)return false;
 level=s.dir>0?-DBL_MAX:DBL_MAX;
 for(int k=q.bar+1;k<p.bar;k++){
  if(s.dir>0)level=MathMax(level,m[k].high);
  else level=MathMin(level,m[k].low);
 }
 if(level==DBL_MAX||level==-DBL_MAX||m[1].time<=q.at)return false;
 double range=m[1].high-m[1].low;
 if(range<=0||MathAbs(m[1].close-m[1].open)/range<CB1MinBody)return false;
 if(s.dir>0)return m[1].close>m[1].open&&m[2].close<=level&&
                        m[1].close>level+CB1BreakPoints*_Point;
 return m[1].close<m[1].open&&m[2].close>=level&&
        m[1].close<level-CB1BreakPoints*_Point;
}
double CHRound(const double price,const bool up){
 double step=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(step<=0)return 0;
 return NormalizeDouble((up?MathCeil(price/step-1e-9):MathFloor(price/step+1e-9))*step,_Digits);
}
string CHClaimKey(const HPSetup &s){
 // Same timeframe/D cannot generate repeated orders regardless of overlapping patterns.
 return StringFormat("CHAF.C.%I64d.%s.%I64u.%d.%I64d",AccountInfoInteger(ACCOUNT_LOGIN),
  _Symbol,Magic,(int)s.tf,(long)s.dAt);
}
bool CHHistoryConsumed(const HPSetup &s){
 if(!HistorySelect(s.dAt,TimeCurrent()))return true;
 string token=StringFormat("CF:%d:%I64d",(int)s.tf,(long)s.dAt);
 for(int i=HistoryDealsTotal()-1;i>=0;i--){
  ulong id=HistoryDealGetTicket(i);
  if(HistoryDealGetString(id,DEAL_SYMBOL)==_Symbol &&
   (ulong)HistoryDealGetInteger(id,DEAL_MAGIC)==Magic &&
   StringFind(HistoryDealGetString(id,DEAL_COMMENT),token)==0)return true;
 }
 return false;
}
bool CHClaim(const HPSetup &s){
 string key=CHClaimKey(s);
 if(StringLen(key)>63)return false;
 if(CHHistoryConsumed(s))return false;
 if(!GlobalVariableCheck(key))GlobalVariableSet(key,0);
 if(!GlobalVariableSetOnCondition(key,1,0))return false;
 GlobalVariablesFlush();return true;
}

// Fibonacci target: choose 0.382 AD if RR>=2; else 0.618 AD if RR>=2;
// otherwise do not open. NO synthetic TP beyond a pattern's natural target.
bool CHExecute(HPSetup &s){
 MqlTick tick;
 if(!SymbolInfoTick(_Symbol,tick)||tick.ask<=tick.bid||tick.bid<=0)return false;
 if((tick.ask-tick.bid)/_Point>MaxSpreadPoints)return false;
 if(CHMyPositions()>=MaxOpenPositions)return false;
 double entry=s.dir>0?tick.ask:tick.bid;
 if(MathAbs(entry-s.cb1)/_Point>MaxChasePoints)return false;
 double sl=CHRound(s.d+(s.dir>0?-SLBufferPoints:SLBufferPoints)*_Point,s.dir<0);
 double risk=s.dir*(entry-sl);
 if(sl<=0||risk<=0||risk/_Point>MaxSLPoints)return false;
 double tp382=CHRound(s.target382,s.dir>0);
 double tp618=CHRound(s.target618,s.dir>0);
 double tp=0;
 if(s.dir*(tp382-entry)>=2.0*risk)tp=tp382;
 else if(s.dir*(tp618-entry)>=2.0*risk)tp=tp618;
 else{Print("CHAF SKIP Fibonacci RR under 1:2 | ",HPName(s.pat));return false;}
 double required=MathMax((double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL),
                          (double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL))*_Point+2*_Point;
 if(s.dir>0 ? tick.bid-sl<required||tp-tick.bid<required :
              sl-tick.ask<required||tick.ask-tp<required)return false;
 ENUM_ORDER_TYPE type=s.dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
 double loss=0,margin=0;
 if(!OrderCalcProfit(type,_Symbol,FixedLot,entry,sl,loss)||loss>=0||
    -loss>AccountInfoDouble(ACCOUNT_EQUITY)*MaxRiskPercent/100.0)return false;
 if(!OrderCalcMargin(type,_Symbol,FixedLot,entry,margin)||margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))return false;
 if(!CHClaim(s))return false; // Fail/unknown orders consumed, no duplicate retry.
 string comment=StringFormat("CF:%d:%I64d:%d:%d",(int)s.tf,(long)s.dAt,s.pat,s.regime);
 bool ok=s.dir>0?chTrade.Buy(FixedLot,_Symbol,entry,sl,tp,comment):
                 chTrade.Sell(FixedLot,_Symbol,entry,sl,tp,comment);
 uint ret=chTrade.ResultRetcode();
 if(!ok||(ret!=TRADE_RETCODE_DONE && ret!=TRADE_RETCODE_DONE_PARTIAL&&ret!=TRADE_RETCODE_PLACED)){
  PrintFormat("CHAF order refused: %u (%s); signal consumed",ret,chTrade.ResultRetcodeDescription());return true;
 }
 PrintFormat("CHAF %s | %s | TF%s | %s | CB1 %.*f | SL %.*f TP %.*f (Fibonacci)",
    HPName(s.pat),s.regime==1?"FOLLOW":"REVERSAL",CHTFName(s.tf),s.dir>0?"BUY":"SELL",
    _Digits,s.cb1,_Digits,sl,_Digits,tp);
 return true;
}

string CHUrlEnc(string in){
 char bytes[];int n=StringToCharArray(in,bytes,0,WHOLE_ARRAY,CP_UTF8);string s="";
 for(int i=0;i<n-1;i++){
  uchar c=(uchar)bytes[i];
  if((c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122)||c==45||c==95||c==46)s+=ShortToString((ushort)c);
  else if(c==32)s+="+";
  else s+=StringFormat("%%%02X",(int)c);
 }
 return s;
}
void CHMessage(const string msg){
 if(EnableMT5Push&&!MQLInfoInteger(MQL_TESTER))if(!SendNotification(msg))Print("CHAF push failed ",GetLastError());
 if(EnableTelegram&&!MQLInfoInteger(MQL_TESTER)&&TelegramBotToken!=""&&TelegramChatID!=""){
  string url="https://api.telegram.org/bot"+TelegramBotToken+"/sendMessage";
  string payload="chat_id="+CHUrlEnc(TelegramChatID)+"&text="+CHUrlEnc(msg);
  char post[],reply[];StringToCharArray(payload,post,0,StringLen(payload),CP_UTF8);
  string headers="";
  int code=WebRequest("POST",url,"Content-Type: application/x-www-form-urlencoded\r\n",4500,post,reply,headers);
  if(code!=200)Print("CHAF Telegram HTTP=",code," ERR=",GetLastError());
 }
}
void CHNotify(const ulong deal,const ulong order,const long entryKind){
 string key=StringFormat("CHAF.N.%I64d.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),order);
 if(GlobalVariableCheck(key))return;
 GlobalVariableSet(key,1);GlobalVariablesFlush();
 if(entryKind==DEAL_ENTRY_OUT){
  long reason=HistoryDealGetInteger(deal,DEAL_REASON);
  if(!EnableCloseAlerts||(reason!=DEAL_REASON_TP && reason!=DEAL_REASON_SL))return;
  CHMessage(reason==DEAL_REASON_TP?"TAKE PROFIT 😅":"STOP LOSS 🥲");return;
 }
 string note=HistoryDealGetString(deal,DEAL_COMMENT);
 if(StringFind(note,"CF:")!=0&&HistoryOrderSelect(order))note=HistoryOrderGetString(order,ORDER_COMMENT);
 if(StringFind(note,"CF:")!=0)return;
 string f[];int k=StringSplit(note,':',f);
 int tf=k>=5?(int)StringToInteger(f[1]):0;
 int pat=k>=5?(int)StringToInteger(f[3]):0;
 int regime=k>=5?(int)StringToInteger(f[4]):0;
 double price=HistoryDealGetDouble(deal,DEAL_PRICE),sl=0,tp=0;
 ulong pid=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
 for(int j=PositionsTotal()-1;j>=0;j--){
  ulong ticket=PositionGetTicket(j);
  if(ticket>0&&PositionSelectByTicket(ticket) &&
     (ulong)PositionGetInteger(POSITION_IDENTIFIER)==pid){
    price=PositionGetDouble(POSITION_PRICE_OPEN);
    sl=PositionGetDouble(POSITION_SL);tp=PositionGetDouble(POSITION_TP);break;
  }
 }
 if(sl==0&&HistoryOrderSelect(order)){
  sl=HistoryOrderGetDouble(order,ORDER_SL);
  tp=HistoryOrderGetDouble(order,ORDER_TP);
 }
 int dir=(HistoryDealGetInteger(deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1);
 string msg=StringFormat("SEKTE MUSANG TEORY CEBONK COMPANY 22\nASTRO WEEKLY + HARMONIC + CB1\n%s %s | %s\nMINGGU DOMINAN %s\n%s %s\nENTRY %s\nSL %s | TP %s\nOJO FULLMARGIN COK",
   HPName(pat),CHTFName((ENUM_TIMEFRAMES)tf),regime==1?"FOLLOW":"REVERSAL",dir>0?"BULLISH":"BEARISH",_Symbol,dir>0?"BUY":"SELL",
   DoubleToString(price,_Digits),DoubleToString(sl,_Digits),DoubleToString(tp,_Digits));
 CHMessage(msg);
}

int OnInit(){
 if(!(ScanD1||ScanH4||ScanH1||ScanM30)||PivotDepth<1||PivotDepth>5||M5PivotDepth<1||M5PivotDepth>4||
    M5History<90||M5History>600||D1History<140||D1History>1200||H4History<140||H4History>1200||
    H1History<140||H1History>1200||M30History<140||M30History>1200||
    MaxD1DClosedBars<1||MaxD1DClosedBars>8||MaxH4DClosedBars<1||MaxH4DClosedBars>10||MaxH1DClosedBars<1||MaxH1DClosedBars>15||
    MaxM30DClosedBars<1||MaxM30DClosedBars>25||FibTolerance<0.005||FibTolerance>0.15||
    MinimumXA_Points<=0||CB1MaxAgeBars<3||CB1MaxAgeBars>80||CB1BreakPoints<0||
    CB1MinBody<0||CB1MinBody>1||SLBufferPoints<0||MaxSLPoints<1||MaxChasePoints<1||
    MaxRiskPercent<=0||MaxRiskPercent>5||DailyEquityStopPercent<=0||DailyEquityStopPercent>10||
    MaxOpenPositions<1||MaxOpenPositions>10||MaxSpreadPoints<0||DeviationPoints<0||
    AstroHTTPTimeoutMs<500||AstroHTTPTimeoutMs>12000||AstroLiveCacheMinutes<1||
    AstroLiveCacheMinutes>360||AstroFixedServerUTCMinutes<(-720)||AstroFixedServerUTCMinutes>840||
    AstroBaseURL==""||WeeklyMinSharePercent<51||WeeklyMinSharePercent>100||
    (!MathIsValidNumber(FixedLot))||FixedLot<=0)return INIT_PARAMETERS_INCORRECT;
 double lo=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),hi=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
 double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 if(step<=0||FixedLot<lo||FixedLot>hi||MathAbs(FixedLot/step-MathRound(FixedLot/step))>1e-7)return INIT_PARAMETERS_INCORRECT;
 if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING){
  Print("CHAF requires hedging account for independent stops");return INIT_FAILED;
 }
 for(int k=0;k<4;k++){
  chEMA[k]=iMA(_Symbol,chTF[k],50,0,MODE_EMA,PRICE_CLOSE);
  if(chEMA[k]==INVALID_HANDLE)return INIT_FAILED;
 }
 chTrade.SetExpertMagicNumber(Magic);
 chTrade.SetDeviationInPoints(DeviationPoints);
 chTrade.SetAsyncMode(false);
 if(!chTrade.SetTypeFillingBySymbol(_Symbol))return INIT_FAILED;
 chAuto=StartAutopilot;
 chLastM5=iTime(_Symbol,PERIOD_M5,0);
 CHButton();EventSetTimer(60);
 ACPoll();
 Print("CHAF EXPERIMENTAL v1.21. INDEPENDENT D1/H4/H1/M30, M5 direct CB1. WEEKLY-ONLY 55%+ from web V1 model: ",AC_MODEL,
       ". Weekly panel uses V1 model; browser V2 daily display not interchangeable. Real lock: ",!AllowRealAccount);
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){
 EventKillTimer();ObjectDelete(0,chButton);
 for(int k=0;k<4;k++)if(chEMA[k]!=INVALID_HANDLE)IndicatorRelease(chEMA[k]);
}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){
 if(id==CHARTEVENT_OBJECT_CLICK&&s==chButton){chAuto=!chAuto;CHButton();}
}
void OnTimer(){if(chAuto)ACPoll();}
void OnTick(){
 datetime closeOpen=iTime(_Symbol,PERIOD_M5,0);
 if(closeOpen<=0||closeOpen==chLastM5)return;
 if(chLastM5==0){chLastM5=closeOpen;return;} // Never enter historical bar on initial data load
 MqlRates m[];ArraySetAsSeries(m,true);
 if(CopyRates(_Symbol,PERIOD_M5,0,M5History,m)!=M5History)return;
 chLastM5=closeOpen; // no late replays; next live M5 bar required
 if(!chAuto||(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL&&!AllowRealAccount))return;
 if(!MQLInfoInteger(MQL_TRADE_ALLOWED)||!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||
    !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT))return;
 if(!CHDailyRisk())return;
 HPSetup picks[4];int num=0;
 for(int k=0;k<4;k++){
  if((k==0&&!ScanD1)||(k==1&&!ScanH4)||(k==2&&!ScanH1)||(k==3&&!ScanM30))continue;
  HPSetup s;
  int history=k==0?D1History:(k==1?H4History:(k==2?H1History:M30History));
  int age=k==0?MaxD1DClosedBars:(k==1?MaxH4DClosedBars:(k==2?MaxH1DClosedBars:MaxM30DClosedBars));
  if(!HPFind(chTF[k],PivotDepth,history,age,FibTolerance,MinimumXA_Points,s))continue;
  s.regime=CHRegime(k,s);
  if(s.regime==0 || (StrategyMode==FOLLOW_TREND_ONLY&&s.regime!=1)||
      (StrategyMode==REVERSAL_ONLY&&s.regime!=2))continue;
  picks[num]=s;num++;
 }
 if(num<1)return;
 // Priority: D1, H4, H1, then M30. Every timeframe still scans independently.
 for(int i=0;i<num;i++){
  HPSetup s=picks[i];double level=0;
  // Only the weekly bias decides the permitted direction.
  // Opposite patterns in other timeframes NEVER veto this independent setup.
  if(!ACWeeklyGate(s.dir,closeOpen))continue;
  if(!CHCB1(m,ArraySize(m),s,level))continue;
  s.cb1=level;
  if(CHExecute(s))return; // Skip bad RR/SL candidate; test next independent TF.
 }
}
void OnTradeTransaction(const MqlTradeTransaction &t,const MqlTradeRequest &r,const MqlTradeResult &out){
 if(t.type!=TRADE_TRANSACTION_DEAL_ADD||t.deal==0||t.order==0)return;
 if(!HistoryDealSelect(t.deal))return;
 if(HistoryDealGetString(t.deal,DEAL_SYMBOL)!=_Symbol||
   (ulong)HistoryDealGetInteger(t.deal,DEAL_MAGIC)!=Magic)return;
 long kind=HistoryDealGetInteger(t.deal,DEAL_ENTRY);
 if(kind!=DEAL_ENTRY_IN && kind!=DEAL_ENTRY_OUT)return;
 CHNotify(t.deal,t.order,kind);
}