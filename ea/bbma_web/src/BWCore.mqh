// CEBONK BBMA WEB EA v1.01 - deterministic BBMA core.
// Port of assets/technical-scanners-core.js BBMA rules only.
// Closed candles only. No ATR, martingale, recovery, BE, trailing, or layering.
#ifndef CEBONK_BW_CORE
#define CEBONK_BW_CORE

#define BW_BB_PERIOD 20
#define BW_BB_DEV 2.0
#define BW_FAST 5
#define BW_SLOW 10
#define BW_RE_AGE 6
#define BW_TF2_AGE 6
#define BW_TF3_AGE 6
#define BW_PACKAGE_COUNT 4
#define BW_MIN_SIGNAL_HOLD_SEC 300

struct BWBar {
 long start;
 long end;
 double open,high,low,close;
 double mid,upper,lower;
 double ma5h,ma10h,ma5l,ma10l;
};

struct BWPackageSpec {
 string id;
 ENUM_TIMEFRAMES tf1,tf2,tf3;
};

struct BWSignal {
 bool valid;
 int dir;              // BUY=1, SELL=-1
 int pkg;              // 0..3
 long reAt,tf2At,eventAt,validUntil;
 string tf2Type;       // CSAK / CSM
 double referenceEntry;
 double structuralSL;
 double rr;
};

bool BWFin(const double x){ return MathIsValidNumber(x) && x!=EMPTY_VALUE; }
string BWSide(const int dir){ return dir>0?"BUY":dir<0?"SELL":"WAIT"; }

void BWGetPackage(const int i,BWPackageSpec &p){
 if(i==0){p.id="H4-H1-M15";p.tf1=PERIOD_H4;p.tf2=PERIOD_H1;p.tf3=PERIOD_M15;return;}
 if(i==1){p.id="H1-M15-M5";p.tf1=PERIOD_H1;p.tf2=PERIOD_M15;p.tf3=PERIOD_M5;return;}
 if(i==2){p.id="M30-M5-M1";p.tf1=PERIOD_M30;p.tf2=PERIOD_M5;p.tf3=PERIOD_M1;return;}
 p.id="M15-M5-M1";p.tf1=PERIOD_M15;p.tf2=PERIOD_M5;p.tf3=PERIOD_M1;
}

double BWLWMA(const double &v[],const int period,const int i){
 if(i<period-1)return EMPTY_VALUE;
 double n=0.0,d=0.0;
 for(int k=0;k<period;k++){ double w=(double)(period-k);n+=v[i-k]*w;d+=w; }
 return d>0?n/d:EMPTY_VALUE;
}
double BWSMA(const double &v[],const int period,const int i){
 if(i<period-1)return EMPTY_VALUE;
 double s=0.0;for(int k=0;k<period;k++)s+=v[i-k];return s/period;
}
void BWBand(const double &v[],const int period,const double dev,const int i,double &mid,double &upper,double &lower){
 mid=BWSMA(v,period,i);upper=lower=EMPTY_VALUE;if(!BWFin(mid))return;
 double s=0.0;for(int k=0;k<period;k++){double d=v[i-k]-mid;s+=d*d;}
 double sd=MathSqrt(s/period);upper=mid+dev*sd;lower=mid-dev*sd;
}

