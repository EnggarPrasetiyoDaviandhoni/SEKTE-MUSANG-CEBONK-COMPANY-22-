// CEBONK COMPANY 22 — SINCE 2016
// Experimental H1 BBMA -> M15 MA50 x MidBB + CSAK/CSM -> M5 IB/CB1/Fibo Elite
// Standalone / demo default. Fibo structural SL and 1.618 TP; ATR is a SL sanity check ONLY.
#property strict
#property version "1.05"
#include <Trade/Trade.mqh>

input group "Execution | DEMO default"
input bool   StartAutopilot=false;
input bool   AllowRealAccount=false;
input ulong  Magic=22101505;
input double FixedLot=0.01;
input int    LayersPerSetup=3;
input int    MaxTotalLayers=3;
input int    MaxSpreadPoints=70;
input int    SlippagePoints=20;
input int    StartBrokerHour=7;
input int    EndBrokerHour=23;
input group "Signals H1 > M15 > M5"
input int    ReentryAgeH1=8;
input int    ConfirmAgeM15=12;
input int    CrossSignalMaxGapM15=3;
input int    IBSearchM5=8;
input int    CBLookbackM5=80;
input int    PivotDepth=2;
input int    SetupExpiryM5=24;
input double IBMinBodyRatio=0.50;
input ENUM_MA_METHOD MA50Method=MODE_EMA;
input group "Old sideways + Fibo Elite / ATR sanity"
input double MinBBWidthATR=1.80;
input int    ATRPeriod=14;
input double MinSL_ATR_M5=0.50;
input double MaxSL_ATR_M5=8.00;
input double MinimumRR=2.0;
input group "Money management"
input double MaxRiskPerOrderPct=0.50;
input double MaxOpenRiskPct=2.00;
input double DailyLossLimitPct=5.00;
input group "Alerts"
input bool   PushEnabled=false;
input bool   TelegramEnabled=false;
input string TelegramToken="";
input string TelegramChatId="";

CTrade tr;
int bb1=INVALID_HANDLE,bb2=INVALID_HANDLE,atr2=INVALID_HANDLE,atr3=INVALID_HANDLE,ma50=INVALID_HANDLE;
int l5=INVALID_HANDLE,l10=INVALID_HANDLE,h5=INVALID_HANDLE,h10=INVALID_HANDLE;
int t2h5=INVALID_HANDLE,t2h10=INVALID_HANDLE,t2l5=INVALID_HANDLE,t2l10=INVALID_HANDLE;
bool pilot=false;
datetime lastBar=0;
string key="",btn="C22_AUTOPILOT";
struct Event
{
   int phase,dir;                      // 0 idle, 1 waiting CB1, 2 waiting first Fibo retest
   datetime ib,bias,confirm,breakBar;
   double zoneLo,zoneHi,cb1,f0,f1;
};
Event ev;

