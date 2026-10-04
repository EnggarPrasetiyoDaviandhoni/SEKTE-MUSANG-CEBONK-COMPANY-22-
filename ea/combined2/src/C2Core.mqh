// CEBONK COMBINED 2 native core v1.00.
// Port of auto-combined-core v3.1.0 and snd-auto-core at 35ce78b4.
// Engineering subset of PDF Level 2, NOT every discretionary workbook setup.
#ifndef CEBONK_C2_CORE
#define CEBONK_C2_CORE
struct C2Bar { long time,end; double open,high,low,close; };
struct C2Pivot { int i,kind; long known; double price; }; // kind: 1 high, -1 low
struct C2Zone {
 int tf,dir,kind,status,tests; // kind 0=SNR,1=SND; status 0=fresh,1=tested,2=broken,3=gap
 long origin,born,departed; double low,high,scale;
};
struct C2Key { int tf; long source,known; double price; };
struct C2Rank { int conf,nested,keys; };
enum C2_STAGE { C2_NONE=0,C2_WAIT_BREAK=1,C2_WAIT_RETEST=2,C2_VALID=3,C2_EXPIRED=4,C2_INVALID=5,C2_AMBIGUOUS=6,C2_GAP=7,C2_EARLY_BREAK=8,C2_CONFLICT=9 };
struct C2Event {
 int stage,dir; long first,extreme,ib,known,eventStart,eventEnd,expires,breakAt;
 double low,high,cb,distal,sl,fib0,fib100,entry,tp1,tp2,tp3;
};
bool C2Overlap(const double al,const double ah,const double bl,const double bh) { return al<=bh&&ah>=bl; }
bool C2PivotAt(const C2Bar &b[],const int i,const int kind) {
 int n=ArraySize(b);if(i<2||i+2>=n)return false;
 for(int k=1;k<=2;k++){
  if(kind==1&&(b[i].high<=b[i-k].high||b[i].high<=b[i+k].high))return false;
  if(kind==-1&&(b[i].low>=b[i-k].low||b[i].low>=b[i+k].low))return false;
 }return true;
}
void C2Pivots(const C2Bar &b[],C2Pivot &out[]) {
 ArrayResize(out,0);
 for(int i=2;i<ArraySize(b)-2;i++)for(int pass=0;pass<2;pass++){
  int kind=pass==0?1:-1;if(!C2PivotAt(b,i,kind))continue;
  int n=ArraySize(out);ArrayResize(out,n+1);out[n].i=i;out[n].kind=kind;
  out[n].known=b[i+2].end;out[n].price=kind==1?b[i].high:b[i].low;
 }
}
bool C2Contiguous(const C2Bar &b[],const int from,const int to,const int step) {
 for(int i=from+1;i<=to;i++)if(b[i].time-b[i-1].time!=step)return false;return true;
}
void C2Evaluate(C2Event &s,const C2Bar &b[],const int start,const int step,const long now) {
 s.stage=C2_WAIT_BREAK;int broken=-1,event=-1,n=ArraySize(b);
 if(!C2Contiguous(b,start,n-1,step)){s.stage=C2_GAP;return;}
 for(int i=start;i<n;i++){
  if(s.dir==1?b[i].close<s.distal:b[i].close>s.distal){s.stage=C2_INVALID;return;}
  if(broken<0&&(s.dir==1?b[i].close>s.cb:b[i].close<s.cb)){
   if(b[i].end<s.known){s.stage=C2_EARLY_BREAK;return;}
   broken=i;continue;
  }
  if(broken>=0&&b[i].time>=b[broken].end&&b[i].time>=s.known&&C2Overlap(b[i].low,b[i].high,s.low,s.high)){event=i;break;}
 }
 if(broken<0)return;
 s.fib100=b[broken].close;s.breakAt=b[broken].end;
 if(s.dir*(s.fib100-s.fib0)<=0){s.stage=C2_INVALID;return;}
 if(event<0){s.stage=C2_WAIT_RETEST;return;}
 s.entry=s.dir==1?MathMin(s.high,b[event].high):MathMax(s.low,b[event].low);
 s.eventStart=b[event].time;s.eventEnd=b[event].end;s.expires=s.eventEnd+step;
 double range=s.fib100-s.fib0;
 s.tp1=s.fib0+1.618*range;s.tp2=s.fib0+2.618*range;s.tp3=s.fib0+4.23*range;
 bool hitSL=s.dir==1?b[event].low<=s.sl:b[event].high>=s.sl;
 bool hitTP=s.dir==1?(b[event].high>=s.tp1||b[event].high>=s.tp2||b[event].high>=s.tp3):(b[event].low<=s.tp1||b[event].low<=s.tp2||b[event].low<=s.tp3);
 if(hitSL||hitTP){s.stage=C2_AMBIGUOUS;return;}
 if(s.dir*(s.entry-s.sl)<=0||s.dir*(s.tp1-s.entry)<=0||s.dir*(s.tp2-s.entry)<=0||s.dir*(s.tp3-s.entry)<=0){s.stage=C2_INVALID;return;}
 if(now<s.eventEnd||now>=s.expires||event!=n-1){s.stage=C2_EXPIRED;return;}
 s.stage=C2_VALID;
}
void C2Musang(const C2Bar &b[],const int step,const long now,C2Event &out) {
 ZeroMemory(out);int n=ArraySize(b);if(n<6)return;
 C2Pivot p[];C2Pivots(b,p);C2Event live,waiting,other;ZeroMemory(live);ZeroMemory(waiting);ZeroMemory(other);
 bool hasLive=false,hasWait=false,hasOther=false,conflict=false;
 for(int pass=0;pass<2;pass++){
  int kind=pass==0?1:-1,previous=-1,dir=pass==0?-1:1;
  for(int q=0;q<ArraySize(p);q++){
   if(p[q].kind!=kind)continue;int prev=previous;previous=q;if(prev<0)continue;
   int first=p[prev].i,last=p[q].i;
   if(dir==1?p[q].price>=p[prev].price:p[q].price<=p[prev].price)continue;
   int mid=-1;
   for(int m=0;m<ArraySize(p);m++)if(p[m].kind!=kind&&p[m].i>first&&p[m].i<last)
    if(mid<0||(dir==1?p[m].price>p[mid].price:p[m].price<p[mid].price))mid=m;
   if(mid<0)continue;
   for(int j=last+1;j<n&&j<last+25;j++){
    double low=MathMin(b[j-1].open,b[j-1].close),high=MathMax(b[j-1].open,b[j-1].close);
    bool ib=dir==1?(b[j-1].close<b[j-1].open&&b[j].close>b[j].open&&b[j].close>high):(b[j-1].close>b[j-1].open&&b[j].close<b[j].open&&b[j].close<low);
    if(low==high||!ib||!(dir==1?p[mid].price>high:p[mid].price<low)||!C2Contiguous(b,first,j,step))continue;
    C2Event s;ZeroMemory(s);s.dir=dir;s.first=b[first].time;s.extreme=b[last].time;s.ib=b[j].time;
    s.known=(long)MathMax(MathMax(p[q].known,p[mid].known),b[j].end);
    s.low=low;s.high=high;s.cb=p[mid].price;s.distal=dir==1?b[j-1].low:b[j-1].high;
    s.sl=s.distal-dir*0.05*(high-low);s.fib0=dir==1?low:high;
    C2Evaluate(s,b,j,step,now);
    if(!hasOther||s.known>other.known){other=s;hasOther=true;}
    if(s.stage==C2_WAIT_BREAK||s.stage==C2_WAIT_RETEST)if(!hasWait||s.known>waiting.known){waiting=s;hasWait=true;}
    if(s.stage==C2_VALID){
     if(hasLive&&live.dir!=s.dir)conflict=true;
     if(!hasLive||s.known>live.known){live=s;hasLive=true;}
    }
    break;
   }
  }
 }
 if(conflict){out.stage=C2_CONFLICT;return;}
 if(hasLive)out=live;else if(hasWait)out=waiting;else if(hasOther)out=other;
}
double C2MedianRange(const C2Bar &b[],const int at) {
 double v[];ArrayResize(v,0);
 for(int i=at-20;i<at;i++)if(i>=0&&b[i].high>b[i].low){int n=ArraySize(v);ArrayResize(v,n+1);v[n]=b[i].high-b[i].low;}
 int n=ArraySize(v);if(n==0)return 0;ArraySort(v);
 return (v[(n-1)/2]+v[n/2])/2;
}
bool C2LargeGap(const C2Bar &a,const C2Bar &b,const int tf) {
 long gap=b.time-a.end;if(gap<=0)return false;
 if(tf==0)return gap>5*86400; // MN1
 if(tf==1||tf==2)return gap>3*86400; // W1 / D1
 int day=(int)((a.end/86400+4)%7);
 return !(gap<=3*86400&&(day==5||day==6||day==0));
}
void C2Life(C2Zone &z,const C2Bar &b[]) {
 bool visit=false;z.status=0;z.tests=0;
 for(int i=0;i<ArraySize(b);i++){
  if(b[i].time<=z.origin||b[i].end<=z.departed)continue;
  if(z.dir==1?b[i].close<z.low:b[i].close>z.high){z.status=2;return;}
  bool hit=C2Overlap(z.low,z.high,b[i].low,b[i].high);
  if(hit&&!visit)z.tests++;visit=hit;
 }
 int previous=-1;
 for(int i=0;i<ArraySize(b);i++)if(b[i].end>=z.departed){
  if(previous>=0&&C2LargeGap(b[previous],b[i],z.tf)){z.status=3;return;}previous=i;
 }
 if(z.tests>0)z.status=1;
}
void C2Zones(const C2Bar &b[],const int tf,C2Zone &all[]) {
 int n=ArraySize(b);
 for(int i=20;i<n-2;i++){
  double median=C2MedianRange(b,i);if(median<=0)continue;
  for(int pass=0;pass<2;pass++){
   int dir=pass==0?1:-1;if(!C2PivotAt(b,i,-dir))continue;
   double extreme=dir==1?b[i].low:b[i].high;
   double edge=dir==1?MathMin(b[i].open,b[i].close):MathMax(b[i].open,b[i].close);
   double width=MathMin(.5*median,MathMax(.08*median,MathAbs(extreme-edge)));
   double low=dir==1?extreme:extreme-width,high=dir==1?extreme+width:extreme;
   int departure=-1,impulse=-1;
   for(int j=i+1;j<n&&j<i+4;j++){
    if(departure<0&&(dir==1?b[j].close>high:b[j].close<low))departure=j;
    if(impulse<0&&(dir==1?(b[j].close>b[i].high&&b[j].close-high>=1.5*median):(b[j].close<b[i].low&&low-b[j].close>=1.5*median)))impulse=j;
   }
   if(departure<0)continue;
   for(int kind=0;kind<2;kind++){
    if(kind==1&&impulse<0)continue;
    C2Zone z;ZeroMemory(z);z.tf=tf;z.dir=dir;z.kind=kind;z.low=low;z.high=high;z.scale=median;
    z.origin=b[i].time;z.departed=b[departure].end;
    z.born=(long)MathMax(b[i+2].end,kind==1?b[impulse].end:b[departure].end);
    C2Life(z,b);int size=ArraySize(all);ArrayResize(all,size+1,128);all[size]=z;
   }
  }
 }
}
void C2Keys(const C2Bar &b[],const int tf,C2Key &out[]) {
 int n=ArraySize(b);if(n==0)return;
 if(tf<=2)for(int k=0;k<2;k++){
  C2Key key;key.tf=tf;key.price=k==0?b[n-1].high:b[n-1].low;key.known=b[n-1].end;key.source=b[n-1].time;
  int size=ArraySize(out);ArrayResize(out,size+1);out[size]=key;
 }
 C2Pivot p[];C2Pivots(b,p);int start=(int)MathMax(0,ArraySize(p)-12);
 for(int i=start;i<ArraySize(p);i++){
  C2Key key;key.tf=tf;key.source=b[p[i].i].time;key.known=p[i].known;key.price=p[i].price;
  int size=ArraySize(out);ArrayResize(out,size+1);out[size]=key;
 }
}
bool C2Eligible(const C2Zone &z,const long at) { return z.born<=at&&z.status<2&&z.tests<=1; }
void C2RankOf(const C2Zone &z,const C2Zone &all[],const C2Key &keys[],const long at,C2Rank &r) {
 ZeroMemory(r);bool conf[5],nested[5];ArrayInitialize(conf,false);ArrayInitialize(nested,false);
 for(int i=0;i<ArraySize(all);i++){
  if(!C2Eligible(all[i],at)||all[i].tf==z.tf||all[i].dir!=z.dir||!C2Overlap(z.low,z.high,all[i].low,all[i].high))continue;
  int tf=all[i].tf;conf[tf]=true;
  if((z.low>=all[i].low&&z.high<=all[i].high)||(all[i].low>=z.low&&all[i].high<=z.high))nested[tf]=true;
 }
 for(int i=0;i<5;i++){if(conf[i])r.conf++;if(nested[i])r.nested++;}
 double tolerance=(z.high-z.low)*.1;
 for(int i=0;i<ArraySize(keys);i++)if(keys[i].known<=at&&keys[i].price>=z.low-tolerance&&keys[i].price<=z.high+tolerance&&!(keys[i].tf==z.tf&&keys[i].source==z.origin))r.keys++;
}
bool C2Better(const C2Zone &a,const C2Rank &ar,const C2Zone &b,const C2Rank &br) {
 if(a.status!=b.status)return a.status<b.status;
 if(ar.conf!=br.conf)return ar.conf>br.conf;
 if(ar.nested!=br.nested)return ar.nested>br.nested;
 if(a.kind!=b.kind)return a.kind>b.kind;
 if(ar.keys!=br.keys)return ar.keys>br.keys;
 return a.born>b.born; // all eligible candidates contain the same retest price: distance zero
}
bool C2Select(const C2Zone &all[],const C2Key &keys[],const int dir,const double price,const long at,C2Zone &selected,C2Rank &rank,bool &opposed) {
 bool found=false;opposed=false;ZeroMemory(selected);ZeroMemory(rank);
 for(int i=0;i<ArraySize(all);i++){
  if(!C2Eligible(all[i],at)||price<all[i].low||price>all[i].high)continue;
  if(all[i].dir!=dir){opposed=true;continue;}
  C2Rank r;C2RankOf(all[i],all,keys,at,r);
  if(!found||C2Better(all[i],r,selected,rank)){selected=all[i];rank=r;found=true;}
 }return found;
}
#endif
