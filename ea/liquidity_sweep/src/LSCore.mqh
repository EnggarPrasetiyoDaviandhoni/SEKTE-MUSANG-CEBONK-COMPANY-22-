// CEBONK LIQUIDITY SWEEP MT5 v1.00 | web scanner parity.
// TF1 swing/equal-liquidity -> TF2 sweep+displacement+structure-break -> TF3 retest.
// Only completed bars; times are broker-server seconds. No ATR or indicator direction.
#ifndef CEBONK_LS_CORE
#define CEBONK_LS_CORE
#define BW_PACKAGE_COUNT 4
#define BW_LIQ_LOOKBACK 80
#define BW_PIVOT_DEPTH 2
#define BW_SWEEP_SEARCH 18
#define BW_DISPLACEMENT_BARS 3
#define BW_STRUCTURE_LOOKBACK 6
#define BW_BODY_MULT 1.20
#define BW_EQUAL_TOL 0.12
#define BW_MIN_HOLD_SEC 300

struct BWBar {long start,end;double open,high,low,close;};
struct BWPackageSpec {string id;ENUM_TIMEFRAMES tf1,tf2,tf3;};
struct BWSignal {
 bool valid;int dir,pkg;long reAt,tf2At,eventAt,validUntil;
 string tf2Type,liquidityType;double liquidity,structure,sweepExtreme;
 double referenceEntry,structuralSL,rr;
};
struct BWLevel {double price;long knownAt;string type;int index;};