bool Bar(ENUM_TIMEFRAMES tf,int s,MqlRates &b)
{
   MqlRates a[1];
   if(s<1 || CopyRates(_Symbol,tf,s,1,a)!=1)return false;
   b=a[0];
   return(b.time>0 && b.low>0 && b.high>=b.low && b.close>0);
}
bool Val(int h,int buffer,int s,double &v)
{
   double a[1]; if(h==INVALID_HANDLE || CopyBuffer(h,buffer,s,1,a)!=1)return false;
   v=a[0];return(MathIsValidNumber(v)&&v>0&&v!=EMPTY_VALUE);
}
datetime CloseAt(ENUM_TIMEFRAMES tf,int s)
{
   datetime t=iTime(_Symbol,tf,s);
   return(t>0?t+PeriodSeconds(tf):0);
}
double Body(const MqlRates &b)
{
   return(b.high>b.low?MathAbs(b.close-b.open)/(b.high-b.low):0.0);
}
double TickRound(double p,bool up)
{
   double step=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(step<=0)return 0;
   return NormalizeDouble((up?MathCeil(p/step-1e-9):MathFloor(p/step+1e-9))*step,_Digits);
}
string GV(string suffix){return key+"."+suffix;}
void Save()
{
   // Phase written last to avoid treating partially written values as armed.
   GlobalVariableSet(GV("phase"),0);
   GlobalVariableSet(GV("dir"),ev.dir);
   GlobalVariableSet(GV("ib"),(double)ev.ib);
   GlobalVariableSet(GV("bias"),(double)ev.bias);
   GlobalVariableSet(GV("conf"),(double)ev.confirm);
   GlobalVariableSet(GV("break"),(double)ev.breakBar);
   GlobalVariableSet(GV("low"),ev.zoneLo);
   GlobalVariableSet(GV("high"),ev.zoneHi);
   GlobalVariableSet(GV("cb"),ev.cb1);
   GlobalVariableSet(GV("f0"),ev.f0);
   GlobalVariableSet(GV("f1"),ev.f1);
   GlobalVariableSet(GV("phase"),ev.phase);
   GlobalVariablesFlush();
}
void Clear()
{
   ev.phase=0;ev.dir=0;ev.ib=0;ev.bias=0;ev.confirm=0;ev.breakBar=0;
   ev.zoneLo=0;ev.zoneHi=0;ev.cb1=0;ev.f0=0;ev.f1=0;Save();
}
void Restore()
{
   ev.phase=0;
   if(!GlobalVariableCheck(GV("phase")))return;
   int phase=(int)GlobalVariableGet(GV("phase"));
   string names[10]={"dir","ib","bias","conf","break","low","high","cb","f0","f1"};
   for(int i=0;i<10;i++)if(!GlobalVariableCheck(GV(names[i])))return;
   ev.dir=(int)GlobalVariableGet(GV("dir"));
   ev.ib=(datetime)GlobalVariableGet(GV("ib"));
   ev.bias=(datetime)GlobalVariableGet(GV("bias"));
   ev.confirm=(datetime)GlobalVariableGet(GV("conf"));
   ev.breakBar=(datetime)GlobalVariableGet(GV("break"));
   ev.zoneLo=GlobalVariableGet(GV("low"));ev.zoneHi=GlobalVariableGet(GV("high"));
   ev.cb1=GlobalVariableGet(GV("cb"));ev.f0=GlobalVariableGet(GV("f0"));ev.f1=GlobalVariableGet(GV("f1"));
   if((phase!=1&&phase!=2)||(ev.dir!=1&&ev.dir!=-1)||
      ev.ib<=0||ev.zoneLo<=0||ev.zoneHi<=ev.zoneLo||
      (phase==2&&(ev.breakBar<=ev.ib||MathAbs(ev.f1-ev.f0)<_Point)))
   {Clear();return;}
   int age=iBarShift(_Symbol,PERIOD_M5,ev.ib,true);
   if(age<0||age>SetupExpiryM5){Clear();return;}
   ev.phase=phase;
}
double Fib(double n){return ev.f0+(ev.f1-ev.f0)*n;}
bool SidewaysOK()
{
   double up,dn,at;
   // Missing history blocks BOTH directions (fail closed).
   return Val(bb2,1,1,up)&&Val(bb2,2,1,dn)&&Val(atr2,0,1,at)&&
          at>0&&up>dn&&(up-dn)/at>=MinBBWidthATR;
}
bool SessionOK()
{
   MqlDateTime d;TimeToStruct(TimeCurrent(),d);
   if(d.day_of_week==0||d.day_of_week==6)return false;
   if(StartBrokerHour==EndBrokerHour)return true;
   if(StartBrokerHour<EndBrokerHour)return(d.hour>=StartBrokerHour&&d.hour<EndBrokerHour);
   return(d.hour>=StartBrokerHour||d.hour<EndBrokerHour);
}
bool CanTrade()
{
   if(!pilot||!SessionOK())return false;
   if(!AllowRealAccount && AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL)return false;
   return(MQLInfoInteger(MQL_TRADE_ALLOWED)&&TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)&&
          AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)&&AccountInfoInteger(ACCOUNT_TRADE_EXPERT));
}
void Button()
{
   if(ObjectFind(0,btn)<0)
   {
      ObjectCreate(0,btn,OBJ_BUTTON,0,0,0);
      ObjectSetInteger(0,btn,OBJPROP_XDISTANCE,12);ObjectSetInteger(0,btn,OBJPROP_YDISTANCE,20);
      ObjectSetInteger(0,btn,OBJPROP_XSIZE,155);ObjectSetInteger(0,btn,OBJPROP_YSIZE,28);
   }
   ObjectSetString(0,btn,OBJPROP_TEXT,pilot?"AUTOPILOT ON":"AUTOPILOT OFF");
   ObjectSetInteger(0,btn,OBJPROP_BGCOLOR,pilot?clrDarkGreen:clrMaroon);
   ObjectSetInteger(0,btn,OBJPROP_COLOR,clrWhite);
   ObjectSetInteger(0,btn,OBJPROP_STATE,false);
}
// Latest valid re-entry takes priority; CLOSED H1 candles exclusively.
bool H1Bias(int &dir,datetime &when)
{
   dir=0;when=0;
   for(int s=1;s<=ReentryAgeH1;s++)
   {
      MqlRates b;double mid,lo5,lo10,hi5,hi10;
      if(!Bar(PERIOD_H1,s,b)||!Val(bb1,0,s,mid)||
         !Val(l5,0,s,lo5)||!Val(l10,0,s,lo10)||
         !Val(h5,0,s,hi5)||!Val(h10,0,s,hi10))continue;
      bool buy=b.low<=MathMax(lo5,lo10)&&b.close>lo5&&b.close>lo10&&
               lo5>mid&&lo10>mid&&b.close>b.open;
      bool sell=b.high>=MathMin(hi5,hi10)&&b.close<hi5&&b.close<hi10&&
                hi5<mid&&hi10<mid&&b.close<b.open;
      if(buy==sell)continue;
      dir=buy?1:-1;when=CloseAt(PERIOD_H1,s);return true;
   }
   return false;
}
bool M15Signal(int dir,int s)
{
   MqlRates b,p;double mid,up,dn,a,c,ma;
   if(!Bar(PERIOD_M15,s,b)||!Bar(PERIOD_M15,s+1,p)||Body(b)<0.50||
      !Val(bb2,0,s,mid)||!Val(bb2,1,s,up)||!Val(bb2,2,s,dn)||
      !Val(ma50,0,s,ma))return false;
   // Zone Zero Loss proxy: MA50 entirely outside signal candle, same direction.
   if(dir>0 && !(ma<b.low&&ma<mid&&b.close>b.open))return false;
   if(dir<0 && !(ma>b.high&&ma>mid&&b.close<b.open))return false;
   if(dir>0)
   {
      if(!Val(t2h5,0,s,a)||!Val(t2h10,0,s,c))return false;
      double edge=MathMax(mid,MathMax(a,c));
      return(b.close>edge&&(b.open<=edge||p.close<=edge))||
            (b.close>up&&b.open<=up);
   }
   if(!Val(t2l5,0,s,a)||!Val(t2l10,0,s,c))return false;
   double edge=MathMin(mid,MathMin(a,c));
   return(b.close<edge&&(b.open>=edge||p.close>=edge))||
         (b.close<dn&&b.open>=dn);
}
bool M15Cross(int dir,int s)
{
   double ma,old,mid,prev;
   if(!Val(ma50,0,s,ma)||!Val(ma50,0,s+1,old)||
      !Val(bb2,0,s,mid)||!Val(bb2,0,s+1,prev))return false;
   // Same as older 3TF engine: BUY MidBB crosses ABOVE MA50; SELL BELOW.
   return(dir>0?(old>=prev&&ma<mid):(old<=prev&&ma>mid));
}
bool M15Confirm(int dir,datetime after,datetime &when)
{
   when=0;
   for(int s=1;s<=ConfirmAgeM15;s++)
   {
      if(CloseAt(PERIOD_M15,s)<after || !M15Signal(dir,s))continue;
      for(int c=1;c<=ConfirmAgeM15;c++)
      {
         if(MathAbs(s-c)>CrossSignalMaxGapM15||
            CloseAt(PERIOD_M15,c)<after||!M15Cross(dir,c))continue;
         datetime t=MathMax(CloseAt(PERIOD_M15,s),CloseAt(PERIOD_M15,c));
         if(t>when)when=t;
      }
   }
   return when>0;
}
bool Pivot(int s,int dir)
{
   MqlRates b,n;
   if(!Bar(PERIOD_M5,s,b))return false;
   for(int k=1;k<=PivotDepth;k++)
   {
      MqlRates a,c;
      if(!Bar(PERIOD_M5,s-k,a)||!Bar(PERIOD_M5,s+k,c))return false;
      if(dir>0&&(a.low<=b.low||c.low<b.low))return false;
      if(dir<0&&(a.high>=b.high||c.high>b.high))return false;
   }
   return true;
}
bool CBLevel(int dir,double &level)
{
   int newest=-1,older=-1;
   for(int s=PivotDepth+2;s<=CBLookback;s++)
   {
      if(!Pivot(s,dir))continue;
      MqlRates b; if(!Bar(PERIOD_M5,s,b))return false;
      if(newest<0){newest=s;continue;}
      MqlRates n;if(!Bar(PERIOD_M5,newest,n))return false;
      if(dir>0&&n.low<b.low){older=s;break;}
      if(dir<0&&n.high>b.high){older=s;break;}
   }
   if(older<0)return false;
   level=(dir>0?-DBL_MAX:DBL_MAX);
   for(int i=newest+1;i<older;i++)
   {
      MqlRates x;if(!Bar(PERIOD_M5,i,x))return false;
      if(dir>0)level=MathMax(level,x.high);
      else level=MathMin(level,x.low);
   }
   return(level>0&&level<DBL_MAX);
}
bool ArmIB(int dir,datetime bias,datetime conf)
{
   MqlRates b,p;
   if(!Bar(PERIOD_M5,1,b)||!Bar(PERIOD_M5,2,p)||
      CloseAt(PERIOD_M5,1)<=conf||Body(b)<IBMinBodyRatio)return false;
   if(dir>0?!(b.close>b.open&&b.close>p.high):
             !(b.close<b.open&&b.close<p.low))return false;
   double level;if(!CBLevel(dir,level))return false;
   if(dir>0?b.close>=level:b.close<=level)return false; // IB must precede CB1
   double extreme=(dir>0?DBL_MAX:-DBL_MAX);int idx=-1;
   for(int s=2;s<=IBSearchM5+1;s++)
   {
      MqlRates x;if(!Bar(PERIOD_M5,s,x))return false;
      if(dir>0&&x.low<extreme){extreme=x.low;idx=s;}
      if(dir<0&&x.high>extreme){extreme=x.high;idx=s;}
   }
   MqlRates base;if(idx<2||!Bar(PERIOD_M5,idx,base))return false;
   double zlo=(dir>0?base.low:MathMin(base.open,base.close));
   double zhi=(dir>0?MathMax(base.open,base.close):base.high);
   if(zlo<=0||zhi<=zlo)return false;
   ev.phase=1;ev.dir=dir;ev.ib=b.time;ev.bias=bias;ev.confirm=conf;
   ev.breakBar=0;ev.zoneLo=zlo;ev.zoneHi=zhi;ev.cb1=level;
   ev.f0=0;ev.f1=0;Save();
   PrintFormat("IB_ARMED %s CB1=%f Zone=[%f,%f]",dir>0?"BUY":"SELL",level,zlo,zhi);
   return true;
}
bool Expired()
{
   int s=iBarShift(_Symbol,PERIOD_M5,ev.ib,true);
   return(s<0||s>SetupExpiryM5);
}
int TotalLayers()
{
   int n=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong t=PositionGetTicket(i);
      if(t>0&&PositionGetString(POSITION_SYMBOL)==_Symbol&&
         (ulong)PositionGetInteger(POSITION_MAGIC)==Magic)n++;
   }
   // Reject other outstanding EA orders rather than double-execute.
   for(int j=OrdersTotal()-1;j>=0;j--)
   {
      ulong t=OrderGetTicket(j);
      if(t>0&&OrderGetString(ORDER_SYMBOL)==_Symbol&&
         (ulong)OrderGetInteger(ORDER_MAGIC)==Magic)n++;
   }
   return n;
}
bool CashRisk(int dir,double lot,double entry,double sl,double &risk)
{
   double pnl=0;
   ENUM_ORDER_TYPE type=dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
   if(!OrderCalcProfit(type,_Symbol,lot,entry,sl,pnl)||pnl>=0)return false;
   risk=-pnl;return true;
}
bool RiskAllowed(int dir,double entry,double sl)
{
   double equity=AccountInfoDouble(ACCOUNT_EQUITY),risk;
   if(equity<=0||!CashRisk(dir,FixedLot,entry,sl,risk)||
      risk>equity*MaxRiskPerOrderPct/100.0)return false;
   double aggregate=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      if(PositionGetTicket(i)==0)continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol||
         (ulong)PositionGetInteger(POSITION_MAGIC)!=Magic)continue;
      double oldSL=PositionGetDouble(POSITION_SL),oldEntry=PositionGetDouble(POSITION_PRICE_OPEN);
      int d=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;
      double exposure=0;
      if(oldSL<=0 || !CashRisk(d,PositionGetDouble(POSITION_VOLUME),oldEntry,oldSL,exposure))
         return false;
      aggregate+=exposure;
   }
   // No other pending orders permitted. Prevent uncounted reservation risk.
   for(int j=OrdersTotal()-1;j>=0;j--)
   {
      if(OrderGetTicket(j)>0&&OrderGetString(ORDER_SYMBOL)==_Symbol&&
         (ulong)OrderGetInteger(ORDER_MAGIC)==Magic)return false;
   }
   return aggregate+risk<=equity*MaxOpenRiskPct/100.0;
}
bool DailyOK()
{
   MqlDateTime d;TimeToStruct(TimeCurrent(),d);
   string k=GV(StringFormat("day%d%02d%02d",d.year,d.mon,d.day));
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   if(!GlobalVariableCheck(k))GlobalVariableSet(k,equity);
   double first=GlobalVariableGet(k);
   return(first>0&&equity>=first*(1.0-DailyLossLimitPct/100.0));
}
bool SizeOK()
{
   double minV=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxV=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   return(step>0&&FixedLot>=minV&&FixedLot<=maxV&&
          MathAbs(FixedLot/step-MathRound(FixedLot/step))<1e-6);
}
bool Quote(MqlTick &t)
{
   if(!SymbolInfoTick(_Symbol,t)||t.bid<=0||t.ask<=t.bid)return false;
   return((t.ask-t.bid)/_Point<=MaxSpreadPoints);
}
bool StopsOK(int dir,const MqlTick &t,double sl,double tp)
{
   double required=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
   required=MathMax(required,(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)*_Point);
   required+=_Point;
   return(dir>0?t.bid-sl>required&&tp-t.bid>required:
                 sl-t.ask>required&&t.ask-tp>required);
}
void Execute()
{
   if(!CanTrade()||!DailyOK()||!SizeOK()||!SidewaysOK()||
      AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)return;
   MqlTick tick;if(!Quote(tick))return;
   double price=ev.dir>0?tick.ask:tick.bid;
   double lo=MathMin(Fib(0.12),Fib(0.236)),hi=MathMax(Fib(0.12),Fib(0.236));
   if(price<lo||price>hi)return;
   double sl=TickRound(ev.dir>0?ev.zoneLo:ev.zoneHi,ev.dir<0);
   double tp=TickRound(Fib(1.618),ev.dir<0); // conservative target rounding
   double distance=ev.dir*(price-sl),reward=ev.dir*(tp-price);
   double atr;if(!Val(atr3,0,1,atr)||distance<=0||reward/distance<MinimumRR||
      distance<MinSL_ATR_M5*atr||distance>MaxSL_ATR_M5*atr||
      !StopsOK(ev.dir,tick,sl,tp))return;
   if(TotalLayers()>=MaxTotalLayers)return;
   // Atomic claim makes a retest consumable at most once across all charts/restarts.
   string claim=GV("claim");if(!GlobalVariableCheck(claim))GlobalVariableSet(claim,0);
   double previous=GlobalVariableGet(claim);
   if(previous>=(double)ev.ib||!GlobalVariableSetOnCondition(claim,(double)ev.ib,previous))return;
   GlobalVariablesFlush();
   if(!tr.SetTypeFillingBySymbol(_Symbol))return;
   for(int layer=0;layer<LayersPerSetup;layer++)
   {
      if(!CanTrade()||!DailyOK()||TotalLayers()>=MaxTotalLayers)break;
      if(!Quote(tick))break;
      price=ev.dir>0?tick.ask:tick.bid;
      if(price<lo||price>hi)break;
      distance=ev.dir*(price-sl);reward=ev.dir*(tp-price);
      if(distance<=0||reward/distance<MinimumRR||
         distance<MinSL_ATR_M5*atr||distance>MaxSL_ATR_M5*atr||
         !StopsOK(ev.dir,tick,sl,tp)||!RiskAllowed(ev.dir,price,sl))break;
      double margin=0;
      if(!OrderCalcMargin(ev.dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL,_Symbol,
                          FixedLot,price,margin)||
         margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))break;
      string note=StringFormat("C22FM%I64d-L%d",(long)ev.ib,layer+1);
      bool ok=ev.dir>0?tr.Buy(FixedLot,_Symbol,price,sl,tp,note):
                       tr.Sell(FixedLot,_Symbol,price,sl,tp,note);
      uint rc=tr.ResultRetcode();
      if(!ok||(rc!=TRADE_RETCODE_DONE&&rc!=TRADE_RETCODE_DONE_PARTIAL))
      {
         Print("ORDER_UNCERTAIN_STOP ",rc," ",tr.ResultRetcodeDescription());
         break; // no blind retry; claim persists
      }
      PrintFormat("FIBO_FILL_REQUEST layer=%d price=%f SL=%f TP=%f RR=%f",
                  layer+1,price,sl,tp,reward/distance);
   }
   Clear();
}
string Encode(string s)
{
   uchar a[];int n=StringToCharArray(s,a,0,WHOLE_ARRAY,CP_UTF8);string out="";
   for(int i=0;i<n-1;i++)
   {
      int c=(int)a[i];
      if((c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||
         c==45||c==95||c==46||c==126)out+=CharToString((uchar)c);
      else out+=StringFormat("%%%02X",c);
   }
   return out;
}
void Alert(string msg)
{
   Print(msg);
   if(PushEnabled)SendNotification(msg);
   if(!TelegramEnabled||TelegramToken==""||TelegramChatId==""||
      MQLInfoInteger(MQL_TESTER))return;
   string post="chat_id="+Encode(TelegramChatId)+"&text="+Encode(msg);
   char data[],answer[];string headers;
   int n=StringToCharArray(post,data,0,WHOLE_ARRAY,CP_UTF8);
   if(n>0)ArrayResize(data,n-1);
   int rc=WebRequest("POST","https://api.telegram.org/bot"+TelegramToken+
                     "/sendMessage","Content-Type: application/x-www-form-urlencoded\r\n",
                     5000,data,answer,headers);
   if(rc!=200)Print("TELEGRAM_FAIL ",rc," err ",GetLastError());
}
void Reconcile(ulong id)
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0||PositionGetInteger(POSITION_IDENTIFIER)!=(long)id)continue;
      double open=PositionGetDouble(POSITION_PRICE_OPEN);
      double sl=PositionGetDouble(POSITION_SL),tp=PositionGetDouble(POSITION_TP);
      int dir=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;
      if(sl<=0||tp<=0||dir*(open-sl)<=0||
         dir*(tp-open)/MathAbs(open-sl)<MinimumRR)
      {
         pilot=false;Button();Print("FILL_HALT: unsafe realized SL/TP; closing ",ticket);
         if(!tr.PositionClose(ticket))Print("EMERGENCY_CLOSE_FAILED ",GetLastError());
      }
      return;
   }
}
void OnTradeTransaction(const MqlTradeTransaction &x,
                        const MqlTradeRequest &req,const MqlTradeResult &res)
{
   if(x.type!=TRADE_TRANSACTION_DEAL_ADD||!HistoryDealSelect(x.deal))return;
   if(HistoryDealGetString(x.deal,DEAL_SYMBOL)!=_Symbol||
      (ulong)HistoryDealGetInteger(x.deal,DEAL_MAGIC)!=Magic)return;
   long id=HistoryDealGetInteger(x.deal,DEAL_POSITION_ID);
   ENUM_DEAL_ENTRY side=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(x.deal,DEAL_ENTRY);
   if(side!=DEAL_ENTRY_IN&&side!=DEAL_ENTRY_OUT)return;
   if(side==DEAL_ENTRY_IN)Reconcile((ulong)id);
   else
   {
      ENUM_DEAL_REASON why=(ENUM_DEAL_REASON)HistoryDealGetInteger(x.deal,DEAL_REASON);
      if(why!=DEAL_REASON_TP&&why!=DEAL_REASON_SL)return;
   }
   string notice=GV(StringFormat("n%I64d%d",id,(int)side));
   if(GlobalVariableCheck(notice))return;
   GlobalVariableSet(notice,(double)TimeCurrent());GlobalVariablesFlush();
   double p=HistoryDealGetDouble(x.deal,DEAL_PRICE);
   string action=side==DEAL_ENTRY_IN?
        (HistoryDealGetInteger(x.deal,DEAL_TYPE)==DEAL_TYPE_BUY?"BUY":"SELL"):
        (HistoryDealGetInteger(x.deal,DEAL_REASON)==DEAL_REASON_TP?"TAKE PROFIT":"STOP LOSS");
   Alert(StringFormat("SEKTE MUSANG TEORY CEBONK COMPANY 22\n%s %s @ %s\nTF H1/M15/M5 | FIBO ELITE",
         action,_Symbol,DoubleToString(p,_Digits)));
}
void OnTick()
{
   datetime bar=iTime(_Symbol,PERIOD_M5,1);
   if(bar<=0)return;
   // Sideways invalidates armed setups, regardless of BUY/SELL.
   if(ev.phase!=0)
   {
      if(Expired()||!SidewaysOK()){Print("CANCEL_EXPIRED_OR_SIDEWAYS");Clear();}
      else
      {
         int d=0;datetime bt=0;
         if(H1Bias(d,bt)&&d!=ev.dir&&bt>ev.bias){Print("CANCEL_REVERSE_H1");Clear();}
         else
         {
            double ma,mid;MqlRates m15;
            if(!Bar(PERIOD_M15,1,m15)||!Val(ma50,0,1,ma)||!Val(bb2,0,1,mid)||
               (ev.dir>0?ma>=mid||ma>=m15.low:ma<=mid||ma<=m15.high))
            {Print("CANCEL_MA50_INVALID");Clear();}
         }
      }
   }
   if(bar!=lastBar)
   {
      MqlRates b;
      if(!Bar(PERIOD_M5,1,b))return;
      lastBar=bar;
      if(ev.phase==1)
      {
         if(ev.dir>0?b.close<ev.zoneLo:b.close>ev.zoneHi){Clear();return;}
         if(CloseAt(PERIOD_M5,1)>ev.ib&&Body(b)>=0.40&&
            (ev.dir>0?b.close>b.open&&b.close>ev.cb1:
                       b.close<b.open&&b.close<ev.cb1))
         {
            ev.phase=2;ev.breakBar=b.time;
            ev.f0=ev.dir>0?ev.zoneLo:ev.zoneHi;ev.f1=b.close;
            if(ev.dir*(ev.f1-ev.f0)<=_Point)Clear();
            else{Save();Print("CB1_BREAK_WAIT_FIBO_RETEST");}
         }
      }
      else if(ev.phase==0)
      {
         int dir;datetime bias,conf;
         if(SidewaysOK()&&H1Bias(dir,bias)&&M15Confirm(dir,bias,conf))
            ArmIB(dir,bias,conf);
      }
   }
   if(ev.phase!=2)return;
   // No same-break-candle fills; first retest only; next tick executes at quoted price.
   if(iTime(_Symbol,PERIOD_M5,0)<=ev.breakBar)return;
   MqlTick t;if(!Quote(t))return;
   double price=ev.dir>0?t.ask:t.bid;
   if(ev.dir>0? t.bid<ev.zoneLo : t.ask>ev.zoneHi){Clear();return;}
   double lo=MathMin(Fib(0.12),Fib(0.236)),hi=MathMax(Fib(0.12),Fib(0.236));
   if(price>=lo&&price<=hi)Execute();
}
int OnInit()
{
   if(ReentryAgeH1<1||ConfirmAgeM15<1||CrossSignalMaxGapM15<0||
      IBSearchM5<2||CBLookbackM5<20||PivotDepth<1||
      SetupExpiryM5<3||IBMinBodyRatio<=0||IBMinBodyRatio>1||
      MinBBWidthATR<=0||ATRPeriod<2||MinSL_ATR_M5<=0||
      MaxSL_ATR_M5<=MinSL_ATR_M5||MinimumRR<2||
      FixedLot<=0||LayersPerSetup<1||MaxTotalLayers<1||
      MaxTotalLayers<LayersPerSetup||MaxRiskPerOrderPct<=0||
      MaxOpenRiskPct<MaxRiskPerOrderPct||DailyLossLimitPct<=0||
      DailyLossLimitPct>100||MaxSpreadPoints<0||SlippagePoints<0||
      StartBrokerHour<0||StartBrokerHour>23||EndBrokerHour<0||EndBrokerHour>24)
      return INIT_PARAMETERS_INCORRECT;
   bb1=iBands(_Symbol,PERIOD_H1,20,0,2.0,PRICE_CLOSE);
   bb2=iBands(_Symbol,PERIOD_M15,20,0,2.0,PRICE_CLOSE);
   atr2=iATR(_Symbol,PERIOD_M15,ATRPeriod);atr3=iATR(_Symbol,PERIOD_M5,ATRPeriod);
   ma50=iMA(_Symbol,PERIOD_M15,50,0,MA50Method,PRICE_CLOSE);
   l5=iMA(_Symbol,PERIOD_H1,5,0,MODE_LWMA,PRICE_LOW);
   l10=iMA(_Symbol,PERIOD_H1,10,0,MODE_LWMA,PRICE_LOW);
   h5=iMA(_Symbol,PERIOD_H1,5,0,MODE_LWMA,PRICE_HIGH);
   h10=iMA(_Symbol,PERIOD_H1,10,0,MODE_LWMA,PRICE_HIGH);
   t2h5=iMA(_Symbol,PERIOD_M15,5,0,MODE_LWMA,PRICE_HIGH);
   t2h10=iMA(_Symbol,PERIOD_M15,10,0,MODE_LWMA,PRICE_HIGH);
   t2l5=iMA(_Symbol,PERIOD_M15,5,0,MODE_LWMA,PRICE_LOW);
   t2l10=iMA(_Symbol,PERIOD_M15,10,0,MODE_LWMA,PRICE_LOW);
   int hs[12]={bb1,bb2,atr2,atr3,ma50,l5,l10,h5,h10,t2h5,t2h10,t2l5};
   for(int i=0;i<12;i++)if(hs[i]==INVALID_HANDLE)return INIT_FAILED;
   if(t2l10==INVALID_HANDLE)return INIT_FAILED;
   if(!SizeOK())return INIT_PARAMETERS_INCORRECT;
   if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
   {Print("HEDGING_ACCOUNT_REQUIRED");return INIT_FAILED;}
   key=StringFormat("C22.%I64d.%s.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),_Symbol,Magic);
   if(StringLen(key)>37)return INIT_PARAMETERS_INCORRECT;
   tr.SetExpertMagicNumber(Magic);
   tr.SetDeviationInPoints(SlippagePoints);
   tr.SetAsyncMode(false);
   pilot=StartAutopilot;
   if(!AllowRealAccount&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL)pilot=false;
   Restore();
   lastBar=iTime(_Symbol,PERIOD_M5,1);
   Button();
   Print("CEBONK v1.05 EXPERIMENTAL | H1->M15 MA50 CROSS->M5 FIBO | COMPILE + BACKTEST REQUIRED");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason)
{
   int hs[13]={bb1,bb2,atr2,atr3,ma50,l5,l10,h5,h10,t2h5,t2h10,t2l5,t2l10};
   for(int i=0;i<13;i++)if(hs[i]!=INVALID_HANDLE)IndicatorRelease(hs[i]);
   ObjectDelete(0,btn);
}
void OnChartEvent(const int id,const long &l,const double &d,const string &s)
{
   if(id==CHARTEVENT_OBJECT_CLICK&&s==btn)
   {
      pilot=!pilot;
      if(!AllowRealAccount&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL)
         pilot=false;
      Button();
   }
}
