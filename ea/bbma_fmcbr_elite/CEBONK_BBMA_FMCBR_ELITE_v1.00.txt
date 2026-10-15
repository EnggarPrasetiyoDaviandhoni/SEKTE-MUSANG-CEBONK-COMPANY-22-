// CEBONK COMPANY 22 — SINCE 2016
// BBMA Re-entry -> CSAK/Momentum -> FMCBR (EL2 / EL3A / EL3B) -> Elite projection.
// Independent experimental engine: never silently replaces earlier BBMA EAs.
#property strict
#property version "1.00"
#property description "CEBONK BBMA + FMCBR EL2/EL3 + Fibo Musang Elite. Fixed RR 1:2."
#include <Trade/Trade.mqh>

enum MUSANG_PACKAGE
{
   PACKAGE_H1_M15_M5=0,
   PACKAGE_M15_M5_M1=1,
   PACKAGE_H4_H1_M15=2,
   PACKAGE_M30_M5_M1=3,
   PACKAGE_D1_H4_H1=4,
   PACKAGE_W1_D1_H4=5,
   PACKAGE_MN1_W1_D1=6
};
enum MUSANG_ENTRY { ENTRY_EL2=0, ENTRY_EL3_A=1, ENTRY_EL3_B=2 };

input group "=== CEBONK - EXECUTION ==="
input MUSANG_PACKAGE InpPackage=PACKAGE_H1_M15_M5;
input MUSANG_ENTRY InpEntryMode=ENTRY_EL2;
input bool InpStartAutoPilot=true;
input double InpFixedLot=0.01;
input ulong InpMagic=22102610;
input int InpMaxSpreadPoints=70;
input int InpSlippagePoints=20;
input int InpStartHour=7;
input int InpEndHour=23;

input group "=== BBMA / FMCBR QUALITY ==="
input int InpReentryAge=8;        // TF1 closed bars
input int InpEventAge=12;         // TF2 closed bars
input int InpIBSearch=8;         // TF3 base-candle search
input int InpCBLookback=20;      // TF3 confirmed pivots
input double InpIBMinBodyRatio=0.50;
input int InpSetupExpiry=24;     // TF3 bars, no calendar-gap expiry

input group "=== STRUCTURE SL / RR ==="
input int InpATRPeriod=14;
input double InpATRBuffer=0.20;
input double InpRiskReward=2.0;
input double InpMaxSpreadRiskFraction=0.20;

input group "=== TELEGRAM / MT5 ==="
input bool InpTelegramEnabled=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpPushEnabled=false;

CTrade gTrade;
ENUM_TIMEFRAMES gTF1,gTF2,gTF3;
int gBB1=INVALID_HANDLE,gBB2=INVALID_HANDLE,gATR=INVALID_HANDLE;
int gM5Low=INVALID_HANDLE,gM10Low=INVALID_HANDLE;
int gM5High=INVALID_HANDLE,gM10High=INVALID_HANDLE;
int gT2M5High=INVALID_HANDLE,gT2M10High=INVALID_HANDLE;
int gT2M5Low=INVALID_HANDLE,gT2M10Low=INVALID_HANDLE;
bool gPilot=true;
datetime gProcessed=0;
string gButton="CEBONK_ELITE_AUTOPILOT",gClaimKey="";
double gEliteLevels[18]={0.0,0.12,0.236,0.382,0.5,0.786,0.88,
                          1.272,1.314,1.618,1.786,1.88,2.618,
                          2.786,2.880,4.23,4.786,4.88};

struct Setup
{
   bool active;
   int dir;
   int phase;                    // 1 CB1, 2 CB2, 3 last retest, 4 first retest
   datetime ibTime;
   datetime biasTime;
   datetime confirmTime;
   double zoneLo,zoneHi,cb1,cb2;
   bool hasCB2;
   double fibBase,fibAnchor;     // locked after CB1 candle CLOSE
};
Setup gS;
double gOrderSL=0,gOrderTP=0,gOrderFibo1=0,gOrderFibo2=0,gOrderCycle=0;
datetime gOrderIB=0;