bool BWFin(const double x){return MathIsValidNumber(x)&&x!=EMPTY_VALUE;}
string BWSide(const int d){return d>0?"BUY":d<0?"SELL":"WAIT";}
void BWGetPackage(const int i,BWPackageSpec &p){
 if(i==0){p.id="H4-H1-M15";p.tf1=PERIOD_H4;p.tf2=PERIOD_H1;p.tf3=PERIOD_M15;return;}
 if(i==1){p.id="H1-M15-M5";p.tf1=PERIOD_H1;p.tf2=PERIOD_M15;p.tf3=PERIOD_M5;return;}
 if(i==2){p.id="M30-M5-M1";p.tf1=PERIOD_M30;p.tf2=PERIOD_M5;p.tf3=PERIOD_M1;return;}
 p.id="M15-M5-M1";p.tf1=PERIOD_M15;p.tf2=PERIOD_M5;p.tf3=PERIOD_M1;
}
bool BWLoadClosedBars(const string symbol,const ENUM_TIMEFRAMES tf,const int need,BWBar &out[]){
 ArrayResize(out,0);MqlRates r[];ArraySetAsSeries(r,false);
 int got=CopyRates(symbol,tf,1,need,r);if(got<25)return false;
 int sec=PeriodSeconds(tf);if(sec<=0)return false;
 ArrayResize(out,got);
 for(int i=0;i<got;i++){
  if(!BWFin(r[i].open)||!BWFin(r[i].high)||!BWFin(r[i].low)||!BWFin(r[i].close)||r[i].low<=0||r[i].high<r[i].low)return false;
  out[i].start=(long)r[i].time;out[i].end=(long)r[i].time+sec;
  out[i].open=r[i].open;out[i].high=r[i].high;out[i].low=r[i].low;out[i].close=r[i].close;
 }return true;
}
double BWMedian(const double &data[],const int n){
 if(n<=0)return 0;double a[];ArrayResize(a,n);for(int i=0;i<n;i++)a[i]=data[i];
 ArraySort(a);int mid=n/2;return (n%2==0)?(a[mid-1]+a[mid])/2:a[mid];
}
double BWMedianRange(const BWBar &a[],const int from,const int to){
 double data[];int k=0;ArrayResize(data,MathMax(0,to-from+1));
 for(int i=from;i<=to;i++)data[k++]=a[i].high-a[i].low;
 return BWMedian(data,k);
}
double BWMedianBody(const BWBar &a[],const int index){
 // Web medianBody(t2,j-1) falls back to medianBody(t2,j) when zero.
 for(int pass=0;pass<2;pass++){
  int last=pass==0?index-1:index;if(last<0)continue;
  int first=MathMax(0,last-19),n=last-first+1;double d[];ArrayResize(d,n);
  for(int i=0;i<n;i++)d[i]=MathAbs(a[first+i].close-a[first+i].open);
  double m=BWMedian(d,n);if(m!=0)return m;
 }return 0;
}
void BWAddLevel(BWLevel &levels[],const double price,const long known,const string type,const int index){
 int n=ArraySize(levels);ArrayResize(levels,n+1);
 levels[n].price=price;levels[n].knownAt=known;levels[n].type=type;levels[n].index=index;
}
void BWMapLiquidity(const BWBar &a[],const int dir,BWLevel &levels[]){
 ArrayResize(levels,0);const int total=ArraySize(a),offset=MathMax(0,total-BW_LIQ_LOOKBACK);
 if(total-offset<15)return;
 const int last=total-1,first=offset,pd=BW_PIVOT_DEPTH;
 double ranges=BWMedianRange(a,MathMax(offset,total-30),last),tol=MathMax(1.0e-9,ranges*BW_EQUAL_TOL);
 BWLevel src[];ArrayResize(src,0);
 for(int i=first+pd;i<=last-pd;i++){
  bool hi=true,lo=true;
  for(int k=1;k<=pd;k++){
   if(a[i].high<=a[i-k].high||a[i].high<a[i+k].high)hi=false;
   if(a[i].low>=a[i-k].low||a[i].low>a[i+k].low)lo=false;
  }
  if((dir>0&&lo)||(dir<0&&hi)){
   BWAddLevel(src,dir>0?a[i].low:a[i].high,a[i+pd].end,dir>0?"SWING_LOW":"SWING_HIGH",i);
  }
 }
 int n=ArraySize(src),from=MathMax(0,n-12);
 for(int i=from;i<n;i++)BWAddLevel(levels,src[i].price,src[i].knownAt,src[i].type,src[i].index);
 for(int i=1;i<n;i++)if(MathAbs(src[i].price-src[i-1].price)<=tol){
  BWAddLevel(levels,(src[i].price+src[i-1].price)/2,MathMax(src[i].knownAt,src[i-1].knownAt),dir>0?"EQUAL_LOW":"EQUAL_HIGH",src[i].index);
 }
 // Sort by newest knownAt and keep exactly 12 levels like mapLiquidity() on web.
 for(int i=0;i<ArraySize(levels);i++)for(int j=i+1;j<ArraySize(levels);j++){
  if(levels[j].knownAt>levels[i].knownAt){BWLevel t=levels[i];levels[i]=levels[j];levels[j]=t;}
 }
 if(ArraySize(levels)>12)ArrayResize(levels,12);
}
int BWFirstEndAtOrAfter(const BWBar &a[],const long stamp){
 for(int i=0;i<ArraySize(a);i++)if(a[i].end>=stamp)return i;return -1;
}
int BWHoldSeconds(const ENUM_TIMEFRAMES tf){
 return MathMax(PeriodSeconds(tf),BW_MIN_HOLD_SEC);
}
bool BWScanDirection(const string symbol,const int pkgIndex,const int dir,const long now,
 const double rr,const double buffer,const int barsNeeded,BWSignal &out,string &why){
 ZeroMemory(out);out.dir=dir;out.pkg=pkgIndex;out.rr=rr;why="";
 BWPackageSpec p;BWGetPackage(pkgIndex,p);BWBar a[],b[],c[];
 if(!BWLoadClosedBars(symbol,p.tf1,barsNeeded,a)||!BWLoadClosedBars(symbol,p.tf2,barsNeeded,b)||!BWLoadClosedBars(symbol,p.tf3,barsNeeded,c)){
  why="DATA_KURANG";return false;
 }
 BWLevel levels[];BWMapLiquidity(a,dir,levels);
 if(ArraySize(levels)==0){why="TF1_LIQUIDITY_WAIT";return false;}
 const int bStart=MathMax(1,ArraySize(b)-BW_SWEEP_SEARCH),hold=BWHoldSeconds(p.tf3);
 BWSignal best;ZeroMemory(best);bool found=false;long latestExpired=0;
 for(int li=0;li<ArraySize(levels);li++){
  BWLevel level=levels[li];
  for(int i=bStart;i<ArraySize(b);i++){
   BWBar s=b[i];if(s.end<level.knownAt)continue;
   bool swept=dir>0?(s.low<level.price&&s.close>level.price):(s.high>level.price&&s.close<level.price);
   if(!swept)continue;
   int preStart=MathMax(0,i-BW_STRUCTURE_LOOKBACK);if(i-preStart<3)continue;
   double structure=dir>0?b[preStart].high:b[preStart].low;
   for(int h=preStart+1;h<i;h++)structure=dir>0?MathMax(structure,b[h].high):MathMin(structure,b[h].low);
   int displacement=-1;
   for(int j=i;j<=MathMin(ArraySize(b)-1,i+BW_DISPLACEMENT_BARS);j++){
    BWBar x=b[j];double body=MathAbs(x.close-x.open),mb=BWMedianBody(b,j);
    bool directional=dir>0?x.close>x.open:x.close<x.open;
    bool broken=dir>0?x.close>structure:x.close<structure;
    if(directional&&broken&&body>=mb*BW_BODY_MULT){displacement=j;break;}
   }
   if(displacement<0)continue;
   long breakAt=b[displacement].end;int ci0=BWFirstEndAtOrAfter(c,breakAt);if(ci0<0)continue;
   for(int k=ArraySize(c)-1;k>=ci0;k--){
    BWBar x=c[k];
    bool retest=dir>0?(x.low<=structure&&x.close>structure):(x.high>=structure&&x.close<structure);
    if(!retest||now<x.end)continue;
    long until=x.end+hold;
    if(now>=until){latestExpired=MathMax(latestExpired,x.end);continue;}
    double sl=dir>0?s.low-buffer:s.high+buffer;
    double risk=MathAbs(x.close-sl),tp=dir>0?x.close+risk*rr:x.close-risk*rr;
    if(!(risk>0&&BWFin(tp)))continue;
    BWSignal cand;ZeroMemory(cand);cand.valid=true;cand.dir=dir;cand.pkg=pkgIndex;cand.rr=rr;
    cand.reAt=s.end;cand.tf2At=breakAt;cand.eventAt=x.end;cand.validUntil=until;
    cand.referenceEntry=x.close;cand.structuralSL=sl;cand.liquidity=level.price;cand.liquidityType=level.type;
    cand.structure=structure;cand.sweepExtreme=dir>0?s.low:s.high;cand.tf2Type="SWEEP+DISPLACEMENT+BREAK";
    if(!found||cand.eventAt>best.eventAt||(cand.eventAt==best.eventAt&&cand.reAt>best.reAt)){
     best=cand;found=true;
    }
    break;
   }
  }
 }
 if(found){out=best;return true;}
 why=latestExpired>0?"SIGNAL_EXPIRED":"SWEEP_BREAK_RETEST_WAIT";return false;
}
#endif
