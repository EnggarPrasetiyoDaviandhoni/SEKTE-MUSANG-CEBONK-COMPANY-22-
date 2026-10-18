#ifndef CEBONK_SWING_NUMERIC_CORE_MQH
#define CEBONK_SWING_NUMERIC_CORE_MQH
#include "Types.mqh"
#include "PolicyCore.mqh"
bool CSValidBars(CS_CONST_ARRAY(CSBar,a)){
 for(int i=0;i<ArraySize(a);i++){
  if(a[i].time<=0||(i>0&&a[i].time<=a[i-1].time)||!CSFinite(a[i].high)||!CSFinite(a[i].low)||
   !CSFinite(a[i].open)||!CSFinite(a[i].close)||a[i].low<=0||a[i].high<a[i].low||
   a[i].high<CSMax(a[i].open,a[i].close)||a[i].low>CSMin(a[i].open,a[i].close))return false;
 }
 return ArraySize(a)>0;
}
bool CSPivot(CS_CONST_ARRAY(CSBar,a),int i,int left,int right,int side,int knownLast){
 if(left<1||right<1||i<left||i+right>knownLast||knownLast>=ArraySize(a))return false;
 for(int k=i-left;k<=i+right;k++)if(k!=i){
  if(side>0&&a[i].high<=a[k].high)return false;
  if(side<0&&a[i].low>=a[k].low)return false;
 }
 return true;
}
int CSLastPivot(CS_CONST_ARRAY(CSBar,a),int before,int left,int right,int side,bool unbroken){
 for(int p=before-right;p>=left;p--){
  if(!CSPivot(a,p,left,right,side,before))continue;
  bool fresh=true;
  if(unbroken)for(int j=p+right+1;j<=before;j++)
   if((side>0&&a[j].close>a[p].high)||(side<0&&a[j].close<a[p].low)){fresh=false;break;}
  if(fresh)return p;
 }
 return -1;
}
int CSH4Direction(CS_CONST_ARRAY(CSBar,a),int lr=3){
 int highs[2],lows[2],nh=0,nl=0,n=ArraySize(a);
 if(n<160)return -2;
 for(int i=n-lr-1;i>=lr&&(nh<2||nl<2);i--){
  if(nh<2&&CSPivot(a,i,lr,lr,1,n-1))highs[nh++]=i;
  if(nl<2&&CSPivot(a,i,lr,lr,-1,n-1))lows[nl++]=i;
 }
 if(nh<2||nl<2)return -2;
 if(a[highs[0]].high>a[highs[1]].high&&a[lows[0]].low>a[lows[1]].low)return 1;
 if(a[highs[0]].high<a[highs[1]].high&&a[lows[0]].low<a[lows[1]].low)return -1;
 return 0;
}
bool CSDisplacement(CS_CONST_ARRAY(CSBar,a),int i,int side){
 if(i<20||i>=ArraySize(a)||CSSign(a[i].close-a[i].open)!=side)return false;
 double range=a[i].high-a[i].low;
 if(range<=0||MathAbs(a[i].close-a[i].open)/range<0.60)return false;
 double values[20];
 for(int j=0;j<20;j++)values[j]=a[i-20+j].high-a[i-20+j].low;
 for(int j=1;j<20;j++){double v=values[j];int k=j-1;while(k>=0&&values[k]>v){values[k+1]=values[k];k--;}values[k+1]=v;}
 return range>=(values[9]+values[10])/2.0;
}
bool CSBuildZone(CS_CONST_ARRAY(CSBar,a),int displacement,int side,double minWidth,CSSetup &s){
 int n=ArraySize(a),i=displacement;
 if(i>0&&i+1<n){
  double lo=side>0?a[i-1].high:a[i+1].high;
  double hi=side>0?a[i+1].low:a[i-1].low;
  if(hi-lo>=minWidth){s.low=lo;s.high=hi;s.birth=a[i+1].time+3600;return true;}
 }
 for(int j=i-1;j>=0&&j>=i-12;j--){
  if(CSSign(a[j].close-a[j].open)==-side&&a[j].high>a[j].low){
   s.low=a[j].low;s.high=a[j].high;s.birth=a[i].time+3600;return true;
  }
 }
 return false;
}
bool CSSetupFresh(CS_CONST_ARRAY(CSBar,a),const CSSetup &s,datetime now){
 if(now<s.birth||now-s.birth>36*3600)return false;
 for(int j=0;j<ArraySize(a);j++)if(a[j].time+3600>=s.birth){
  if((s.side>0&&(a[j].close<s.low||a[j].close<s.invalidExtreme))||
     (s.side<0&&(a[j].close>s.high||a[j].close>s.invalidExtreme)))return false;
 }
 return true;
}
void CSAddSetup(CS_ARRAY(CSSetup,out),const CSSetup &s){
 int n=ArraySize(out);if(n>=64)return;ArrayResize(out,n+1);out[n]=s;
}
void CSH1Setups(CS_CONST_ARRAY(CSBar,a),CS_CONST_ARRAY(CSLevel,levels),int side,int h4,
 double tick,double spread,datetime now,CS_ARRAY(CSSetup,out)){
 ArrayResize(out,0);int n=ArraySize(a);
 if(n<160||h4==-2||(h4!=0&&h4!=side))return;
 // Model A first; reverse chronological sweep, then earliest confirmed MSS.
 for(int i=n-2;i>=22;i--){
  if(now-(a[i].time+3600)>44*3600)break;
  bool swept=false;double price=0;
  for(int l=0;l<ArraySize(levels);l++){
   const CSLevel v=levels[l];
   if(v.side!=-side||v.known>a[i].time||(v.consumed>0&&v.consumed<a[i].time))continue;
   bool hit=side>0?(a[i].low<v.price-tick&&a[i].close>v.price):(a[i].high>v.price+tick&&a[i].close<v.price);
   if(hit&&(!swept||(side>0?v.price>price:v.price<price))){price=v.price;swept=true;}
  }
  if(!swept)continue;
  int pivot=CSLastPivot(a,i-1,2,2,side,true);if(pivot<0)continue;
  double level=side>0?a[pivot].high:a[pivot].low;
  for(int j=i+1;j<n&&j<=i+8;j++){
   bool broken=side>0?a[j].close>=level+tick:a[j].close<=level-tick;
   if(!broken)continue;
   if(!CSDisplacement(a,j,side))break; // First close break cannot be relabelled later.
   CSSetup s;s.side=side;s.model=1;s.origin=a[i].time+3600;s.structure=a[j].time+3600;
   s.invalidExtreme=side>0?a[i].low:a[i].high;s.liquidity=price;
   if(CSBuildZone(a,j,side,CSMax(2*tick,spread),s)&&CSSetupFresh(a,s,now))CSAddSetup(out,s);
   break;
  }
 }
 if(h4!=side)return;
 for(int j=n-1;j>=22;j--){
  if(now-(a[j].time+3600)>36*3600)break;
  int p=CSLastPivot(a,j-1,2,2,side,true);if(p<0)continue;
  double level=side>0?a[p].high:a[p].low;
  if(!(side>0?a[j].close>=level+tick:a[j].close<=level-tick)||!CSDisplacement(a,j,side))continue;
  int opposite=CSLastPivot(a,j-1,2,2,-side,false);if(opposite<0)continue;
  CSSetup s;s.side=side;s.model=2;s.origin=a[j].time+3600;s.structure=s.origin;
  s.invalidExtreme=side>0?a[opposite].low:a[opposite].high;s.liquidity=level;
  if(CSBuildZone(a,j,side,CSMax(2*tick,spread),s)&&CSSetupFresh(a,s,now))CSAddSetup(out,s);
 }
}
datetime CSM15Gate(CS_CONST_ARRAY(CSBar,a),const CSSetup &s,datetime windowStart,datetime windowEnd){
 for(int i=1;i<ArraySize(a);i++){
  datetime closed=a[i].time+900;if(closed<s.birth)continue;
  if(closed>s.birth+32*900)return 0;
  bool touch=a[i].low<=s.high&&a[i].high>=s.low;
  bool valid=s.side>0?(a[i].close>a[i].open&&a[i].close>=s.low&&a[i].close>a[i-1].close):
                      (a[i].close<a[i].open&&a[i].close<=s.high&&a[i].close<a[i-1].close);
  if(touch&&valid){
   // First valid mitigation owns this zone; never reuse an old retest.
   return closed>=windowStart&&closed<windowEnd?closed:0;
  }
 }
 return 0;
}
bool CSValidSLFibLevel(double level){return CSFinite(level)&&level<0;}
bool CSSL(int side,double zoneLow,double zoneHigh,double f0,double f1,double tick,double level,double &raw,double &sl){
 if(!CSValidSLFibLevel(level)||!CSFinite(tick)||tick<=0||!CSFinite(f0)||!CSFinite(f1)||zoneLow<=0||zoneHigh<=zoneLow)return false;
 double span=f1-f0;if(side*span<=0||MathAbs(span)<2*tick)return false;
 raw=f0+level*span;if(!CSFinite(raw))return false;
 sl=side>0?MathFloor(raw/tick+1e-10)*tick:MathCeil(raw/tick-1e-10)*tick;
 return CSFinite(sl)&&sl>0&&MathAbs(sl-raw)<tick+1e-9&&(side>0?sl<zoneLow:sl>zoneHigh);
}
bool CSDominantExit(CS_CONST_ARRAY(CSBar,a),double tick,int minInside,int maxInside,CSDominant &out){
 int n=ArraySize(a);if(n<minInside+2||tick<=0||minInside<3||maxInside>12)return false;
 int b=n-1;out.side=0;
 for(int k=minInside;k<=maxInside;k++){
  int m=b-k-1;if(m<0||a[m].high<=a[m].low)continue;
  bool inside=true;for(int c=m+1;c<b;c++)if(a[c].high>a[m].high||a[c].low<a[m].low){inside=false;break;}
  if(!inside)continue;
  int side=0;
  if(a[b].close>a[b].open&&a[b].close>=a[m].high+tick-1e-9)side=1;
  if(a[b].close<a[b].open&&a[b].close<=a[m].low-tick+1e-9)side=-1;
  if(!side)continue;
  out.side=side;out.children=k;out.mother=a[m].time;out.breakClose=a[b].time+900;
  out.high=a[m].high;out.low=a[m].low;return true;
 }
 return false;
}
// EL2 only: confirmed IB -> distinct post-IB CB1 pivot -> closed break ->
// first closed rejection/retest of the original wick-to-body IB zone.
bool CSM5EL2(CS_CONST_ARRAY(CSBar,a),int side,datetime gate,datetime windowEnd,double tick,
 int maxGateBars,int maxIBBreakBars,int maxRetestBars,double slFibLevel,CSMicro &out){
 int n=ArraySize(a),r=n-1;
 if(n<12||!CSValidBars(a)||side*side!=1||tick<=0||gate<=0||a[r].time+300>=windowEnd)return false;
 for(int ib=5;ib<r;ib++){
  datetime ibClose=a[ib].time+300;if(ibClose<=gate||CSSign(a[ib].close-a[ib].open)!=side)continue;
  int age=0;for(int k=ib;k>=0&&a[k].time+300>gate;k--)age++;
  if(age>maxGateBars)continue;
  int level=CSLastPivot(a,ib-1,2,2,side,true),anchor=CSLastPivot(a,ib-1,2,2,-side,false);
  if(level<0||anchor<0)continue;
  double ibLevel=side>0?a[level].high:a[level].low;
  if(side*(a[ib].close-ibLevel)<tick-1e-9)continue;
  double lo=side>0?a[anchor].low:CSMax(a[anchor].open,a[anchor].close);
  double hi=side>0?CSMin(a[anchor].open,a[anchor].close):a[anchor].high;
  if(hi<=lo)continue;
  bool invalid=false;
  for(int k=anchor+3;k<=ib;k++)if(side>0?a[k].close<lo:a[k].close>hi){invalid=true;break;}
  if(invalid)continue;
  // The earliest eligible CB1 pivot/break owns this IB; no later retest replay.
  for(int b=ib+4;b<r&&b-ib<=maxIBBreakBars;b++){
   if(side>0?a[b].close<lo:a[b].close>hi)break;
   int cb=-1;
   for(int p=ib+1;p+2<b;p++){
    if(!CSPivot(a,p,2,2,side,b-1))continue;
    double v=side>0?a[p].high:a[p].low;
    if(side*(v-ibLevel)<tick-1e-9||(side>0?hi>=v:lo<=v))continue;
    bool first=true;
    for(int k=p+3;k<b;k++)if(side*(a[k].close-v)>=tick-1e-9){first=false;break;}
    if(first&&CSSign(a[b].close-a[b].open)==side&&side*(a[b].close-v)>=tick-1e-9){cb=p;break;}
   }
   if(cb<0)continue;
   for(int k=ib+1;k<=b;k++)if(side>0?a[k].close<lo:a[k].close>hi){invalid=true;break;}
   if(invalid)break;
   int firstRetest=-1;
   for(int k=b+1;k<=r&&k-b<=maxRetestBars;k++){
    if(side>0?a[k].close<lo:a[k].close>hi){invalid=true;break;}
    if(a[k].low<=hi&&a[k].high>=lo&&CSSign(a[k].close-a[k].open)==side&&
       (side>0?a[k].close>hi:a[k].close<lo)){firstRetest=k;break;}
   }
   if(invalid||firstRetest!=r)break;
   double f0=side>0?hi:lo,raw=0,sl=0;
   if(!CSSL(side,lo,hi,f0,a[b].close,tick,slFibLevel,raw,sl))break;
   out.side=side;out.kind=2;out.children=0;out.source=a[anchor].time;
   out.ibClose=ibClose;out.cb1Pivot=a[cb].time;out.breakClose=a[b].time+300;
   out.retestClose=a[r].time+300;out.zoneLow=lo;out.zoneHigh=hi;out.fib0=f0;
   out.fib1=a[b].close;out.slRaw=raw;out.sl=sl;out.breakLevel=side>0?a[cb].high:a[cb].low;
   return true;
  }
  // A later IB must not silently replace the first valid IB for this M15 gate.
  return false;
 }
 return false;
}
double CSRR(int side,double entry,double sl,double tp){
 double risk=side*(entry-sl),reward=side*(tp-entry);
 return risk>0&&reward>0&&CSFinite(risk)&&CSFinite(reward)?reward/risk:-1;
}
bool CSShouldExit(int positionSide,int signalSide,double estimatedNet,bool costsVerified){
 return costsVerified&&positionSide!=0&&signalSide==-positionSide&&CSFinite(estimatedNet)&&estimatedNet>0;
}
double CSDealNetContribution(double profit,double swap,double commission,double fee){
 return profit+swap+commission+fee;
}
bool CSRiskCap(double cash,double equity,double maximumPct){
 return CSFinite(cash)&&CSFinite(equity)&&cash>=0&&equity>0&&maximumPct>0&&maximumPct<=1&&cash<=equity*maximumPct/100.0;
}
bool CSPriceAfterEL2Retest(int side,double bid,double ask,const CSMicro &m){
 double entry=side>0?ask:bid;
 return bid>0&&ask>=bid&&(side>0?entry>m.zoneHigh:entry<m.zoneLow);
}
#endif
