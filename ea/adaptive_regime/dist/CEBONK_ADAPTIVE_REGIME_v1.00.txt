// CEBONK COMPANY 22 | ADAPTIVE REGIME EA | v1.00
// Design: selected 3TF package, closed-candle regime routing, strict capital guards.
// No martingale, recovery, layering, BE, trailing, or partial close.
#property strict
#property version "1.00"
#property description "CEBONK ADAPTIVE REGIME v1.00 - conservative 3TF auto-entry with capital guards."

#include <Trade/Trade.mqh>

enum AR_PACKAGE
  {
   AR_H4_H1_M15=0,
   AR_H1_M15_M5=1,
   AR_M15_M5_M1=2
  };

enum AR_VOLUME_MODE
  {
   AR_FIXED_LOT=0,
   AR_RISK_PERCENT=1
  };

enum AR_REGIME
  {
   AR_RANGE=0,
   AR_TREND=1,
   AR_TRANSITION=2
  };

input group "01 | EXECUTION"
input string         InpSymbol="XAUUSDc";
input ulong          InpMagic=221024;
input bool           InpAutopilot=false;
input bool           InpAllowRealAccount=false;
input AR_PACKAGE     InpPackage=AR_H1_M15_M5;
input AR_VOLUME_MODE InpVolumeMode=AR_FIXED_LOT;
input double         InpFixedLot=0.01;
input double         InpRiskPercent=0.25;
input double         InpMaxLot=0.05;
input double         InpRR=2.0;
input int            InpMaxSpreadPoints=70;
input int            InpDeviationPoints=30;

input group "02 | CAPITAL GUARDS"
input double InpDailyLossLimitPct=2.0;
input int    InpMaxTradesPerDay=3;
input int    InpMaxConsecutiveLosses=2;
input int    InpLossCooldownMinutes=120;

input group "03 | MARKET / SIGNAL"
input bool   InpUseBrokerSession=true;
input int    InpSessionStartHour=7;
input int    InpSessionEndHour=23;
input int    InpHistoryBars=220;
input int    InpATRPeriod=14;
input double InpTrendEfficiency=0.36;
input double InpRangeEfficiency=0.22;
input double InpMinSL_ATR=0.80;
input double InpMaxSL_ATR=3.00;
input double InpSLBufferPrice=0.20;
input int    InpSetupExpiryBars=3;

input group "04 | TELEGRAM / MT5"
input bool   InpTelegram=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool   InpMT5Push=true;
input bool   InpNotifyExit=true;
input int    InpHTTPTimeoutMs=3000;

#define AR_BB_PERIOD 20
#define AR_BB_DEV 2.0
#define AR_FAST 5
#define AR_SLOW 10
#define AR_PIVOT 2

struct ARBar
  {
   datetime time;
   double open,high,low,close;
   double mid,upper,lower;
   double ma5h,ma10h,ma5l,ma10l;
  };

struct ARSignal
  {
   bool valid;
   int dir;
   int regime;
   datetime event_time;
   double reference;
   double structural_sl;
   double atr;
   string setup;
  };

CTrade gTrade;
bool gTester=false;
bool gAuto=false;
string gButton="";
string gScope="";
string gLastStatus="";
datetime gLastTF3Bar=0;
ulong gLastNotifiedOrder=0;

ENUM_TIMEFRAMES TF1()
  {
   if(InpPackage==AR_H4_H1_M15) return PERIOD_H4;
   if(InpPackage==AR_H1_M15_M5) return PERIOD_H1;
   return PERIOD_M15;
  }
ENUM_TIMEFRAMES TF2()
  {
   if(InpPackage==AR_H4_H1_M15) return PERIOD_H1;
   if(InpPackage==AR_H1_M15_M5) return PERIOD_M15;
   return PERIOD_M5;
  }
ENUM_TIMEFRAMES TF3()
  {
   if(InpPackage==AR_H4_H1_M15) return PERIOD_M15;
   if(InpPackage==AR_H1_M15_M5) return PERIOD_M5;
   return PERIOD_M1;
  }
string PackageName()
  {
   if(InpPackage==AR_H4_H1_M15) return "H4-H1-M15";
   if(InpPackage==AR_H1_M15_M5) return "H1-M15-M5";
   return "M15-M5-M1";
  }
string SideName(const int d){return d>0?"BUY":d<0?"SELL":"WAIT";}

double SMA(const double &v[],const int period,const int i)
  {
   if(i<period-1) return EMPTY_VALUE;
   double s=0.0;
   for(int k=0;k<period;k++) s+=v[i-k];
   return s/period;
  }
