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
