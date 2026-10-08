// CEBONK COMPANY 22 — SINCE 2016
#property strict
#property version "1.00"
#include <Trade/Trade.mqh>
input ENUM_TIMEFRAMES TF1=PERIOD_M15;
input ENUM_TIMEFRAMES TF2=PERIOD_M5;
input double FixedLot=0.01;
input int MaxSpreadPoints=70;
input int DeviationPoints=20;
input int SLBufferPoints=0;
input ulong Magic=220208;
input bool StartAutopilot=true;
input int StartHour=7; // Broker clock; 7..24 = 07:00 until midnight
input int EndHour=24;
const double RR=2.0;
struct Frame {
 int bb,h5,h10,l5,l10;
};
struct Snapshot {
 MqlRates bar;
 double mid,top,low,h5,h10,l5,l10;
};
Frame frames[2];
CTrade trade;
bool autopilot;
datetime evaluated=0;
bool armed=false;
string key,button="CEBONK_2TF_AUTOPILOT";

bool ReadValue(int handle,int buffer,int shift,double &value) {
 double a[1];
 if(CopyBuffer(handle,buffer,shift,1,a)!=1) return false;
 value=a[0];
 return MathIsValidNumber(value) && value!=EMPTY_VALUE;
}
bool ReadFrame(int index,Snapshot &s) {
 ENUM_TIMEFRAMES tf=(index==0 ? TF1 : TF2);
 MqlRates a[1];
 if(CopyRates(_Symbol,tf,1,1,a)!=1) return false;
 s.bar=a[0];
 return ReadValue(frames[index].bb,0,1,s.mid)
 && ReadValue(frames[index].bb,1,1,s.top)
 && ReadValue(frames[index].bb,2,1,s.low)
 && ReadValue(frames[index].h5,0,1,s.h5)
 && ReadValue(frames[index].h10,0,1,s.h10)
 && ReadValue(frames[index].l5,0,1,s.l5)
 && ReadValue(frames[index].l10,0,1,s.l10);
}
// Direction requires a candle body agreeing with the close.
// CSA: close beyond BOTH MA5/10, still on the near side of MidBB.
// CSAK: close beyond BOTH MA5/10 AND MidBB, inside the outer band.
// CSM: close outside the outer band. TF2 accepts CSAK only.
int Signal(Snapshot &s,bool onlyCSAK,string &name) {
 double c=s.bar.close,o=s.bar.open;
 name="";
 if(c>o) {
  if(!onlyCSAK && c>s.top) { name="CSM"; return 1; }
  if(c>MathMax(s.h5,s.h10) && c>s.mid && c<=s.top) {
   name="CSAK"; return 1;
  }
  if(!onlyCSAK && c>MathMax(s.h5,s.h10) && c<=s.mid) {
   name="CSA"; return 1;
  }
 }
 if(c<o) {
  if(!onlyCSAK && c<s.low) { name="CSM"; return -1; }
  if(c<MathMin(s.l5,s.l10) && c<s.mid && c>=s.low) {
   name="CSAK"; return -1;
  }
  if(!onlyCSAK && c<MathMin(s.l5,s.l10) && c>=s.mid) {
   name="CSA"; return -1;
  }
 }
 return 0;
}
double RoundPrice(double p,bool up) {
 double step=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(step<=0) return 0;
 return NormalizeDouble((up ? MathCeil(p/step) : MathFloor(p/step))*step,_Digits);
}
bool SessionOpen() {
 MqlDateTime dt;
 TimeToStruct(TimeCurrent(),dt);
 if(StartHour==EndHour) return true;
 if(StartHour<EndHour) return dt.hour>=StartHour && dt.hour<EndHour;
 return dt.hour>=StartHour || dt.hour<EndHour;
}
void PaintButton() {
 if(ObjectFind(0,button)<0) {
  ObjectCreate(0,button,OBJ_BUTTON,0,0,0);
  ObjectSetInteger(0,button,OBJPROP_XDISTANCE,12);
  ObjectSetInteger(0,button,OBJPROP_YDISTANCE,20);
  ObjectSetInteger(0,button,OBJPROP_XSIZE,165);
  ObjectSetInteger(0,button,OBJPROP_YSIZE,28);
 }
 ObjectSetString(0,button,OBJPROP_TEXT,autopilot ? "AUTOPILOT ON" : "AUTOPILOT OFF");
 ObjectSetInteger(0,button,OBJPROP_BGCOLOR,autopilot ? clrDarkGreen : clrMaroon);
 ObjectSetInteger(0,button,OBJPROP_COLOR,clrWhite);
 ObjectSetInteger(0,button,OBJPROP_STATE,false);
 ChartRedraw();
}
bool HasExecuted(datetime signalTime) {
 // History survives restart even if terminal globals were cleared.
 if(!HistorySelect(signalTime,TimeCurrent())) return true;
 string tag="B2:"+IntegerToString((long)signalTime);
 for(int i=HistoryDealsTotal()-1;i>=0;i--) {
  ulong ticket=HistoryDealGetTicket(i);
  if(HistoryDealGetString(ticket,DEAL_SYMBOL)==_Symbol
    && (ulong)HistoryDealGetInteger(ticket,DEAL_MAGIC)==Magic
    && HistoryDealGetString(ticket,DEAL_COMMENT)==tag) return true;
 }
 return false;
}
void Execute(int dir,Snapshot &s,string name) {
 MqlTick tick;
 if(!SymbolInfoTick(_Symbol,tick) || tick.ask<=tick.bid) return;
 if((tick.ask-tick.bid)/_Point>MaxSpreadPoints) { Print("SKIP_SPREAD"); return; }
 double entry=(dir>0 ? tick.ask : tick.bid);
 double sl=RoundPrice(dir>0 ? s.low-SLBufferPoints*_Point : s.top+SLBufferPoints*_Point,dir<0);
 double risk=dir*(entry-sl);
 if(sl<=0 || risk<=0) { Print("SKIP_INVALID_SL"); return; }
 double tp=RoundPrice(entry+dir*RR*risk,dir>0);
 double minimum=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
 // Stop-distance validity is measured from Bid for buys / Ask for sells.
 if(dir>0 ? (tick.bid-sl<minimum || tp-tick.bid<minimum)
          : (sl-tick.ask<minimum || tick.ask-tp<minimum)) {
  Print("SKIP_BROKER_STOPS"); return;
 }
 double margin=0;
 if(!OrderCalcMargin(dir>0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL,_Symbol,FixedLot,entry,margin)
   || margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)) { Print("SKIP_MARGIN"); return; }
 if(!trade.SetTypeFillingBySymbol(_Symbol)) return;
 string tag="B2:"+IntegerToString((long)s.bar.time);
 bool sent=(dir>0 ? trade.Buy(FixedLot,_Symbol,entry,sl,tp,tag)
                  : trade.Sell(FixedLot,_Symbol,entry,sl,tp,tag));
 uint ret=trade.ResultRetcode();
 if(!sent || (ret!=TRADE_RETCODE_DONE && ret!=TRADE_RETCODE_DONE_PARTIAL && ret!=TRADE_RETCODE_PLACED)) {
  Print("ORDER_FAILED ",ret," ",trade.ResultRetcodeDescription()); return;
 }
 // Keep the claim for accepted/placed orders; never resend uncertain execution.
 Print("ORDER_ACCEPTED ",name," TF2 CSAK ",dir>0 ? "BUY" : "SELL",
       " SL=",sl," TP=",tp," RR planned=1:2; fill/slippage can change realised RR");
}
void ReleaseAll() {
 for(int i=0;i<2;i++) {
  if(frames[i].bb!=INVALID_HANDLE) IndicatorRelease(frames[i].bb);
  if(frames[i].h5!=INVALID_HANDLE) IndicatorRelease(frames[i].h5);
  if(frames[i].h10!=INVALID_HANDLE) IndicatorRelease(frames[i].h10);
  if(frames[i].l5!=INVALID_HANDLE) IndicatorRelease(frames[i].l5);
  if(frames[i].l10!=INVALID_HANDLE) IndicatorRelease(frames[i].l10);
 }
}
int OnInit() {
 for(int i=0;i<2;i++) {
  frames[i].bb=INVALID_HANDLE; frames[i].h5=INVALID_HANDLE;
  frames[i].h10=INVALID_HANDLE; frames[i].l5=INVALID_HANDLE; frames[i].l10=INVALID_HANDLE;
 }
 double vmin=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
 double vmax=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
 double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 if(TF1==PERIOD_CURRENT || TF2==PERIOD_CURRENT || PeriodSeconds(TF1)<=PeriodSeconds(TF2)
  || !MathIsValidNumber(FixedLot) || FixedLot<vmin || FixedLot>vmax || step<=0
  || MathAbs(FixedLot/step-MathRound(FixedLot/step))>1e-7
  || MaxSpreadPoints<0 || SLBufferPoints<0 || DeviationPoints<0
  || StartHour<0 || StartHour>23 || EndHour<0 || EndHour>24) return INIT_PARAMETERS_INCORRECT;
 // Independent fixed SL/TP per entry requires a hedging account.
 if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) {
  Print("Use a hedging account: netting merges entries and SL/TP."); return INIT_FAILED;
 }
 for(int i=0;i<2;i++) {
  ENUM_TIMEFRAMES tf=(i==0 ? TF1 : TF2);
  frames[i].bb=iBands(_Symbol,tf,20,0,2.0,PRICE_CLOSE);
  frames[i].h5=iMA(_Symbol,tf,5,0,MODE_LWMA,PRICE_HIGH);
  frames[i].h10=iMA(_Symbol,tf,10,0,MODE_LWMA,PRICE_HIGH);
  frames[i].l5=iMA(_Symbol,tf,5,0,MODE_LWMA,PRICE_LOW);
  frames[i].l10=iMA(_Symbol,tf,10,0,MODE_LWMA,PRICE_LOW);
  if(frames[i].bb==INVALID_HANDLE || frames[i].h5==INVALID_HANDLE || frames[i].h10==INVALID_HANDLE
    || frames[i].l5==INVALID_HANDLE || frames[i].l10==INVALID_HANDLE) return INIT_FAILED;
 }
 key=StringFormat("B2.%I64d.%s.%I64u.%d.%d",
   AccountInfoInteger(ACCOUNT_LOGIN),_Symbol,Magic,(int)TF1,(int)TF2);
 if(StringLen(key)>63) return INIT_FAILED;
 if(!GlobalVariableCheck(key)) GlobalVariableSet(key,0);
 trade.SetExpertMagicNumber(Magic);
 trade.SetDeviationInPoints(DeviationPoints);
 trade.SetAsyncMode(false);
 autopilot=StartAutopilot;
 // Attach/restart waits for a NEW TF2 close; no retroactive market entry.
 evaluated=iTime(_Symbol,TF2,1);
 armed=(evaluated>0);
 PaintButton();
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { ReleaseAll(); ObjectDelete(0,button); }
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam) {
 if(id==CHARTEVENT_OBJECT_CLICK && sparam==button) { autopilot=!autopilot; PaintButton(); }
}
void OnTick() {
 datetime bar=iTime(_Symbol,TF2,1);
 if(bar<=0) return;
 if(!armed) { evaluated=bar; armed=true; return; }
 if(bar==evaluated) return;
 Snapshot a,b;
 if(!ReadFrame(0,a) || !ReadFrame(1,b)) return; // Retry only data loading.
 if(b.bar.time!=bar) return;
 evaluated=bar;
 if(!autopilot || !SessionOpen()) return;
 if(!MQLInfoInteger(MQL_TRADE_ALLOWED) || !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)
   || !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT)) return;
 string name,confirmation;
 int d1=Signal(a,false,name),d2=Signal(b,true,confirmation);
 if(d1==0 || d1!=d2) return;
 // Terminal atomic claim blocks duplicate instances sharing symbol/magic/pair.
 double previous=GlobalVariableGet(key);
 if(previous>=(double)bar || HasExecuted(bar)) return;
 if(!GlobalVariableSetOnCondition(key,(double)bar,previous)) return;
 GlobalVariablesFlush();
 Execute(d1,b,name);
}