double LWMA(const double &v[],const int period,const int i)
  {
   if(i<period-1) return EMPTY_VALUE;
   double n=0.0,d=0.0;
   for(int k=0;k<period;k++)
     {
      double w=(double)(period-k);
      n+=v[i-k]*w;
      d+=w;
     }
   return d>0.0?n/d:EMPTY_VALUE;
  }
void Bands(const double &v[],const int i,double &mid,double &upper,double &lower)
  {
   mid=SMA(v,AR_BB_PERIOD,i);
   upper=lower=EMPTY_VALUE;
   if(mid==EMPTY_VALUE) return;
   double s=0.0;
   for(int k=0;k<AR_BB_PERIOD;k++)
     {
      double x=v[i-k]-mid;
      s+=x*x;
     }
   double sd=MathSqrt(s/AR_BB_PERIOD);
   upper=mid+AR_BB_DEV*sd;
   lower=mid-AR_BB_DEV*sd;
  }
bool LoadBars(const ENUM_TIMEFRAMES tf,ARBar &out[])
  {
   MqlRates r[];
   ArraySetAsSeries(r,false);
   int got=CopyRates(InpSymbol,tf,1,InpHistoryBars,r);
   if(got<60) return false;
   ArrayResize(out,got);
   double h[],l[],c[];
   ArrayResize(h,got); ArrayResize(l,got); ArrayResize(c,got);
   for(int i=0;i<got;i++)
     {
      if(r[i].low<=0.0 || r[i].high<r[i].low) return false;
      out[i].time=r[i].time;
      out[i].open=r[i].open; out[i].high=r[i].high;
      out[i].low=r[i].low;   out[i].close=r[i].close;
      h[i]=r[i].high; l[i]=r[i].low; c[i]=r[i].close;
     }
   for(int i=0;i<got;i++)
     {
      Bands(c,i,out[i].mid,out[i].upper,out[i].lower);
      out[i].ma5h=LWMA(h,AR_FAST,i);
      out[i].ma10h=LWMA(h,AR_SLOW,i);
      out[i].ma5l=LWMA(l,AR_FAST,i);
      out[i].ma10l=LWMA(l,AR_SLOW,i);
     }
   return true;
  }
bool PivotHigh(const ARBar &a[],const int i)
  {
   if(i<AR_PIVOT || i+AR_PIVOT>=ArraySize(a)) return false;
   for(int k=1;k<=AR_PIVOT;k++)
      if(a[i].high<=a[i-k].high || a[i].high<=a[i+k].high) return false;
   return true;
  }
bool PivotLow(const ARBar &a[],const int i)
  {
   if(i<AR_PIVOT || i+AR_PIVOT>=ArraySize(a)) return false;
   for(int k=1;k<=AR_PIVOT;k++)
      if(a[i].low>=a[i-k].low || a[i].low>=a[i+k].low) return false;
   return true;
  }
int StructureTrend(const ARBar &a[])
  {
   int n=ArraySize(a);
   double prevH=0,lastH=0,prevL=0,lastL=0;
   int hc=0,lc=0;
   for(int i=MathMax(AR_PIVOT,n-100);i<n-AR_PIVOT;i++)
     {
      if(PivotHigh(a,i)){prevH=lastH;lastH=a[i].high;hc++;}
      if(PivotLow(a,i)){prevL=lastL;lastL=a[i].low;lc++;}
     }
   if(hc<2 || lc<2) return 0;
   if(lastH>prevH && lastL>prevL) return 1;
   if(lastH<prevH && lastL<prevL) return -1;
   return 0;
  }
double Efficiency(const ARBar &a[],const int lookback)
  {
   int n=ArraySize(a);
   int from=MathMax(1,n-lookback);
   if(n-from<5) return 0.0;
   double travel=0.0;
   for(int i=from;i<n;i++) travel+=MathAbs(a[i].close-a[i-1].close);
   if(travel<=0.0) return 0.0;
   return MathAbs(a[n-1].close-a[from-1].close)/travel;
  }
double ATR(const ARBar &a[])
  {
   int n=ArraySize(a);
   if(n<InpATRPeriod+1) return 0.0;
   double s=0.0;
   for(int i=n-InpATRPeriod;i<n;i++)
     {
      double pc=a[i-1].close;
      double tr=MathMax(a[i].high-a[i].low,
                        MathMax(MathAbs(a[i].high-pc),MathAbs(a[i].low-pc)));
      s+=tr;
     }
   return s/InpATRPeriod;
  }