bool BWLoadClosedBars(const string symbol,const ENUM_TIMEFRAMES tf,const int need,BWBar &out[]){
 ArrayResize(out,0);MqlRates r[];ArraySetAsSeries(r,false);
 ResetLastError();int got=CopyRates(symbol,tf,1,need,r);
 if(got<35)return false;
 ArrayResize(out,got);
 double h[],l[],c[];ArrayResize(h,got);ArrayResize(l,got);ArrayResize(c,got);
 int sec=PeriodSeconds(tf);if(sec<=0)return false;
 for(int i=0;i<got;i++){
  if(!BWFin(r[i].open)||!BWFin(r[i].high)||!BWFin(r[i].low)||!BWFin(r[i].close)||r[i].low<=0||r[i].high<r[i].low)return false;
  out[i].start=(long)r[i].time;out[i].end=(long)r[i].time+sec;
  out[i].open=r[i].open;out[i].high=r[i].high;out[i].low=r[i].low;out[i].close=r[i].close;
  h[i]=r[i].high;l[i]=r[i].low;c[i]=r[i].close;
 }
 for(int i=0;i<got;i++){
  BWBand(c,BW_BB_PERIOD,BW_BB_DEV,i,out[i].mid,out[i].upper,out[i].lower);
  out[i].ma5h=BWLWMA(h,BW_FAST,i);out[i].ma10h=BWLWMA(h,BW_SLOW,i);
  out[i].ma5l=BWLWMA(l,BW_FAST,i);out[i].ma10l=BWLWMA(l,BW_SLOW,i);
 }
 return true;
}

bool BWIndicatorOK(const BWBar &x){
 return BWFin(x.mid)&&BWFin(x.upper)&&BWFin(x.lower)&&BWFin(x.ma5h)&&BWFin(x.ma10h)&&BWFin(x.ma5l)&&BWFin(x.ma10l);
}

bool BWReentryAt(const BWBar &e[],const int i,const int dir){
 if(i<0||i>=ArraySize(e)||!BWIndicatorOK(e[i]))return false;
 BWBar x=e[i];
 if(dir>0){
  double lo=MathMin(x.ma5l,x.ma10l),hi=MathMax(x.ma5l,x.ma10l),bodyLo=MathMin(x.open,x.close);
  return x.low<=hi&&x.high>=lo&&bodyLo>hi&&x.close>hi&&x.ma5l>x.mid&&x.ma10l>x.mid;
 }
 double lo=MathMin(x.ma5h,x.ma10h),hi=MathMax(x.ma5h,x.ma10h),bodyHi=MathMax(x.open,x.close);
 return x.high>=lo&&x.low<=hi&&bodyHi<lo&&x.close<lo&&x.ma5h<x.mid&&x.ma10h<x.mid;
}

bool BWCSAKAt(const BWBar &e[],const int i,const int dir){
 if(i<1||i>=ArraySize(e)||!BWIndicatorOK(e[i])||!BWIndicatorOK(e[i-1]))return false;
 BWBar x=e[i],p=e[i-1];
 if(dir>0){
  double cur=MathMax(x.ma5h,MathMax(x.ma10h,x.mid));
  double prv=MathMax(p.ma5h,MathMax(p.ma10h,p.mid));
  return x.close>x.open&&x.close>cur&&MathMin(x.open,p.close)<=prv;
 }
 double cur=MathMin(x.ma5l,MathMin(x.ma10l,x.mid));
 double prv=MathMin(p.ma5l,MathMin(p.ma10l,p.mid));
 return x.close<x.open&&x.close<cur&&MathMax(x.open,p.close)>=prv;
}

bool BWCSMAt(const BWBar &e[],const int i,const int dir){
 if(i<1||i>=ArraySize(e)||!BWIndicatorOK(e[i])||!BWIndicatorOK(e[i-1]))return false;
 BWBar x=e[i],p=e[i-1];
 if(dir>0)return x.close>x.open&&x.close>x.upper&&(x.open<=x.upper||p.close<=p.upper);
 return x.close<x.open&&x.close<x.lower&&(x.open>=x.lower||p.close>=p.lower);
}

int BWFirstEndAtOrAfter(const BWBar &e[],const long ms){
 for(int i=0;i<ArraySize(e);i++)if(e[i].end>=ms)return i;return -1;
}
int BWAtOrBefore(const BWBar &e[],const long ms){
 int idx=-1;for(int i=0;i<ArraySize(e);i++){if(e[i].end<=ms)idx=i;else break;}return idx;
}

int BWSignalHoldSeconds(const ENUM_TIMEFRAMES tf){
 int step=PeriodSeconds(tf);if(step<=0)return 0;return MathMax(step,BW_MIN_SIGNAL_HOLD_SEC);
}