void ResetSetup()
{
   gS.active=false;gS.dir=0;gS.phase=0;gS.ibTime=0;
   gS.biasTime=0;gS.confirmTime=0;gS.zoneLo=0;gS.zoneHi=0;
   gS.cb1=0;gS.cb2=0;gS.hasCB2=false;
   gS.fibBase=0;gS.fibAnchor=0;
}
string TFName(ENUM_TIMEFRAMES tf){return EnumToString(tf);}
string ModeName(){return(InpEntryMode==ENTRY_EL2?"EL2":(InpEntryMode==ENTRY_EL3_A?"EL3A":"EL3B"));}
double PointSize(){return SymbolInfoDouble(_Symbol,SYMBOL_POINT);}
bool ReadBar(ENUM_TIMEFRAMES tf,int shift,MqlRates &b)
{
   MqlRates a[1];
   if(CopyRates(_Symbol,tf,shift,1,a)!=1) return false;
   b=a[0];
   return (b.high>=b.low && b.close>0 && b.time>0);
}
bool Value(int handle,int buffer,int shift,double &v)
{
   double a[1];
   if(handle==INVALID_HANDLE || CopyBuffer(handle,buffer,shift,1,a)!=1) return false;
   v=a[0];
   return(MathIsValidNumber(v) && v!=EMPTY_VALUE && v>0.0);
}
double BodyRatio(const MqlRates &b)
{
   double range=b.high-b.low;
   return(range>0.0?MathAbs(b.close-b.open)/range:0.0);
}
datetime ClosedAt(ENUM_TIMEFRAMES tf,const MqlRates &b)
{
   int shift=iBarShift(_Symbol,tf,b.time,true);
   return(shift>0?iTime(_Symbol,tf,shift-1):0);
}
void SelectPackage()
{
   switch(InpPackage)
   {
      case PACKAGE_M15_M5_M1: gTF1=PERIOD_M15;gTF2=PERIOD_M5;gTF3=PERIOD_M1;break;
      case PACKAGE_H4_H1_M15: gTF1=PERIOD_H4;gTF2=PERIOD_H1;gTF3=PERIOD_M15;break;
      case PACKAGE_M30_M5_M1: gTF1=PERIOD_M30;gTF2=PERIOD_M5;gTF3=PERIOD_M1;break;
      case PACKAGE_D1_H4_H1: gTF1=PERIOD_D1;gTF2=PERIOD_H4;gTF3=PERIOD_H1;break;
      case PACKAGE_W1_D1_H4: gTF1=PERIOD_W1;gTF2=PERIOD_D1;gTF3=PERIOD_H4;break;
      case PACKAGE_MN1_W1_D1: gTF1=PERIOD_MN1;gTF2=PERIOD_W1;gTF3=PERIOD_D1;break;
      default: gTF1=PERIOD_H1;gTF2=PERIOD_M15;gTF3=PERIOD_M5;break;
   }
}
void PaintButton()
{
   if(ObjectFind(0,gButton)<0)
   {
      ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0);
      ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12);
      ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,20);
      ObjectSetInteger(0,gButton,OBJPROP_XSIZE,165);
      ObjectSetInteger(0,gButton,OBJPROP_YSIZE,29);
   }
   ObjectSetString(0,gButton,OBJPROP_TEXT,gPilot?"AUTOPILOT ON":"AUTOPILOT OFF");
   ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gPilot?clrDarkGreen:clrMaroon);
   ObjectSetInteger(0,gButton,OBJPROP_COLOR,clrWhite);
   ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
   ChartRedraw();
}
bool SessionOK()
{
   MqlDateTime t;
   TimeToStruct(TimeCurrent(),t);
   if(t.day_of_week==0 || t.day_of_week==6) return false;
   if(InpStartHour==InpEndHour) return true;
   if(InpStartHour<InpEndHour) return(t.hour>=InpStartHour && t.hour<InpEndHour);
   return(t.hour>=InpStartHour || t.hour<InpEndHour);
}
// Conservative BBMA: Re-entry wick reaches both MA5/10 Low (BUY)
// or High (SELL) and candle close stays beyond both; MidBB confirms direction.
bool TF1Reentry(int &dir,datetime &when)
{
   dir=0;when=0;
   for(int s=1;s<=InpReentryAge;s++)
   {
      MqlRates b;
      double mid,upper,lower,l5,l10,h5,h10;
      if(!ReadBar(gTF1,s,b) || !Value(gBB1,0,s,mid) ||
         !Value(gBB1,1,s,upper) || !Value(gBB1,2,s,lower) ||
         !Value(gM5Low,0,s,l5) || !Value(gM10Low,0,s,l10) ||
         !Value(gM5High,0,s,h5) || !Value(gM10High,0,s,h10)) continue;
      bool buy=(b.low<=MathMax(l5,l10) && b.close>l5 && b.close>l10 &&
                l5>mid && l10>mid && b.close>b.open);
      bool sell=(b.high>=MathMin(h5,h10) && b.close<h5 && b.close<h10 &&
                 h5<mid && h10<mid && b.close<b.open);
      if(buy==sell) continue;
      dir=(buy?1:-1);when=ClosedAt(gTF1,b);return true;
   }
   return false;
}
// A directional CSAK (cross MA5/10 and MidBB) or Momentum outside BB.
// Both must come from a CLOSED TF2 candle at/after the TF1 signal.
bool TF2Confirm(int dir,datetime minTime,datetime &when)
{
   when=0;
   for(int s=1;s<=InpEventAge;s++)
   {
      MqlRates b,p;
      double mid,up,dn,m5,m10;
      if(!ReadBar(gTF2,s,b) || !ReadBar(gTF2,s+1,p) ||
         !Value(gBB2,0,s,mid) || !Value(gBB2,1,s,up) ||
         !Value(gBB2,2,s,dn) || BodyRatio(b)<0.50) continue;
      datetime ct=ClosedAt(gTF2,b);
      if(ct<minTime) continue;
      if(dir==1)
      {
         if(!Value(gT2M5High,0,s,m5) || !Value(gT2M10High,0,s,m10)) continue;
         double edge=MathMax(mid,MathMax(m5,m10));
         bool csak=(b.close>edge && (b.open<=edge || p.close<=edge));
         bool momentum=(b.close>up && b.open<=up);
         if(b.close>b.open && (csak || momentum)){when=ct;return true;}
      }
      else
      {
         if(!Value(gT2M5Low,0,s,m5) || !Value(gT2M10Low,0,s,m10)) continue;
         double edge=MathMin(mid,MathMin(m5,m10));
         bool csak=(b.close<edge && (b.open>=edge || p.close>=edge));
         bool momentum=(b.close<dn && b.open>=dn);
         if(b.close<b.open && (csak || momentum)){when=ct;return true;}
      }
   }
   return false;
}
// Confirmed TF3 pivot: only candles older than the current last-closed candle.
// A pivot at shift s compares BOTH historical neighbors s-1 and s+1.
bool Pivot(int s,int dir,double &price)
{
   MqlRates a,b,c;
   if(!ReadBar(gTF3,s-1,a)||!ReadBar(gTF3,s,b)||!ReadBar(gTF3,s+1,c))return false;
   if(dir>0)
   {
      if(b.high<=a.high || b.high<c.high)return false;
      price=b.high;return true;
   }
   if(b.low>=a.low || b.low>c.low)return false;
   price=b.low;return true;
}
// Strictly causal FMCBR interpretation: IB means Initial Break, NOT Inside Bar.
// Frozen base zone is the extreme wick-to-body of a prior TF3 base candle.
bool DetectInitialBreak(int dir,datetime bias,datetime tf2)
{
   MqlRates b,p;
   if(!ReadBar(gTF3,1,b)||!ReadBar(gTF3,2,p))return false;
   datetime at=ClosedAt(gTF3,b);
   if(at<tf2 || at<bias || BodyRatio(b)<InpIBMinBodyRatio)return false;
   if(dir>0 ? !(b.close>b.open && b.close>p.high)
            : !(b.close<b.open && b.close<p.low))return false;
   int baseIndex=-1;
   double extreme=(dir>0?DBL_MAX:-DBL_MAX);
   for(int s=2;s<=InpIBSearch+1;s++)
   {
      MqlRates c;
      if(!ReadBar(gTF3,s,c))return false;
      if(dir>0 && c.low<extreme){extreme=c.low;baseIndex=s;}
      if(dir<0 && c.high>extreme){extreme=c.high;baseIndex=s;}
   }
   if(baseIndex<2)return false;
   MqlRates base;
   if(!ReadBar(gTF3,baseIndex,base))return false;
   double lo=(dir>0?base.low:MathMin(base.open,base.close));
   double hi=(dir>0?MathMax(base.open,base.close):base.high);
   if(!(lo<hi) || (dir>0?b.close<=hi:b.close>=lo))return false;

   // First counter-trend swing is CB1; next older, farther swing is CB2.
   double cb1=0,cb2=0,v;
   bool got1=false,got2=false;
   for(int s=3;s<=InpCBLookback+2;s++)
   {
      if(!Pivot(s,dir,v))continue;
      if(!got1){cb1=v;got1=true;continue;}
      if(dir>0?v>cb1:v<cb1){cb2=v;got2=true;break;}
   }
   if(!got1 || (dir>0?cb1<=b.close:cb1>=b.close))return false;
   if(InpEntryMode!=ENTRY_EL2 && !got2)return false;
   ResetSetup();
   gS.active=true;gS.dir=dir;gS.phase=1;gS.ibTime=b.time;
   gS.biasTime=bias;gS.confirmTime=tf2;
   gS.zoneLo=lo;gS.zoneHi=hi;gS.cb1=cb1;gS.cb2=cb2;
   gS.hasCB2=got2;gS.fibBase=(dir>0?lo:hi);
   PrintFormat("IB ARMED %s dir=%d CB1=%f CB2=%f zone=[%f,%f]",
               ModeName(),dir,cb1,cb2,lo,hi);
   return true;
}
bool ClosedBreak(const MqlRates &b,double level,int dir)
{
   double guard=2.0*PointSize();
   return (BodyRatio(b)>=0.40 &&
           (dir>0?(b.close>level+guard && b.close>b.open)
                 :(b.close<level-guard && b.close<b.open)));
}
bool Retest(const MqlRates &b)
{
   // Entire retest candle must close on the valid side of the zone.
   bool touch=(b.low<=gS.zoneHi && b.high>=gS.zoneLo);
   if(!touch)return false;
   return(gS.dir>0?(b.close>gS.zoneHi && b.close>b.open)
                  :(b.close<gS.zoneLo && b.close<b.open));
}
bool EventExpired()
{
   int age=iBarShift(_Symbol,gTF3,gS.ibTime,true);
   return(age<0 || age>InpSetupExpiry);
}
double ElitePrice(double ratio)
{
   return gS.fibBase+(gS.fibAnchor-gS.fibBase)*ratio;
}
double TickRound(double price,bool roundUp)
{
   double tick=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(tick<=0)return 0;
   double n=price/tick;
   return NormalizeDouble((roundUp?MathCeil(n-1e-9):MathFloor(n+1e-9))*tick,_Digits);
}
bool TradeEnabled()
{
   return (gPilot && SessionOK() &&
           MQLInfoInteger(MQL_TRADE_ALLOWED) &&
           TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) &&
           AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) &&
           AccountInfoInteger(ACCOUNT_TRADE_EXPERT));
}
bool ValidVolume()
{
   double minv=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxv=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(step<=0 || InpFixedLot<minv || InpFixedLot>maxv)return false;
   return(MathAbs(InpFixedLot/step-MathRound(InpFixedLot/step))<1e-7);
}
// Risk preflight BEFORE atomic event claim, with exact Bid/Ask and broker stops.
void ExecuteSetup()
{
   if(!TradeEnabled() || !ValidVolume())return;
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick)||tick.bid<=0 || tick.ask<=tick.bid)return;
   double spread=tick.ask-tick.bid;
   if(spread/PointSize()>InpMaxSpreadPoints){Print("SKIP_SPREAD");return;}
   double atr;
   if(!Value(gATR,0,1,atr))return;
   double entry=(gS.dir>0?tick.ask:tick.bid);
   double rawSL=(gS.dir>0?gS.zoneLo-InpATRBuffer*atr:gS.zoneHi+InpATRBuffer*atr);
   double sl=TickRound(rawSL,gS.dir<0);
   double risk=(gS.dir>0?entry-sl:sl-entry);
   if(sl<=0 || risk<=0 || spread>InpMaxSpreadRiskFraction*risk)
   {Print("SKIP_SL_OR_SPREAD_RISK");return;}
   double tp=TickRound(entry+gS.dir*InpRiskReward*risk,gS.dir>0);
   double stops=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*PointSize();
   double freeze=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)*PointSize();
   double required=MathMax(stops,freeze)+PointSize();
   if(gS.dir>0?(tick.bid-sl<required || tp-tick.bid<required)
              :(sl-tick.ask<required || tick.ask-tp<required))
   {Print("SKIP_BROKER_STOPS");return;}
   double margin=0;
   ENUM_ORDER_TYPE orderType=(gS.dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL);
   if(!OrderCalcMargin(orderType,_Symbol,InpFixedLot,entry,margin) ||
      margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))
   {Print("SKIP_MARGIN");return;}
   if(!gTrade.SetTypeFillingBySymbol(_Symbol))
   {Print("SKIP_FILLING_MODE");return;}
   // Global-variable CAS keeps duplicate charts/instances from placing same IB.
   if(MQLInfoInteger(MQL_TESTER))GlobalVariableSet(gClaimKey,0);
   else if(!GlobalVariableCheck(gClaimKey))GlobalVariableSet(gClaimKey,0);
   double previous=GlobalVariableGet(gClaimKey);
   if(previous>=(double)gS.ibTime)return;
   if(!GlobalVariableSetOnCondition(gClaimKey,(double)gS.ibTime,previous))return;
   GlobalVariablesFlush();

   gOrderSL=sl;gOrderTP=tp;gOrderIB=gS.ibTime;
   gOrderFibo1=ElitePrice(gEliteLevels[9]);
   gOrderFibo2=ElitePrice(gEliteLevels[12]);
   gOrderCycle=ElitePrice(gEliteLevels[15]);
   string label=StringFormat("FM%s:%I64d",ModeName(),(long)gS.ibTime);
   bool sent=(gS.dir>0?gTrade.Buy(InpFixedLot,_Symbol,entry,sl,tp,label)
                        :gTrade.Sell(InpFixedLot,_Symbol,entry,sl,tp,label));
   uint rc=gTrade.ResultRetcode();
   if(!sent || (rc!=TRADE_RETCODE_DONE && rc!=TRADE_RETCODE_DONE_PARTIAL &&
                 rc!=TRADE_RETCODE_PLACED))
   {
      // Unknown trade status must not be retried blindly.
      Print("ORDER_FAILED_OR_UNCERTAIN ",rc," ",gTrade.ResultRetcodeDescription());
      return;
   }
   PrintFormat("ORDER %s %s | SL=%f TP=%f | FiboElite TP1=%f TP2=%f Cycle=%f",
                ModeName(),gS.dir>0?"BUY":"SELL",sl,tp,
                gOrderFibo1,gOrderFibo2,gOrderCycle);
}
void Advance(const MqlRates &bar)
{
   if(!gS.active)return;
   if(EventExpired()){ResetSetup();return;}
   int d;datetime bias,tf2;
   if(!TF1Reentry(d,bias)||d!=gS.dir||!TF2Confirm(d,bias,tf2))
   {ResetSetup();return;}
   // A close through the far side of the base cancels the setup.
   if(gS.dir>0?bar.close<gS.zoneLo:bar.close>gS.zoneHi)
   {ResetSetup();return;}
   if(gS.phase==1 && ClosedBreak(bar,gS.cb1,gS.dir))
   {
      // Fibo Elite anchors lock on the CB1 breakout candle's BODY close.
      gS.fibAnchor=bar.close;
      gS.phase=(InpEntryMode==ENTRY_EL2?3:
                (InpEntryMode==ENTRY_EL3_A?2:4));
      // EL3A accepts one closed candle clearing BOTH structural levels.
      if(InpEntryMode==ENTRY_EL3_A && gS.hasCB2 && ClosedBreak(bar,gS.cb2,gS.dir))
         gS.phase=3;
      return;  // Never count breakout candle itself as a retest.
   }
   if(gS.phase==2 && gS.hasCB2 && ClosedBreak(bar,gS.cb2,gS.dir))
   {gS.phase=3;return;}
   if(gS.phase==4 && Retest(bar))
   {gS.phase=2;return;}
   if(gS.phase==3 && Retest(bar))
   {
      ExecuteSetup();
      ResetSetup(); // A single retest is consumed even if trading is blocked.
   }
}
string UrlEncode(string src)
{
   uchar bytes[];
   int n=StringToCharArray(src,bytes,0,WHOLE_ARRAY,CP_UTF8);
   string out="";
   for(int i=0;i<n-1;i++)
   {
      int b=(int)bytes[i];
      if((b>=65 && b<=90)||(b>=97 && b<=122)||(b>=48 && b<=57)||
         b==45||b==95||b==46||b==126)out+=CharToString((uchar)b);
      else out+=StringFormat("%%%02X",b);
   }
   return out;
}
void Notify(string message)
{
   Print(message);
   if(InpPushEnabled)SendNotification(message);
   if(!InpTelegramEnabled || InpTelegramToken=="" || InpTelegramChatID=="")return;
   if(MQLInfoInteger(MQL_TESTER))return;
   string body="chat_id="+UrlEncode(InpTelegramChatID)+"&text="+UrlEncode(message);
   char data[],response[];
   string headers;
   int n=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   if(n>0)ArrayResize(data,n-1);
   ResetLastError();
   int status=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+
                         "/sendMessage","Content-Type: application/x-www-form-urlencoded\r\n",
                         5000,data,response,headers);
   if(status!=200)Print("TELEGRAM_SEND_FAILED http=",status," error=",GetLastError());
}
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || !HistoryDealSelect(trans.deal))return;
   if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=_Symbol ||
      (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic)return;
   ENUM_DEAL_ENTRY side=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
   if(side!=DEAL_ENTRY_IN && side!=DEAL_ENTRY_OUT)return;
   // Manual/other partial OUT is not a TP/SL notification and cannot
   // consume the single exit alert reserved for the later TP/SL deal.
   ENUM_DEAL_REASON closeReason=(ENUM_DEAL_REASON)HistoryDealGetInteger(trans.deal,DEAL_REASON);
   if(side==DEAL_ENTRY_OUT &&
      closeReason!=DEAL_REASON_TP && closeReason!=DEAL_REASON_SL)return;
   long id=HistoryDealGetInteger(trans.deal,DEAL_POSITION_ID);
   string uniq=StringFormat("FME.%I64d.%I64u.%I64d.%d",
             AccountInfoInteger(ACCOUNT_LOGIN),InpMagic,id,(int)side);
   if(StringLen(uniq)>63)return;
   if(GlobalVariableCheck(uniq))return;
   if(GlobalVariableSet(uniq,(double)TimeCurrent())==0)return;
   GlobalVariablesFlush();
   if(side==DEAL_ENTRY_IN)
   {
      double price=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
      double sl=gOrderSL,tp=gOrderTP;
      // Find exact executed position identifier (not PositionSelect by symbol).
      for(int i=PositionsTotal()-1;i>=0;i--)
      {
         if(PositionGetTicket(i)==0)continue;
         if(PositionGetInteger(POSITION_IDENTIFIER)==id)
         {
            double actualSL=PositionGetDouble(POSITION_SL);
            double actualTP=PositionGetDouble(POSITION_TP);
            if(actualSL>0)sl=actualSL;
            if(actualTP>0)tp=actualTP;
            break;
         }
      }
      int d=(HistoryDealGetInteger(trans.deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1);
      string msg=StringFormat("SEKTE MUSANG CEBONK COMPANY 22\n%s %s | %s\nTF %s > %s > %s\nEntry: %s | SL: %s | TP: %s\nElite 1.618: %s | 2.618: %s | Cycle 4.23: %s",
                   d>0?"BUY":"SELL",_Symbol,ModeName(),
                   TFName(gTF1),TFName(gTF2),TFName(gTF3),
                   DoubleToString(price,_Digits),DoubleToString(sl,_Digits),
                   DoubleToString(tp,_Digits),DoubleToString(gOrderFibo1,_Digits),
                   DoubleToString(gOrderFibo2,_Digits),DoubleToString(gOrderCycle,_Digits));
      Notify(msg);
   }
   else if(side==DEAL_ENTRY_OUT)
   {
      if(closeReason==DEAL_REASON_TP)Notify("TAKE PROFIT 😅");
      if(closeReason==DEAL_REASON_SL)Notify("STOP LOSS 🥲");
   }
}
int OnInit()
{
   SelectPackage();
   if(PeriodSeconds(gTF1)<=PeriodSeconds(gTF2) ||
      PeriodSeconds(gTF2)<=PeriodSeconds(gTF3) ||
      InpReentryAge<1||InpEventAge<1||InpIBSearch<3||InpCBLookback<5||
      InpIBMinBodyRatio<=0||InpIBMinBodyRatio>1||
      InpSetupExpiry<3||InpATRPeriod<2||InpATRBuffer<0||
      InpRiskReward<=0||InpMaxSpreadPoints<0||InpSlippagePoints<0||
      InpMaxSpreadRiskFraction<=0||InpMaxSpreadRiskFraction>1||
      InpStartHour<0||InpStartHour>23||InpEndHour<0||InpEndHour>24||
      InpFixedLot<=0)return INIT_PARAMETERS_INCORRECT;
   gBB1=iBands(_Symbol,gTF1,20,0,2.0,PRICE_CLOSE);
   gBB2=iBands(_Symbol,gTF2,20,0,2.0,PRICE_CLOSE);
   gM5Low=iMA(_Symbol,gTF1,5,0,MODE_LWMA,PRICE_LOW);
   gM10Low=iMA(_Symbol,gTF1,10,0,MODE_LWMA,PRICE_LOW);
   gM5High=iMA(_Symbol,gTF1,5,0,MODE_LWMA,PRICE_HIGH);
   gM10High=iMA(_Symbol,gTF1,10,0,MODE_LWMA,PRICE_HIGH);
   gT2M5High=iMA(_Symbol,gTF2,5,0,MODE_LWMA,PRICE_HIGH);
   gT2M10High=iMA(_Symbol,gTF2,10,0,MODE_LWMA,PRICE_HIGH);
   gT2M5Low=iMA(_Symbol,gTF2,5,0,MODE_LWMA,PRICE_LOW);
   gT2M10Low=iMA(_Symbol,gTF2,10,0,MODE_LWMA,PRICE_LOW);
   gATR=iATR(_Symbol,gTF3,InpATRPeriod);
   if(gBB1==INVALID_HANDLE||gBB2==INVALID_HANDLE||gATR==INVALID_HANDLE||
      gM5Low==INVALID_HANDLE||gM10Low==INVALID_HANDLE||
      gM5High==INVALID_HANDLE||gM10High==INVALID_HANDLE||
      gT2M5High==INVALID_HANDLE||gT2M10High==INVALID_HANDLE||
      gT2M5Low==INVALID_HANDLE||gT2M10Low==INVALID_HANDLE)
   {Print("INIT ERROR: indicator handle");return INIT_FAILED;}
   if(!ValidVolume()){Print("INIT ERROR: invalid broker volume");return INIT_PARAMETERS_INCORRECT;}
   gClaimKey=StringFormat("FM.%I64d.%s.%I64u.%d.%d",
                AccountInfoInteger(ACCOUNT_LOGIN),_Symbol,InpMagic,
                (int)gTF3,(int)InpEntryMode);
   if(StringLen(gClaimKey)>63)return INIT_PARAMETERS_INCORRECT;
   if(!GlobalVariableCheck(gClaimKey))GlobalVariableSet(gClaimKey,0);
   gTrade.SetExpertMagicNumber(InpMagic);
   gTrade.SetDeviationInPoints(InpSlippagePoints);
   gTrade.SetAsyncMode(false);
   ResetSetup();gPilot=InpStartAutoPilot;
   gProcessed=iTime(_Symbol,gTF3,1); // restart does not retro-trade historical retests
   PaintButton();
   Print("CEBONK FMCBR ELITE READY ",ModeName()," ",TFName(gTF1)," ",
         TFName(gTF2)," ",TFName(gTF3)," (experimental; backtest before live)");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason)
{
   int handles[11]={gBB1,gBB2,gATR,gM5Low,gM10Low,gM5High,gM10High,
                     gT2M5High,gT2M10High,gT2M5Low,gT2M10Low};
   for(int i=0;i<11;i++)if(handles[i]!=INVALID_HANDLE)IndicatorRelease(handles[i]);
   ObjectDelete(0,gButton);
}
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id==CHARTEVENT_OBJECT_CLICK && sparam==gButton)
   {gPilot=!gPilot;PaintButton();}
}
void OnTick()
{
   datetime t=iTime(_Symbol,gTF3,1);
   if(t<=0 || t==gProcessed)return;
   MqlRates bar;
   if(!ReadBar(gTF3,1,bar))return; // retry loading, no speculative candle
   gProcessed=t;
   if(gS.active){Advance(bar);return;}
   int dir;datetime bias,conf;
   if(!TF1Reentry(dir,bias) || !TF2Confirm(dir,bias,conf))return;
   DetectInitialBreak(dir,bias,conf);
}