int Regime(const ARBar &tf1[],int &trend,double &eff)
  {
   trend=StructureTrend(tf1);
   eff=Efficiency(tf1,16);
   if(trend!=0 && eff>=InpTrendEfficiency) return AR_TREND;
   if(eff<=InpRangeEfficiency) return AR_RANGE;
   return AR_TRANSITION;
  }
bool IndicatorOK(const ARBar &x)
  {
   return x.mid!=EMPTY_VALUE && x.upper!=EMPTY_VALUE && x.lower!=EMPTY_VALUE &&
          x.ma5h!=EMPTY_VALUE && x.ma10h!=EMPTY_VALUE &&
          x.ma5l!=EMPTY_VALUE && x.ma10l!=EMPTY_VALUE;
  }
bool Reentry(const ARBar &a[],const int i,const int dir)
  {
   if(i<0 || i>=ArraySize(a) || !IndicatorOK(a[i])) return false;
   ARBar x=a[i];
   if(dir>0)
     {
      double lo=MathMin(x.ma5l,x.ma10l),hi=MathMax(x.ma5l,x.ma10l);
      return x.low<=hi && x.high>=lo && MathMin(x.open,x.close)>hi &&
             x.close>hi && x.ma5l>x.mid && x.ma10l>x.mid;
     }
   double lo=MathMin(x.ma5h,x.ma10h),hi=MathMax(x.ma5h,x.ma10h);
   return x.high>=lo && x.low<=hi && MathMax(x.open,x.close)<lo &&
          x.close<lo && x.ma5h<x.mid && x.ma10h<x.mid;
  }
bool Momentum(const ARBar &a[],const int i,const int dir)
  {
   if(i<1 || i>=ArraySize(a) || !IndicatorOK(a[i]) || !IndicatorOK(a[i-1])) return false;
   ARBar x=a[i],p=a[i-1];
   if(dir>0)
     {
      bool csak=x.close>x.open &&
                x.close>MathMax(x.mid,MathMax(x.ma5h,x.ma10h)) &&
                MathMin(x.open,p.close)<=MathMax(p.mid,MathMax(p.ma5h,p.ma10h));
      bool csm=x.close>x.open && x.close>x.upper && (x.open<=x.upper || p.close<=p.upper);
      return csak || csm;
     }
   bool csak=x.close<x.open &&
             x.close<MathMin(x.mid,MathMin(x.ma5l,x.ma10l)) &&
             MathMax(x.open,p.close)>=MathMin(p.mid,MathMin(p.ma5l,p.ma10l));
   bool csm=x.close<x.open && x.close<x.lower && (x.open>=x.lower || p.close>=p.lower);
   return csak || csm;
  }
int FirstAfter(const ARBar &a[],const datetime t)
  {
   for(int i=0;i<ArraySize(a);i++) if(a[i].time>t) return i;
   return -1;
  }
bool Overlap(const double al,const double ah,const double bl,const double bh)
  {
   return al<=bh && ah>=bl;
  }
bool FindIBRetest(const ARBar &a[],const int dir,const datetime after,
                  double &entry,double &sl,datetime &eventTime)
  {
   int n=ArraySize(a);
   if(n<20) return false;
   for(int i=MathMax(2,n-35);i<n-2;i++)
     {
      if(a[i].time<=after) continue;
      double zl=MathMin(a[i].open,a[i].close);
      double zh=MathMax(a[i].open,a[i].close);
      if(zh<=zl) continue;
      bool ib=dir>0 ?
              (a[i].close<a[i].open && a[i+1].close>a[i+1].open && a[i+1].close>zh) :
              (a[i].close>a[i].open && a[i+1].close<a[i+1].open && a[i+1].close<zl);
      if(!ib) continue;

      double cb=dir>0?a[i-1].high:a[i-1].low;
      int broken=-1;
      for(int j=i+2;j<n;j++)
        {
         if(dir>0 ? a[j].close>cb : a[j].close<cb){broken=j;break;}
        }
      if(broken<0) continue;

      int retest=-1;
      for(int j=broken+1;j<n;j++)
        {
         if(Overlap(zl,zh,a[j].low,a[j].high)){retest=j;break;}
        }
      if(retest!=n-1) continue;

      double mid=(zl+zh)/2.0;
      bool reject=dir>0 ?
                  (a[retest].close>a[retest].open && a[retest].close>mid) :
                  (a[retest].close<a[retest].open && a[retest].close<mid);
      if(!reject) continue;

      entry=a[retest].close;
      sl=dir>0?a[i].low-InpSLBufferPrice:a[i].high+InpSLBufferPrice;
      eventTime=a[retest].time;
      if(dir>0 ? sl>=entry : sl<=entry) continue;
      return true;
     }
   return false;
  }