bool BWScanDirection(const string symbol,const int pkgIndex,const int dir,const long nowServer,
 const double rr,const double slBuffer,const int barsNeeded,BWSignal &out,string &why){
 ZeroMemory(out);out.dir=dir;out.pkg=pkgIndex;out.rr=rr;why="";
 BWPackageSpec p;BWGetPackage(pkgIndex,p);
 BWBar a[],b[],c[];
 if(!BWLoadClosedBars(symbol,p.tf1,barsNeeded,a)||!BWLoadClosedBars(symbol,p.tf2,barsNeeded,b)||!BWLoadClosedBars(symbol,p.tf3,barsNeeded,c)){
  why="DATA_KURANG";return false;
 }
 int reStart=MathMax(BW_BB_PERIOD,ArraySize(a)-1-BW_RE_AGE),ri=-1;
 for(int i=ArraySize(a)-1;i>=reStart;i--)if(BWReentryAt(a,i,dir)){ri=i;break;}
 if(ri<0){why="TF1_REENTRY_WAIT";return false;}
 long reEnd=a[ri].end;
 int bi0=BWFirstEndAtOrAfter(b,reEnd);if(bi0<0){why="TF2_AFTER_REENTRY_WAIT";return false;}
 int bi=-1;string type="";
 int bEnd=MathMin(ArraySize(b)-1,bi0+BW_TF2_AGE);
 for(int i=bi0;i<=bEnd;i++){
  bool csak=BWCSAKAt(b,i,dir),csm=BWCSMAt(b,i,dir);
  if(csak||csm){bi=i;type=csak?"CSAK":"CSM";break;}
 }
 if(bi<0){why="TF2_CSAK_CSM_WAIT";return false;}
 long confirmEnd=b[bi].end;
 int ci0=BWFirstEndAtOrAfter(c,confirmEnd);if(ci0<0){why="TF3_AFTER_TF2_WAIT";return false;}
 int ci=-1,cEnd=MathMin(ArraySize(c)-1,ci0+BW_TF3_AGE);
 for(int i=ci0;i<=cEnd;i++)if(BWCSMAt(c,i,dir)){ci=i;break;}
 if(ci<0){why="TF3_CSM_WAIT";return false;}
 BWBar event=c[ci];int hold=BWSignalHoldSeconds(p.tf3);long validUntil=event.end+hold;
 if(hold<=0||nowServer<event.end||nowServer>=validUntil){why="SIGNAL_EXPIRED";return false;}
 int t2i=BWAtOrBefore(b,event.end);if(t2i<0||!BWIndicatorOK(b[t2i])){why="TF2_SL_DATA_WAIT";return false;}
 double sl=dir>0?b[t2i].lower-slBuffer:b[t2i].upper+slBuffer;
 double risk=MathAbs(event.close-sl);
 if(!(risk>0&&BWFin(sl))){why="RISK_INVALID";return false;}
 out.valid=true;out.reAt=reEnd;out.tf2At=confirmEnd;out.eventAt=event.end;out.validUntil=validUntil;out.tf2Type=type;
 out.referenceEntry=event.close;out.structuralSL=sl;
 return true;
}

bool BWLatestCutSignal(const string symbol,const int pkgIndex,const int dir,bool &oppositeCSM,bool &midBreak){
 oppositeCSM=false;midBreak=false;BWPackageSpec p;BWGetPackage(pkgIndex,p);BWBar t2[],t3[];
 if(!BWLoadClosedBars(symbol,p.tf2,40,t2)||!BWLoadClosedBars(symbol,p.tf3,40,t3))return false;
 int i2=ArraySize(t2)-1,i3=ArraySize(t3)-1;if(i2<1||i3<1)return false;
 oppositeCSM=BWCSMAt(t3,i3,-dir);
 if(!BWIndicatorOK(t2[i2]))return false;
 midBreak=dir>0?t2[i2].close<t2[i2].mid:t2[i2].close>t2[i2].mid;
 return true;
}
#endif
