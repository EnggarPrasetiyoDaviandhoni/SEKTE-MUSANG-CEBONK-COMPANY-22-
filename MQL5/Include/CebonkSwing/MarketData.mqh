#ifndef CEBONK_SWING_MARKET_MQH
#define CEBONK_SWING_MARKET_MQH
#include "NumericCore.mqh"
#include "FeedValidator.mqh"
#include "ClockUtc.mqh"
class CSMarket {
 public:
  CSBar d1[],h4[],h1[],m15[],m5[],w1[];CSLevel levels[];
  double tick,point,ipdaHigh[3],ipdaLow[3];int h4State;string error;
  bool Copy(string symbol,ENUM_TIMEFRAMES tf,int requested,int minimum,CSBar &out[]){
   if(!SeriesInfoInteger(symbol,tf,SERIES_SYNCHRONIZED))return false;
   MqlRates rates[];ArraySetAsSeries(rates,false);int n=CopyRates(symbol,tf,1,requested,rates);
   if(n<minimum)return false;ArrayResize(out,n);
   for(int i=0;i<n;i++){out[i].time=rates[i].time;out[i].open=rates[i].open;out[i].high=rates[i].high;out[i].low=rates[i].low;out[i].close=rates[i].close;
    if(rates[i].time+PeriodSeconds(tf)>TimeCurrent())return false;}
   return CSValidBars(out);
  }
  bool Load(string symbol){
   tick=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   if(tick<=0||point<=0){error="SYMBOL_TICK_INVALID";return false;}
   if(!Copy(symbol,PERIOD_D1,180,60,d1)){error="IPDA_DATA_NOT_READY";return false;}
   if(!Copy(symbol,PERIOD_H4,256,160,h4)||!Copy(symbol,PERIOD_H1,256,160,h1)||
    !Copy(symbol,PERIOD_M15,512,160,m15)||!Copy(symbol,PERIOD_M5,768,160,m5)){error="HISTORY_NOT_READY";return false;}
   Copy(symbol,PERIOD_W1,3,1,w1);h4State=CSH4Direction(h4);error="MARKET_READY";return true;
  }
  void Add(double price,int side,datetime origin,datetime known,uint kind){
   if(price<=0||known<=0||ArraySize(levels)>=1500)return;
   CSLevel v;v.price=price;v.side=side;v.origin=origin;v.known=known;v.consumed=0;v.kinds=kind;
   int n=ArraySize(levels);ArrayResize(levels,n+1);levels[n]=v;
  }
  void Pivots(CS_CONST_ARRAY(CSBar,a),int lr,int seconds,uint kind){
   for(int i=lr;i+lr<ArraySize(a);i++){
    datetime known=a[i+lr].time+seconds;
    if(CSPivot(a,i,lr,lr,1,ArraySize(a)-1))Add(a[i].high,1,a[i].time,known,kind);
    if(CSPivot(a,i,lr,lr,-1,ArraySize(a)-1))Add(a[i].low,-1,a[i].time,known,kind);
   }
  }
  void Consume(CS_CONST_ARRAY(CSBar,a),int seconds,CSLevel &v){
   for(int k=0;k<ArraySize(a);k++)if(a[k].time>=v.known){
    datetime close=a[k].time+seconds;if(v.consumed>0&&close>=v.consumed)continue;
    if(v.side>0?a[k].high>v.price+tick:a[k].low<v.price-tick)v.consumed=close;
   }
  }
  void Build(CSFeed &feed,CSClock &clock){
   ArrayResize(levels,0);int n=ArraySize(d1);
   // Keep older completed daily pools too, with their true availability time.
   for(int i=(int)CSMax(0,n-4);i<n;i++){
    Add(d1[i].high,1,d1[i].time,d1[i].time+86400,CS_PDH);Add(d1[i].low,-1,d1[i].time,d1[i].time+86400,CS_PDH);
   }
   for(int k=0;k<3;k++){
    int count=k==0?20:k==1?40:60,hi=n-count,lo=n-count;
    for(int i=n-count+1;i<n;i++){if(d1[i].high>d1[hi].high)hi=i;if(d1[i].low<d1[lo].low)lo=i;}
    ipdaHigh[k]=d1[hi].high;ipdaLow[k]=d1[lo].low;uint kind=k==0?CS_IPDA20:k==1?CS_IPDA40:CS_IPDA60;
    Add(d1[hi].high,1,d1[hi].time,d1[hi].time+86400,kind);Add(d1[lo].low,-1,d1[lo].time,d1[lo].time+86400,kind);
   }
   Pivots(h4,3,14400,CS_H4);Pivots(d1,3,86400,CS_D1);Pivots(h1,2,3600,CS_H1);
   if(ArraySize(w1)>0){int i=ArraySize(w1)-1;Add(w1[i].high,1,w1[i].time,w1[i].time+604800,CS_WEEK);Add(w1[i].low,-1,w1[i].time,w1[i].time+604800,CS_WEEK);}
   for(int s=0;s<ArraySize(feed.ranges);s++){
    datetime start=clock.ToServer(feed.ranges[s].start),end=clock.ToServer(feed.ranges[s].end);
    if(start<=0||end<=start||end>TimeCurrent())continue;double hi=0,lo=0;int count=0;
    for(int i=0;i<ArraySize(h1);i++)if(h1[i].time>=start&&h1[i].time+3600<=end){
     hi=CSMax(hi,h1[i].high);lo=lo==0?h1[i].low:CSMin(lo,h1[i].low);count++;
    }
    if(count*3600!=(int)(end-start))continue;
    Add(hi,1,start,end,CS_SESSION);Add(lo,-1,start,end,CS_SESSION);
   }
   for(int i=0;i<ArraySize(levels);i++){Consume(d1,86400,levels[i]);Consume(h1,3600,levels[i]);Consume(m5,300,levels[i]);}
  }
  bool Target(int side,double entry,double sl,double minimumRR,double &tp,uint &kind,string &why){
   tp=0;kind=0;double barrier=0;
   for(int i=0;i<ArraySize(levels);i++){
    CSLevel v=levels[i];if(v.side!=side||v.consumed>0||v.known>TimeCurrent()||side*(v.price-entry)<=0)continue;
    if(v.kinds==CS_PDH&&v.origin!=d1[ArraySize(d1)-1].time)continue;
    if((v.kinds&127)!=0){
     if(tp==0||side*(v.price-tp)<-2*tick){tp=v.price;kind=v.kinds;}
     else if(MathAbs(v.price-tp)<=2*tick){tp=side>0?CSMin(tp,v.price):CSMax(tp,v.price);kind|=v.kinds;}
    }else if(barrier==0||side*(v.price-barrier)<0)barrier=v.price;
   }
   if(tp==0){why="NO_EXTERNAL_LIQUIDITY";return false;}
   tp=side>0?MathFloor(tp/tick+1e-10)*tick:MathCeil(tp/tick-1e-10)*tick;
   if(CSRR(side,entry,sl,tp)<minimumRR){why="SKIP_RR_NEAREST_ICT";return false;}
   if(barrier>0&&side*(barrier-tp)<0&&CSRR(side,entry,sl,barrier)<minimumRR){why="SKIP_INTERVENING_LIQUIDITY";return false;}
   why="ICT_EXTERNAL_LIQUIDITY";return true;
  }
};
#endif