bool TrendSignal(const ARBar &a[],const ARBar &b[],const ARBar &c[],
                 const int dir,ARSignal &s)
  {
   ZeroMemory(s);
   int n1=ArraySize(a);
   for(int i=n1-1;i>=MathMax(0,n1-8);i--)
     {
      if(!Reentry(a,i,dir)) continue;
      int j0=FirstAfter(b,a[i].time);
      if(j0<0) continue;
      for(int j=j0;j<=MathMin(ArraySize(b)-1,j0+10);j++)
        {
         if(!Momentum(b,j,dir)) continue;
         double entry=0,sl=0;datetime eventTime=0;
         if(!FindIBRetest(c,dir,b[j].time,entry,sl,eventTime)) continue;
         double atr=ATR(c);
         if(atr<=0) continue;
         s.valid=true;s.dir=dir;s.regime=AR_TREND;s.event_time=eventTime;
         s.reference=entry;s.structural_sl=sl;s.atr=atr;
         s.setup="TREND | TF1 RE-ENTRY -> TF2 MOMENTUM -> TF3 IB -> CB1 BREAK -> FIRST RETEST";
         return true;
        }
     }
   return false;
  }
bool LatestLiquidity(const ARBar &a[],const int dir,double &level,datetime &known)
  {
   int n=ArraySize(a);
   for(int i=n-1-AR_PIVOT;i>=MathMax(AR_PIVOT,n-100);i--)
     {
      bool ok=dir>0?PivotLow(a,i):PivotHigh(a,i);
      if(!ok) continue;
      level=dir>0?a[i].low:a[i].high;
      known=a[i+AR_PIVOT].time;
      return true;
     }
   return false;
  }
double MedianBody(const ARBar &a[],const int at)
  {
   int last=MathMax(0,at-1),first=MathMax(0,last-19),n=last-first+1;
   double x[];ArrayResize(x,n);
   for(int i=0;i<n;i++)x[i]=MathAbs(a[first+i].close-a[first+i].open);
   ArraySort(x);
   if(n%2) return x[n/2];
   return (x[n/2-1]+x[n/2])/2.0;
  }
bool SweepSignal(const ARBar &a[],const ARBar &b[],const ARBar &c[],
                 const int dir,ARSignal &s)
  {
   ZeroMemory(s);
   double level=0;datetime known=0;
   if(!LatestLiquidity(a,dir,level,known)) return false;

   int start=MathMax(7,ArraySize(b)-20);
   for(int i=start;i<ArraySize(b);i++)
     {
      if(b[i].time<known) continue;
      bool swept=dir>0 ?
                 (b[i].low<level && b[i].close>level) :
                 (b[i].high>level && b[i].close<level);
      if(!swept) continue;

      int pre=MathMax(0,i-6);
      double structure=dir>0?b[pre].high:b[pre].low;
      for(int h=pre+1;h<i;h++)
         structure=dir>0?MathMax(structure,b[h].high):MathMin(structure,b[h].low);

      int disp=-1;
      for(int j=i;j<=MathMin(ArraySize(b)-1,i+3);j++)
        {
         double mb=MedianBody(b,j);
         double body=MathAbs(b[j].close-b[j].open);
         bool directional=dir>0?b[j].close>b[j].open:b[j].close<b[j].open;
         bool broken=dir>0?b[j].close>structure:b[j].close<structure;
         if(mb>0 && directional && broken && body>=1.20*mb){disp=j;break;}
        }
      if(disp<0) continue;

      int c0=FirstAfter(c,b[disp].time);
      if(c0<0) continue;
      int retest=-1;
      for(int j=c0;j<ArraySize(c);j++)
        {
         bool hit=dir>0 ?
                  (c[j].low<=structure && c[j].close>structure) :
                  (c[j].high>=structure && c[j].close<structure);
         if(hit){retest=j;break;}
        }
      if(retest!=ArraySize(c)-1) continue;

      double atr=ATR(c);
      if(atr<=0) continue;
      double stop=dir>0?b[i].low-InpSLBufferPrice:b[i].high+InpSLBufferPrice;
      if(dir>0 ? stop>=c[retest].close : stop<=c[retest].close) continue;

      s.valid=true;s.dir=dir;s.regime=AR_RANGE;s.event_time=c[retest].time;
      s.reference=c[retest].close;s.structural_sl=stop;s.atr=atr;
      s.setup="LIQUIDITY | TF1 LEVEL -> TF2 SWEEP+DISPLACEMENT+BREAK -> TF3 FIRST RETEST";
      return true;
     }
   return false;
  }

bool InSession()
  {
   if(!InpUseBrokerSession) return true;
   datetime now=TimeTradeServer();
   if(now<=0) now=TimeCurrent();
   MqlDateTime d;TimeToStruct(now,d);
   if(InpSessionStartHour==InpSessionEndHour) return true;
   if(InpSessionStartHour<InpSessionEndHour)
      return d.hour>=InpSessionStartHour && d.hour<InpSessionEndHour;
   return d.hour>=InpSessionStartHour || d.hour<InpSessionEndHour;
  }
datetime DayStart()
  {
   datetime now=TimeTradeServer();
   if(now<=0)now=TimeCurrent();
   MqlDateTime d;TimeToStruct(now,d);
   d.hour=0;d.min=0;d.sec=0;
   return StructToTime(d);
  }
double TodayRealizedAll()
  {
   datetime now=TimeTradeServer();if(now<=0)now=TimeCurrent();
   if(!HistorySelect(DayStart(),now)) return 0.0;
   double net=0.0;
   for(int i=0;i<HistoryDealsTotal();i++)
     {
      ulong t=HistoryDealGetTicket(i);
      if(t==0) continue;
      long e=HistoryDealGetInteger(t,DEAL_ENTRY);
      if(e==DEAL_ENTRY_OUT || e==DEAL_ENTRY_OUT_BY || e==DEAL_ENTRY_INOUT)
         net+=HistoryDealGetDouble(t,DEAL_PROFIT)+
              HistoryDealGetDouble(t,DEAL_COMMISSION)+
              HistoryDealGetDouble(t,DEAL_SWAP)+
              HistoryDealGetDouble(t,DEAL_FEE);
     }
   return net;
  }
int TradesToday()
  {
   datetime now=TimeTradeServer();if(now<=0)now=TimeCurrent();
   if(!HistorySelect(DayStart(),now)) return 0;
   int n=0;
   for(int i=0;i<HistoryDealsTotal();i++)
     {
      ulong t=HistoryDealGetTicket(i);
      if(t==0) continue;
      if(HistoryDealGetString(t,DEAL_SYMBOL)!=InpSymbol) continue;
      if((ulong)HistoryDealGetInteger(t,DEAL_MAGIC)!=InpMagic) continue;
      long e=HistoryDealGetInteger(t,DEAL_ENTRY);
      if(e==DEAL_ENTRY_IN || e==DEAL_ENTRY_INOUT) n++;
     }
   return n;
  }
int ConsecutiveLosses(datetime &lastLoss)
  {
   lastLoss=0;
   datetime now=TimeTradeServer();if(now<=0)now=TimeCurrent();
   if(!HistorySelect(0,now)) return 0;
   int losses=0;
   for(int i=HistoryDealsTotal()-1;i>=0;i--)
     {
      ulong t=HistoryDealGetTicket(i);
      if(t==0) continue;
      if(HistoryDealGetString(t,DEAL_SYMBOL)!=InpSymbol) continue;
      if((ulong)HistoryDealGetInteger(t,DEAL_MAGIC)!=InpMagic) continue;
      long e=HistoryDealGetInteger(t,DEAL_ENTRY);
      if(e!=DEAL_ENTRY_OUT && e!=DEAL_ENTRY_OUT_BY && e!=DEAL_ENTRY_INOUT) continue;
      double net=HistoryDealGetDouble(t,DEAL_PROFIT)+
                 HistoryDealGetDouble(t,DEAL_COMMISSION)+
                 HistoryDealGetDouble(t,DEAL_SWAP)+
                 HistoryDealGetDouble(t,DEAL_FEE);
      if(net<0)
        {
         losses++;
         if(lastLoss==0) lastLoss=(datetime)HistoryDealGetInteger(t,DEAL_TIME);
        }
      else break;
     }
   return losses;
  }
bool HasAnyPositionOrOrder()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong t=PositionGetTicket(i);
      if(t>0 && PositionGetString(POSITION_SYMBOL)==InpSymbol) return true;
     }
   for(int i=OrdersTotal()-1;i>=0;i--)
     {
      ulong t=OrderGetTicket(i);
      if(t>0 && OrderGetString(ORDER_SYMBOL)==InpSymbol) return true;
     }
   return false;
  }
bool RiskGate(string &why)
  {
   if(HasAnyPositionOrOrder()){why="SYMBOL_ALREADY_HAS_POSITION_OR_ORDER";return false;}
   if(TradesToday()>=InpMaxTradesPerDay){why="MAX_TRADES_PER_DAY";return false;}

   double balance=AccountInfoDouble(ACCOUNT_BALANCE);
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   double realized=TodayRealizedAll();
   double startBalance=balance-realized;
   if(startBalance<=0){why="DAY_BASE_INVALID";return false;}
   double dayPnl=realized+(equity-balance);
   if(dayPnl<=-(startBalance*InpDailyLossLimitPct/100.0))
     {why="DAILY_LOSS_KILL_SWITCH";return false;}

   datetime lastLoss=0;
   int losses=ConsecutiveLosses(lastLoss);
   if(losses>=InpMaxConsecutiveLosses && lastLoss>0)
     {
      datetime now=TimeTradeServer();if(now<=0)now=TimeCurrent();
      if(now-lastLoss<InpLossCooldownMinutes*60)
        {why="LOSS_STREAK_COOLDOWN";return false;}
     }
   why="";
   return true;
  }
double NormalizeLot(double lot)
  {
   double minv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN);
   double maxv=MathMin(SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX),InpMaxLot);
   double step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP);
   if(step<=0 || maxv<minv) return 0.0;
   lot=MathMin(maxv,MathMax(minv,lot));
   lot=MathFloor(lot/step+1e-9)*step;
   return NormalizeDouble(lot,8);
  }
double RiskLot(const double entry,const double sl)
  {
   double tickSize=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_VALUE_LOSS);
   if(tickValue<=0) tickValue=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_VALUE);
   double dist=MathAbs(entry-sl);
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   if(tickSize<=0 || tickValue<=0 || dist<=0 || equity<=0) return 0.0;
   double lossPerLot=(dist/tickSize)*tickValue;
   if(lossPerLot<=0) return 0.0;
   return NormalizeLot(equity*InpRiskPercent/100.0/lossPerLot);
  }
bool InputsOK()
  {
   if(InpSymbol=="" || InpMagic==0 || InpFixedLot<=0 || InpRiskPercent<=0 || InpMaxLot<=0) return false;
   if(InpRR<1.0 || InpRR>5.0 || InpMaxSpreadPoints<1 || InpDeviationPoints<0) return false;
   if(InpDailyLossLimitPct<=0 || InpDailyLossLimitPct>10.0 || InpMaxTradesPerDay<1) return false;
   if(InpMaxConsecutiveLosses<1 || InpLossCooldownMinutes<1) return false;
   if(InpHistoryBars<100 || InpATRPeriod<5 || InpTrendEfficiency<=InpRangeEfficiency) return false;
   if(InpMinSL_ATR<=0 || InpMaxSL_ATR<=InpMinSL_ATR || InpSLBufferPrice<0) return false;
   if(InpSessionStartHour<0 || InpSessionStartHour>23 || InpSessionEndHour<0 || InpSessionEndHour>23) return false;
   return true;
  }
bool SignalConsumed(const string key)
  {
   if(gTester) return false;
   return GlobalVariableCheck(gScope+key);
  }
void ReserveSignal(const string key)
  {
   if(gTester) return;
   GlobalVariableSet(gScope+key,(double)TimeCurrent());
   GlobalVariablesFlush();
  }
void Status(const string s)
  {
   if(gLastStatus==s) return;
   gLastStatus=s;
   Print("CEBONK AR | ",s);
   if(ObjectFind(0,gButton)>=0) ObjectSetString(0,gButton,OBJPROP_TOOLTIP,s);
  }
void Paint()
  {
   if(ObjectFind(0,gButton)<0) return;
   ObjectSetString(0,gButton,OBJPROP_TEXT,gAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
   ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gAuto?clrDarkGreen:clrFireBrick);
   ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
  }
string JQ(const string s)
  {
   string out="\"";
   for(int i=0;i<StringLen(s);i++)
     {
      ushort c=StringGetCharacter(s,i);
      if(c==34)out+="\\\"";
      else if(c==92)out+="\\\\";
      else if(c==10)out+="\\n";
      else if(c==13)out+="\\r";
      else out+=ShortToString(c);
     }
   return out+"\"";
  }
void Telegram(const string text)
  {
   if(gTester || !InpTelegram || InpTelegramToken=="" || InpTelegramChatID=="") return;
   string body="{\"chat_id\":"+JQ(InpTelegramChatID)+",\"text\":"+JQ(text)+"}";
   char data[],answer[];string headers;
   int n=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   if(n>0)ArrayResize(data,n-1);
   int http=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+"/sendMessage",
                       "Content-Type: application/json\r\n",InpHTTPTimeoutMs,data,answer,headers);
   if(http!=200) Print("Telegram gagal HTTP=",http," err=",GetLastError());
  }
void NotifyEntry(const string side,const double volume,const double price,const double sl,const double tp,const string setup)
  {
   int dg=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
   string text="SEKTE MUSANG TEORY CEBONK COMPANY 22\n"+
               side+" ENTRY | "+PackageName()+"\n"+
               DoubleToString(volume,2)+" lot @ "+DoubleToString(price,dg)+"\n"+
               "SL "+DoubleToString(sl,dg)+" | TP "+DoubleToString(tp,dg)+"\n"+
               setup+"\nOJO FULLMARGIN COK";
   Print(text);
   if(InpMT5Push && !gTester) SendNotification(StringSubstr(text,0,250));
   Telegram(text);
  }
void NotifyExit(const string side,const double price,const double net)
  {
   if(!InpNotifyExit) return;
   int dg=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
   string text="SEKTE MUSANG TEORY CEBONK COMPANY 22\nEXIT "+side+
               " @ "+DoubleToString(price,dg)+" | net "+DoubleToString(net,2);
   Print(text);
   if(InpMT5Push && !gTester) SendNotification(StringSubstr(text,0,250));
   Telegram(text);
  }
bool Place(const ARSignal &s,string &why)
  {
   if(!InpAllowRealAccount && AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL)
     {why="REAL_ACCOUNT_LOCKED";return false;}
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
      !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
      !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) ||
      !AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
     {why="ALGO_OR_ACCOUNT_DISABLED";return false;}

   MqlTick q;
   if(!SymbolInfoTick(InpSymbol,q) || q.bid<=0 || q.ask<q.bid)
     {why="NO_QUOTE";return false;}
   double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
   if(point<=0 || (q.ask-q.bid)/point>InpMaxSpreadPoints)
     {why="SPREAD_LIMIT";return false;}

   double entry=s.dir>0?q.ask:q.bid;
   double sl=s.structural_sl;
   double dist=MathAbs(entry-sl);
   if(sl<=0 || s.atr<=0 || (s.dir>0?sl>=entry:sl<=entry))
     {why="SL_WRONG_SIDE";return false;}

   double minDist=InpMinSL_ATR*s.atr;
   double maxDist=InpMaxSL_ATR*s.atr;
   if(dist>maxDist){why="SL_TOO_WIDE_ATR";return false;}
   if(dist<minDist) sl=s.dir>0?entry-minDist:entry+minDist;

   int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
   double tickSize=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);
   if(tickSize<=0){why="TICK_SIZE_INVALID";return false;}
   sl=NormalizeDouble(MathRound(sl/tickSize)*tickSize,digits);
   dist=MathAbs(entry-sl);
   double tp=s.dir>0?entry+dist*InpRR:entry-dist*InpRR;
   tp=NormalizeDouble(MathRound(tp/tickSize)*tickSize,digits);

   double stop=(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*point;
   if((s.dir>0 && (q.bid-sl<stop || tp-q.bid<stop)) ||
      (s.dir<0 && (sl-q.ask<stop || q.ask-tp<stop)))
     {why="BROKER_MIN_STOP_DISTANCE";return false;}

   double lot=InpVolumeMode==AR_RISK_PERCENT?RiskLot(entry,sl):NormalizeLot(InpFixedLot);
   if(lot<=0){why="LOT_INVALID";return false;}

   gTrade.SetExpertMagicNumber(InpMagic);
   gTrade.SetDeviationInPoints(InpDeviationPoints);
   gTrade.SetTypeFillingBySymbol(InpSymbol);
   string comment="AR-"+(s.regime==AR_TREND?"T":"S")+"-"+PackageName();
   bool sent=s.dir>0 ?
             gTrade.Buy(lot,InpSymbol,0.0,sl,tp,comment) :
             gTrade.Sell(lot,InpSymbol,0.0,sl,tp,comment);
   if(!sent){why="ORDER_"+(string)gTrade.ResultRetcode();return false;}
   why="";
   return true;
  }
void Evaluate()
  {
   if(!InSession()){Status("OUTSIDE_BROKER_SESSION");return;}
   string why;
   if(!RiskGate(why)){Status(why);return;}

   ARBar a[],b[],c[];
   if(!LoadBars(TF1(),a) || !LoadBars(TF2(),b) || !LoadBars(TF3(),c))
     {Status("DATA_KURANG");return;}

   int trend=0;double eff=0.0;
   int regime=Regime(a,trend,eff);
   ARSignal signal;ZeroMemory(signal);

   if(regime==AR_TREND && trend!=0)
     {
      if(!TrendSignal(a,b,c,trend,signal))
        {Status("TREND_SETUP_WAIT");return;}
     }
   else
     {
      ARSignal buy,sell;ZeroMemory(buy);ZeroMemory(sell);
      bool bOk=SweepSignal(a,b,c,1,buy);
      bool sOk=SweepSignal(a,b,c,-1,sell);
      if(bOk && sOk){Status("BUY_SELL_CONFLICT");return;}
      if(!bOk && !sOk){Status(regime==AR_RANGE?"RANGE_SWEEP_WAIT":"TRANSITION_SWEEP_WAIT");return;}
      signal=bOk?buy:sell;
     }

   int sec=PeriodSeconds(TF3());
   datetime now=TimeTradeServer();if(now<=0)now=TimeCurrent();
   if(signal.event_time<=0 || now-signal.event_time>sec*InpSetupExpiryBars)
     {Status("SIGNAL_EXPIRED");return;}

   string key=(string)signal.regime+"."+(string)signal.dir+"."+(string)signal.event_time;
   if(SignalConsumed(key)){Status("SIGNAL_ALREADY_CONSUMED");return;}
   ReserveSignal(key);

   if(!gAuto)
     {
      Status("AUTOPILOT_OFF_SIGNAL_ONLY");
      return;
     }

   if(!Place(signal,why))
     {
      Status("ORDER_REJECTED_"+why);
      return;
     }
   Status("ORDER_SENT");
  }
bool NewTF3Bar()
  {
   datetime t=iTime(InpSymbol,TF3(),0);
   if(t<=0 || t==gLastTF3Bar) return false;
   gLastTF3Bar=t;
   return true;
  }

int OnInit()
  {
   gTester=(bool)MQLInfoInteger(MQL_TESTER);
   gAuto=InpAutopilot;
   if(_Symbol!=InpSymbol)
     {
      Print("Pasang EA neng chart ",InpSymbol,". TF chart bebas.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(!InputsOK()) return INIT_PARAMETERS_INCORRECT;

   gScope="CEBONK.AR."+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"."+InpSymbol+"."+(string)InpMagic+".";
   gButton="CEBONK_AR_AUTO_"+(string)ChartID();
   if(!gTester)
     {
      ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0);
      ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
      ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12);
      ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,18);
      ObjectSetInteger(0,gButton,OBJPROP_XSIZE,126);
      ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);
      Paint();
     }
   gLastTF3Bar=iTime(InpSymbol,TF3(),0);
   EventSetTimer(1);
   Print("CEBONK ADAPTIVE REGIME v1.00 | ",PackageName(),
         " | AUTOPILOT ",gAuto?"ON":"OFF",
         " | REAL ",InpAllowRealAccount?"UNLOCKED":"LOCKED",
         " | RR 1:",DoubleToString(InpRR,2),
         " | MAX SPREAD ",InpMaxSpreadPoints);
   return INIT_SUCCEEDED;
  }
void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(ObjectFind(0,gButton)>=0) ObjectDelete(0,gButton);
  }
void OnTimer()
  {
   if(NewTF3Bar()) Evaluate();
  }
void OnTick(){}

void OnChartEvent(const int id,const long &l,const double &d,const string &s)
  {
   if(id==CHARTEVENT_OBJECT_CLICK && s==gButton)
     {
      gAuto=!gAuto;
      Paint();
      Print("AUTOPILOT ",gAuto?"ON":"OFF");
     }
  }

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || trans.deal==0) return;
   if(!HistoryDealSelect(trans.deal)) return;
   if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=InpSymbol) return;
   if((ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic) return;

   long entryType=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
   long dealType=HistoryDealGetInteger(trans.deal,DEAL_TYPE);
   double price=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
   double volume=HistoryDealGetDouble(trans.deal,DEAL_VOLUME);
   string side=dealType==DEAL_TYPE_BUY?"BUY":"SELL";

   if(entryType==DEAL_ENTRY_IN || entryType==DEAL_ENTRY_INOUT)
     {
      if(trans.order!=0 && trans.order==gLastNotifiedOrder) return;
      gLastNotifiedOrder=trans.order;
      double sl=0,tp=0;
      if(PositionSelect(InpSymbol) && (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic)
        {
         sl=PositionGetDouble(POSITION_SL);
         tp=PositionGetDouble(POSITION_TP);
        }
      NotifyEntry(side,volume,price,sl,tp,"ONE ENTRY = ONE NOTIFICATION");
     }

   if(entryType==DEAL_ENTRY_OUT || entryType==DEAL_ENTRY_OUT_BY)
     {
      double net=HistoryDealGetDouble(trans.deal,DEAL_PROFIT)+
                 HistoryDealGetDouble(trans.deal,DEAL_COMMISSION)+
                 HistoryDealGetDouble(trans.deal,DEAL_SWAP)+
                 HistoryDealGetDouble(trans.deal,DEAL_FEE);
      NotifyExit(side,price,net);
     }
  }
