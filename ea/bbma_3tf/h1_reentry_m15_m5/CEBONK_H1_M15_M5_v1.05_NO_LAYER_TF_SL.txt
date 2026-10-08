// CEBONK COMPANY 22 — SINCE 2016
// EA v1.05 NO-LAYER TF-SL selector | H1 BBMA -> M15 CSA/CSAK/CSM -> M5 CSAK
// Hedging only. Research/demo release: compile and forward test before live use.
#property strict
#property version "1.05"
#include <Trade/Trade.mqh>

input bool H1FilterEnabled=true;
input ENUM_TIMEFRAMES TF_Filter=PERIOD_H1;
input ENUM_TIMEFRAMES TF_Signal=PERIOD_M15;
input ENUM_TIMEFRAMES TF_Entry=PERIOD_M5;
input int H1ReentryMaxAgeBars=3;
input int M15SignalMaxAgeBars=4;
input int MaxEntryDelaySeconds=30;
input int BBPeriod=20;
input double BBDeviation=2.0;
input ENUM_TIMEFRAMES TF_StopLoss=PERIOD_M15; // BB SL timeframe selector, default M15
input int SLBufferPoints=0;
input double FixedLot=0.01;
input int MaxSpreadPoints=70;
input int DeviationPoints=20;
input ulong Magic=220208;
input int StartHour=7;
input int EndHour=24;
input bool StartAutopilot=true;
input bool EnableRiskGuard=true;
input double MaxRiskPerTradePercent=0.50;
input double MaxCombinedRiskPercent=2.00;
input int MaxConcurrentPositions=1; // Hard NO-LAYER: any value other than 1 rejects initialization
input bool PauseEntriesOnDailyDD=true;
input double DailyDDLimitPercent=5.0;
// Research filters default OFF until ablation study is run.
input bool EnableSidewaysFilter=false;
input double MinBBWidthATR=1.8;
input bool EnableSellQualityFilter=false;
input double MinSellBodyRatio=0.55;
input bool EnableTelegram=false;
input string TelegramBotToken="";
input string TelegramChatId="";
input bool EnableMT5Push=false;
input bool NotifyAutopilotChange=true;
input bool NotifyOnFilledEntry=true;

const double RR=2.0;                         // Fixed RR, deliberately not an input
const string BRAND="SEKTE MUSANG TEORY CEBONK COMPANY 22";
#define FRAME_COUNT 3
#define QUEUE_LIMIT 32
struct Frame { int bb,h5,h10,l5,l10; };
struct Snapshot { MqlRates bar; double mid,top,low,h5,h10,l5,l10; };
Frame frames[FRAME_COUNT];
CTrade trade;
string rootKey,claimKey,lockKey,pilotKey,button="CEBONK_AUTOPILOT";
bool autopilot=false,stateFault=false,armed=false;
double ownedLockLease=0;
datetime evaluated=0;
int atrM15=INVALID_HANDLE;
int slBands=INVALID_HANDLE;
string queueText[QUEUE_LIMIT];
bool queueTelegram[QUEUE_LIMIT],queuePush[QUEUE_LIMIT];
int queueHead=0,queueCount=0;

bool Good(double x) { return MathIsValidNumber(x) && x!=EMPTY_VALUE && x>0; }
void Skip(string why) { Print("WHY_SKIP=",why); }
string TicketTag(datetime t) { return StringFormat("C3:%I64d",(long)t); }
string BarTime(datetime t) { return TimeToString(t,TIME_DATE|TIME_MINUTES); }
string StopTFName() { return StringSubstr(EnumToString(TF_StopLoss),7); }
// SetupID = H1 Re-entry bar + M15 confirmation bar + trading direction.
// The M5 trigger bar NEVER becomes a new SetupID.
// H1 filter OFF => h1Time is zero and only the M15 event identifies the setup.
string SetupPrefix(datetime h1Time,datetime m15Time,int dir) {
 return StringFormat("C3:%I64d:%I64d:%s",(long)h1Time,(long)m15Time,dir>0?"B":"S");
}
string SetupStateKey(datetime h1Time,datetime m15Time,int dir) {
 return StringFormat("%s.S%I64d.%I64d.%s",rootKey,(long)h1Time,(long)m15Time,dir>0?"B":"S");
}
string SignalCode(string name) { return name=="CSM"?"M":(name=="CSAK"?"K":"A"); }
bool CommentIsSetup(string comment,string prefix) {
 int n=StringLen(prefix);
 return StringFind(comment,prefix)==0 && (StringLen(comment)==n || StringSubstr(comment,n,1)==":");
}


bool BuildKeys() {
 string server=AccountInfoString(ACCOUNT_SERVER);
 string identity=StringFormat("%s|%I64d|%s|%I64u",server,AccountInfoInteger(ACCOUNT_LOGIN),_Symbol,Magic);
 uchar data[],salt[],digest[];
 int n=StringToCharArray(identity,data,0,WHOLE_ARRAY,CP_UTF8);
 if(n<2 || ArrayResize(data,n-1)!=n-1 || CryptEncode(CRYPT_HASH_SHA256,data,salt,digest)!=32) return false;
 rootKey=(MQLInfoInteger(MQL_TESTER)?"T3.":"C3.");
 for(int k=0;k<16;k++) rootKey+=StringFormat("%02X",digest[k]);
 claimKey=rootKey+".claim"; lockKey=rootKey+".lock"; pilotKey=rootKey+".pilot";
 return true;
}
// Terminal globals are a shared, persistent, fail-closed SSOT across charts.
bool EnsureVariable(string k,double initial) {
 if(GlobalVariableCheck(k)) return true;
 return GlobalVariableSet(k,initial)!=0;
}
bool ReadPilot() {
 double state=0;
 if(!GlobalVariableGet(pilotKey,state) || (state!=0 && state!=1)) return false;
 autopilot=(state==1); return true;
}
void PaintButton() {
 if(ObjectFind(0,button)<0) {
  if(!ObjectCreate(0,button,OBJ_BUTTON,0,0,0)) return;
  ObjectSetInteger(0,button,OBJPROP_XDISTANCE,12);
  ObjectSetInteger(0,button,OBJPROP_YDISTANCE,20);
  ObjectSetInteger(0,button,OBJPROP_XSIZE,165);
  ObjectSetInteger(0,button,OBJPROP_YSIZE,28);
 }
 ObjectSetString(0,button,OBJPROP_TEXT,autopilot?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,button,OBJPROP_BGCOLOR,autopilot?clrDarkGreen:clrMaroon);
 ObjectSetInteger(0,button,OBJPROP_COLOR,clrWhite);
 ObjectSetInteger(0,button,OBJPROP_STATE,false);
 ChartRedraw();
}
void Enqueue(string msg,bool toTelegram,bool toPush) {
 if((!toTelegram && !toPush) || queueCount>=QUEUE_LIMIT) {
  if(queueCount>=QUEUE_LIMIT) Print("NOTIFICATION_QUEUE_FULL; message not sent");
  return;
 }
 int slot=(queueHead+queueCount)%QUEUE_LIMIT;
 queueText[slot]=msg; queueTelegram[slot]=toTelegram; queuePush[slot]=toPush;
 queueCount++;
}
void TogglePilot() {
 double was=0;
 if(!GlobalVariableGet(pilotKey,was) || (was!=0 && was!=1)) { autopilot=false;stateFault=true;Skip("PILOT_STATE");PaintButton();return; }
 double next=(was==1?0:1);
 if(!GlobalVariableSetOnCondition(pilotKey,next,was)) { if(!ReadPilot()) stateFault=true;PaintButton();return; }
 GlobalVariablesFlush();autopilot=(next==1);stateFault=false;PaintButton();
 if(NotifyAutopilotChange) {
  string msg=BRAND+"\nAUTOPILOT "+(autopilot?"ON":"OFF")+" | "+_Symbol+
             " | H1-M15-M5\nBROKER "+BarTime(TimeCurrent());
  Enqueue(msg,EnableTelegram,EnableMT5Push);
 }
}
// No network request is made inside OnTick/OnTradeTransaction.
string FormEncode(string value) {
 uchar bytes[];int n=StringToCharArray(value,bytes,0,WHOLE_ARRAY,CP_UTF8);
 string encoded="";
 for(int i=0;i<n-1;i++) {
  int c=(int)bytes[i];
  if((c>=48 && c<=57)||(c>=65 && c<=90)||(c>=97 && c<=122)||c==45||c==46||c==95||c==126)
   encoded+=CharToString((uchar)c);
  else encoded+=StringFormat("%%%02X",c);
 }
 return encoded;
}
bool TelegramSend(string msg) {
 if(TelegramBotToken=="" || TelegramChatId=="") { Print("TELEGRAM_CONFIG_MISSING");return false; }
 string url="https://api.telegram.org/bot"+TelegramBotToken+"/sendMessage";
 string payload="chat_id="+FormEncode(TelegramChatId)+"&text="+FormEncode(msg);
 char data[],result[];string responseHeaders;
 int count=StringToCharArray(payload,data,0,WHOLE_ARRAY,CP_UTF8);
 if(count<=1 || ArrayResize(data,count-1)!=count-1) return false;
 ResetLastError();
 int http=WebRequest("POST",url,"Content-Type: application/x-www-form-urlencoded\r\n",1200,data,result,responseHeaders);
 if(http!=200) { Print("TELEGRAM_SEND_FAILED HTTP=",http," MQL_ERROR=",GetLastError());return false; }
 // 200 indicates Telegram HTTP acceptance, not user-device delivery.
 return true;
}
void SafetyWatch() {
 // Broker/order race: do not react to a transient missing stop during fill.
 // After a short grace period, fail closed on any persistent naked EA position.
 datetime now=TimeCurrent();
 for(int i=PositionsTotal()-1;i>=0;i--) {
  ulong ticket=PositionGetTicket(i);
  if(ticket==0 || !PositionSelectByTicket(ticket))continue;
  if(PositionGetString(POSITION_SYMBOL)!=_Symbol || (ulong)PositionGetInteger(POSITION_MAGIC)!=Magic)continue;
  if(Good(PositionGetDouble(POSITION_SL)))continue;
  datetime opened=(datetime)PositionGetInteger(POSITION_TIME);
  if(now-opened<3)continue;
  Print("CRITICAL_NAKED_POSITION emergency close ticket=",ticket);
  if(!trade.PositionClose(ticket) || trade.ResultRetcode()!=TRADE_RETCODE_DONE)
   Print("EMERGENCY_CLOSE_FAILED ret=",trade.ResultRetcode());
 }
}
void OnTimer() {
 SafetyWatch();
 if(queueCount==0)return;
 int idx=queueHead;
 string msg=queueText[idx];bool tg=queueTelegram[idx],push=queuePush[idx];
 queueHead=(queueHead+1)%QUEUE_LIMIT;queueCount--;
 // At-most-once attempt: retry after an ambiguous timeout can produce duplicate Telegram messages.
 if(tg && !MQLInfoInteger(MQL_TESTER)) TelegramSend(msg);
 if(push && !MQLInfoInteger(MQL_TESTER)) {
  if(!SendNotification(msg)) Print("MT5_PUSH_FAILED ",GetLastError());
 }
}

bool ReadValue(int h,int buffer,int shift,double &v) {
 double a[1];if(h==INVALID_HANDLE || CopyBuffer(h,buffer,shift,1,a)!=1)return false;
 v=a[0];return MathIsValidNumber(v) && v!=EMPTY_VALUE;
}
// The SL band always belongs to the LAST CLOSED candle of TF_StopLoss.
bool ReadClosedStopBand(int dir,double &band,datetime &closedBar) {
 band=0;closedBar=0;
 if(dir!=1 && dir!=-1)return false;
 MqlRates rates[1];
 if(slBands==INVALID_HANDLE || CopyRates(_Symbol,TF_StopLoss,1,1,rates)!=1)return false;
 closedBar=rates[0].time;
 if(closedBar<=0 || !ReadValue(slBands,dir==1?2:1,1,band))return false;
 return Good(band);
}
bool ReadFrame(int idx,int shift,Snapshot &s) {
 ENUM_TIMEFRAMES tf=(idx==0?TF_Filter:(idx==1?TF_Signal:TF_Entry));
 MqlRates rates[1];if(CopyRates(_Symbol,tf,shift,1,rates)!=1)return false;
 s.bar=rates[0];
 return ReadValue(frames[idx].bb,0,shift,s.mid)
   && ReadValue(frames[idx].bb,1,shift,s.top)
   && ReadValue(frames[idx].bb,2,shift,s.low)
   && ReadValue(frames[idx].h5,0,shift,s.h5)
   && ReadValue(frames[idx].h10,0,shift,s.h10)
   && ReadValue(frames[idx].l5,0,shift,s.l5)
   && ReadValue(frames[idx].l10,0,shift,s.l10);
}
// Legacy v1.01 signal precedence retained: CSM > CSAK > CSA.
int Signal(Snapshot &s,bool onlyCSAK,string &name) {
 double c=s.bar.close,o=s.bar.open;name="";
 if(c>o) {
  if(!onlyCSAK && c>s.top) {name="CSM";return 1;}
  if(c>MathMax(s.h5,s.h10) && c>s.mid && c<=s.top) {name="CSAK";return 1;}
  if(!onlyCSAK && c>MathMax(s.h5,s.h10) && c<=s.mid) {name="CSA";return 1;}
 }
 if(c<o) {
  if(!onlyCSAK && c<s.low) {name="CSM";return -1;}
  if(c<MathMin(s.l5,s.l10) && c<s.mid && c>=s.low) {name="CSAK";return -1;}
  if(!onlyCSAK && c<MathMin(s.l5,s.l10) && c>=s.mid) {name="CSA";return -1;}
 }
 return 0;
}
// Explicit H1 trend proxy (NOT classical swing HH/HL):
// Rising MidBB and prior close above its own MidBB (BUY), inverse for SELL.
// Re-entry: wick touches 5/10 LOW band and closes above BOTH (BUY); HIGH inverse (SELL).
int ReentryDirection(int shift) {
 Snapshot s,p;
 if(!ReadFrame(0,shift,s) || !ReadFrame(0,shift+1,p))return 0;
 bool rising=(s.mid>p.mid && p.bar.close>p.mid);
 bool falling=(s.mid<p.mid && p.bar.close<p.mid);
 bool buy=rising && s.bar.low<=MathMax(s.l5,s.l10) && s.bar.close>MathMax(s.l5,s.l10)
          && s.bar.close>s.mid;
 bool sell=falling && s.bar.high>=MathMin(s.h5,s.h10) && s.bar.close<MathMin(s.h5,s.h10)
          && s.bar.close<s.mid;
 return buy?1:(sell?-1:0);
}
int FilterBias(datetime &eventTime) {
 eventTime=0;
 if(!H1FilterEnabled)return 0;
 for(int shift=1;shift<=H1ReentryMaxAgeBars+1;shift++) {
  int dir=ReentryDirection(shift);
  if(dir!=0) {eventTime=iTime(_Symbol,TF_Filter,shift);return dir;}
 }
 return 0;
}
int M15Bias(string &name,datetime &eventTime) {
 eventTime=0;name="";
 for(int shift=1;shift<=M15SignalMaxAgeBars+1;shift++) {
  Snapshot s;if(!ReadFrame(1,shift,s))return 0;
  string n;int dir=Signal(s,false,n);
  if(dir!=0) {name=n;eventTime=s.bar.time;return dir;}
 }
 return 0;
}

bool SidewaysOK() {
 if(!EnableSidewaysFilter)return true;
 Snapshot s;if(!ReadFrame(1,1,s))return false;
 double atr=0;
 if(!ReadValue(atrM15,0,1,atr) || atr<=0) return false;
 return (s.top-s.low)/atr>=MinBBWidthATR;
}
bool SellQualityOK(Snapshot &s,int dir) {
 if(dir!=-1 || !EnableSellQualityFilter)return true;
 double range=s.bar.high-s.bar.low;
 return range>0 && (s.bar.open-s.bar.close)/range>=MinSellBodyRatio && s.bar.close<s.mid;
}
double RoundToTick(double p,bool up) {
 double step=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(!Good(p)||!Good(step))return 0;
 return NormalizeDouble((up?MathCeil(p/step-1e-9):MathFloor(p/step+1e-9))*step,_Digits);
}
bool SessionOpen(datetime now) {
 MqlDateTime dt;if(!TimeToStruct(now,dt))return false;
 if(StartHour==EndHour)return true;
 if(StartHour<EndHour)return dt.hour>=StartHour && dt.hour<EndHour;
 return dt.hour>=StartHour || dt.hour<EndHour;
}
bool LatestTick(MqlTick &tick) {
 if(!SymbolInfoTick(_Symbol,tick)||!Good(tick.ask)||!Good(tick.bid)||tick.ask<tick.bid) return false;
 return true;
}
bool StopsOK(int dir,MqlTick &t,double sl,double tp) {
 double minDistance=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
 double freeze=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)*_Point;
 // Conservative distance includes both stops and freeze levels.
 double required=MathMax(minDistance,freeze);
 double slDistance=(dir==1?t.bid-sl:sl-t.ask);
 double tpDistance=(dir==1?tp-t.bid:t.ask-tp);
 return Good(sl)&&Good(tp)&&slDistance>0&&tpDistance>0&&slDistance>=required&&tpDistance>=required;
}
bool PlannedRisk(int dir,double volume,double entry,double sl,double &risk) {
 double pnl=0;
 if(!OrderCalcProfit(dir==1?ORDER_TYPE_BUY:ORDER_TYPE_SELL,_Symbol,volume,entry,sl,pnl))return false;
 risk=MathMax(0.0,-pnl);return MathIsValidNumber(risk);
}
// Current mark-to-stop risk is used against equity. Already-realized/floating damage
// is captured separately in equity and daily drawdown, never a negative budget credit.
bool ExposureRisk(double &total,int &positions) {
 total=0;positions=0;
 for(int i=PositionsTotal()-1;i>=0;i--) {
  ulong ticket=PositionGetTicket(i);if(ticket==0 || !PositionSelectByTicket(ticket))return false;
  if(PositionGetString(POSITION_SYMBOL)!=_Symbol || (ulong)PositionGetInteger(POSITION_MAGIC)!=Magic)continue;
  positions++;
  double sl=PositionGetDouble(POSITION_SL);
  if(!Good(sl)) {Skip("MISSING_SL");return false;}
  int dir=(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1);
  double quote=PositionGetDouble(POSITION_PRICE_CURRENT),risk=0;
  if(!Good(quote)||!PlannedRisk(dir,PositionGetDouble(POSITION_VOLUME),quote,sl,risk))return false;
  total+=risk;
 }
 return true;
}
string DayKey(datetime now) {
 MqlDateTime dt;TimeToStruct(now,dt);
 return rootKey+StringFormat(".D%04d%02d%02d",dt.year,dt.mon,dt.day);
}
datetime DayBegin(datetime now) {
 MqlDateTime dt;TimeToStruct(now,dt);dt.hour=0;dt.min=0;dt.sec=0;
 return StructToTime(dt);
}
bool DailyRiskOK(datetime now) {
 if(!PauseEntriesOnDailyDD)return true;
 string k=DayKey(now);
 double initial=0;
 if(!GlobalVariableGet(k,initial)) {
  // If prior account activity or overnight floating positions exist, today's
  // start equity cannot be reconstructed reliably: fail closed rather than invent.
  if(!HistorySelect(DayBegin(now),now)) {Skip("DAILY_HISTORY");return false;}
  if(HistoryDealsTotal()>0 || PositionsTotal()>0) {Skip("DAILY_BASELINE_UNKNOWN");return false;}
  initial=AccountInfoDouble(ACCOUNT_EQUITY);
  if(!Good(initial)||!EnsureVariable(k,initial)) {Skip("DAILY_BASELINE_SAVE");return false;}
  GlobalVariablesFlush();
 }
 if(!Good(initial)) {Skip("DAILY_BASELINE_INVALID");return false;}
 double drawdown=100.0*(initial-AccountInfoDouble(ACCOUNT_EQUITY))/initial;
 if(drawdown>=DailyDDLimitPercent) {Skip("DAILY_DD");return false;}
 return true;
}

// HARD NO-LAYER GATE: must execute inside AcquireLock, even when EnableRiskGuard=false.
// One open EA position or outstanding EA order for this Symbol+Magic blocks
// ALL new setups until it is closed/settled. Never auto-close existing positions.
bool NoLayerSlotFree() {
 for(int i=PositionsTotal()-1;i>=0;i--) {
  ulong ticket=PositionGetTicket(i);
  if(ticket==0 || !PositionSelectByTicket(ticket)) {
   Skip("NO_LAYER_POSITION_SCAN_FAILED");return false;
  }
  if(PositionGetString(POSITION_SYMBOL)==_Symbol &&
     (ulong)PositionGetInteger(POSITION_MAGIC)==Magic) {
   Skip("WAIT_POSITION_CLOSE");return false;
  }
 }
 for(int i=OrdersTotal()-1;i>=0;i--) {
  ulong ticket=OrderGetTicket(i);
  if(ticket==0) {Skip("NO_LAYER_ORDER_SCAN_FAILED");return false;}
  if(OrderGetString(ORDER_SYMBOL)==_Symbol &&
     (ulong)OrderGetInteger(ORDER_MAGIC)==Magic) {
   Skip("WAIT_PENDING_ORDER");return false;
  }
 }
 return true;
}
bool RiskOK(int dir,double entry,double sl) {
 if(!EnableRiskGuard)return true;
 double equity=AccountInfoDouble(ACCOUNT_EQUITY),one=0,total=0;
 int n=0;
 if(!Good(equity)||!PlannedRisk(dir,FixedLot,entry,sl,one)||!ExposureRisk(total,n)) {Skip("RISK_ACCOUNTING");return false;}
 if(n>=MaxConcurrentPositions) {Skip("MAX_POSITIONS");return false;}
 if(one>equity*MaxRiskPerTradePercent/100.0+1e-7) {Skip("RISK_TRADE");return false;}
 if(total+one>equity*MaxCombinedRiskPercent/100.0+1e-7) {Skip("RISK_TOTAL");return false;}
 return true;
}
// Short-lived CAS lock serializes exposure calculation, claims and order submission
// across charts with the SAME account/server/symbol/Magic.
bool AcquireLock(datetime now) {
 if(!EnsureVariable(lockKey,0))return false;
 double prev=0;
 if(!GlobalVariableGet(lockKey,prev))return false;
 if(prev>(double)now)return false;
 double lease=(double)now+120.0;
 if(!GlobalVariableSetOnCondition(lockKey,lease,prev))return false;
 ownedLockLease=lease;return true;
}
void ReleaseLock() {
 if(ownedLockLease>0)GlobalVariableSetOnCondition(lockKey,0,ownedLockLease);
 ownedLockLease=0;
}
bool HasExecuted(datetime bar) {
 // Limited historical lookback; deals and active orders survive restart.
 if(!HistorySelect(bar,TimeCurrent()))return true;
 string tag=TicketTag(bar);
 for(int i=HistoryDealsTotal()-1;i>=0;i--) {
  ulong t=HistoryDealGetTicket(i);
  if(HistoryDealGetString(t,DEAL_SYMBOL)==_Symbol && (ulong)HistoryDealGetInteger(t,DEAL_MAGIC)==Magic
     && StringFind(HistoryDealGetString(t,DEAL_COMMENT),tag)==0)return true;
 }
 for(int i=OrdersTotal()-1;i>=0;i--) {
  ulong t=OrderGetTicket(i);
  if(t>0 && OrderGetString(ORDER_SYMBOL)==_Symbol && (ulong)OrderGetInteger(ORDER_MAGIC)==Magic
     && StringFind(OrderGetString(ORDER_COMMENT),tag)==0)return true;
 }
 return false;
}
bool Claim(datetime bar) {
 double old=0;
 if(!GlobalVariableGet(claimKey,old) || old>=(double)bar || HasExecuted(bar))return false;
 if(!GlobalVariableSetOnCondition(claimKey,(double)bar,old))return false;
 GlobalVariablesFlush();return true;
}


// Fail closed when the terminal's persistent claim state is lost or expired.
// The order comment embeds the H1-M15 setup identity to recover from history.
bool HasExecutedSetup(string prefix,datetime earliest) {
 if(earliest<=0 || !HistorySelect(earliest,TimeCurrent())) {
  Skip("SETUP_HISTORY_UNAVAILABLE");return true;
 }
 for(int i=HistoryDealsTotal()-1;i>=0;i--) {
  ulong t=HistoryDealGetTicket(i);if(t==0)continue;
  if(HistoryDealGetString(t,DEAL_SYMBOL)!=_Symbol ||
     (ulong)HistoryDealGetInteger(t,DEAL_MAGIC)!=Magic)continue;
  ulong order=(ulong)HistoryDealGetInteger(t,DEAL_ORDER);
  if(CommentIsSetup(HistoryDealGetString(t,DEAL_COMMENT),prefix) ||
     (order>0 && CommentIsSetup(HistoryOrderGetString(order,ORDER_COMMENT),prefix)))return true;
 }
 for(int i=HistoryOrdersTotal()-1;i>=0;i--) {
  ulong t=HistoryOrderGetTicket(i);if(t==0)continue;
  if(HistoryOrderGetString(t,ORDER_SYMBOL)==_Symbol &&
     (ulong)HistoryOrderGetInteger(t,ORDER_MAGIC)==Magic &&
     CommentIsSetup(HistoryOrderGetString(t,ORDER_COMMENT),prefix))return true;
 }
 for(int i=OrdersTotal()-1;i>=0;i--) {
  ulong t=OrderGetTicket(i);if(t==0)continue;
  if(OrderGetString(ORDER_SYMBOL)==_Symbol &&
     (ulong)OrderGetInteger(ORDER_MAGIC)==Magic &&
     CommentIsSetup(OrderGetString(ORDER_COMMENT),prefix))return true;
 }
 for(int i=PositionsTotal()-1;i>=0;i--) {
  ulong t=PositionGetTicket(i);if(t==0)continue;
  if(PositionGetString(POSITION_SYMBOL)==_Symbol &&
     (ulong)PositionGetInteger(POSITION_MAGIC)==Magic &&
     CommentIsSetup(PositionGetString(POSITION_COMMENT),prefix))return true;
 }
 return false;
}
// Called ONLY under AcquireLock. Persistent CAS reserves one submission attempt
// per SetupID across charts and MT5 restarts. Never release on ambiguous fills.
bool ClaimSetup(datetime h1Time,datetime m15Time,int dir,string prefix) {
 if(m15Time<=0 || (H1FilterEnabled && h1Time<=0) || (dir!=1 && dir!=-1)) {
  Skip("SETUP_ID_INVALID");return false;
 }
 string k=SetupStateKey(h1Time,m15Time,dir);
 if(StringLen(k)>63 || !EnsureVariable(k,0)) {Skip("SETUP_STATE_UNAVAILABLE");return false;}
 double used=0;
 if(!GlobalVariableGet(k,used)) {Skip("SETUP_STATE_READ");return false;}
 if(used!=0) {Skip("SETUP_ALREADY_USED");return false;}
 datetime from=(h1Time>0 && h1Time<m15Time?h1Time:m15Time);
 if(HasExecutedSetup(prefix,from)) {Skip("SETUP_HISTORY_DUPLICATE");return false;}
 if(!GlobalVariableSetOnCondition(k,1,0)) {Skip("SETUP_CLAIM_RACE");return false;}
 GlobalVariablesFlush();
 return true;
}

void Execute(int dir,datetime bar,string signalName,datetime h1Time,datetime m15Time) {
 MqlTick t;if(!LatestTick(t)) {Skip("QUOTE");return;}
 datetime closed=bar+PeriodSeconds(TF_Entry);
 if(t.time<closed || t.time-closed>MaxEntryDelaySeconds) {Skip("STALE");return;}
 if(!autopilot || !SessionOpen(t.time)) {Skip("SESSION_OR_PILOT");return;}
 if(!MQLInfoInteger(MQL_TRADE_ALLOWED)||!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)
   ||!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)) {Skip("TRADE_DISABLED");return;}
 if((t.ask-t.bid)/_Point>MaxSpreadPoints+1e-7) {Skip("SPREAD");return;}
 // Selected BB SL timeframe, always from a closed candle (shift=1).
 double stopBand=0;datetime stopBar=0;
 if(!ReadClosedStopBand(dir,stopBand,stopBar)) {Skip("SL_TF_BB_DATA");return;}
 double entry=(dir==1?t.ask:t.bid);
 double sl=RoundToTick(dir==1?stopBand-SLBufferPoints*_Point:stopBand+SLBufferPoints*_Point,dir==-1);
 double distance=dir*(entry-sl);
 if(!Good(sl)||distance<=0) {Skip("INVALID_SL");return;}
 double tp=RoundToTick(entry+dir*RR*distance,dir==1);
 if(!StopsOK(dir,t,sl,tp)) {Skip("INVALID_STOPS");return;}
 double margin=0;
 if(!OrderCalcMargin(dir==1?ORDER_TYPE_BUY:ORDER_TYPE_SELL,_Symbol,FixedLot,entry,margin)
    ||margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)) {Skip("MARGIN");return;}
 if(!AcquireLock(t.time)) {Skip("EXPOSURE_LOCK");return;}
 // Dynamic risk and daily limits are rechecked under the shared trade lock.
 if(!NoLayerSlotFree() || !DailyRiskOK(t.time) || !RiskOK(dir,entry,sl)) {ReleaseLock();return;}
 MqlTick fresh;
 if(!LatestTick(fresh) || fresh.time!=t.time ||
    MathAbs(fresh.ask-t.ask)>SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE)*0.5 ||
    MathAbs(fresh.bid-t.bid)>SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE)*0.5 ||
    (fresh.ask-fresh.bid)/_Point>MaxSpreadPoints+1e-7) {
  ReleaseLock();Skip("QUOTE_CHANGED_IN_LOCK");return;
 }
 if(!trade.SetTypeFillingBySymbol(_Symbol)) {ReleaseLock();Skip("FILLING_MODE");return;}
 // The stable H1-M15 SetupID fits the broker's usual 31-character comment limit.
 string prefix=SetupPrefix(h1Time,m15Time,dir);
 string tag=prefix+":"+SignalCode(signalName);
 if(StringLen(tag)>31 || StringLen(SetupStateKey(h1Time,m15Time,dir))>63) {
  ReleaseLock();Skip("SETUP_TAG_TOO_LONG");return;
 }
 // Claim M5 and H1-M15 atomically before order submission. Other M5 signals
 // for this pair get SETUP_ALREADY_USED; a new H1/M15 pair gets a new key.
 if(!Claim(bar) || !ClaimSetup(h1Time,m15Time,dir,prefix)) {ReleaseLock();return;}
 bool submitted=(dir==1?trade.Buy(FixedLot,_Symbol,entry,sl,tp,tag):trade.Sell(FixedLot,_Symbol,entry,sl,tp,tag));
 uint rc=trade.ResultRetcode();ReleaseLock();
 if(!submitted || (rc!=TRADE_RETCODE_DONE && rc!=TRADE_RETCODE_DONE_PARTIAL && rc!=TRADE_RETCODE_PLACED)) {
  Print("ORDER_FAILED RETCODE=",rc," ; claim retained to prevent replay");return;
 }
 Print("ORDER_ACCEPTED ",(dir==1?"BUY":"SELL")," M15=",signalName,
       " SetupID=",prefix," H1=",BarTime(h1Time)," M15_SIGNAL=",BarTime(m15Time),
       " SL_TF=",StopTFName()," SL_CLOSED_BAR=",BarTime(stopBar),
       " SL=",DoubleToString(sl,_Digits)," TP_PRE_FILL=",DoubleToString(tp,_Digits));
}

// After fill, reconcile TP against real average position opening price.
// Protective SL/TP are included in initial order; no naked exposure is allowed.
bool ReconcileRR(ulong positionTicket) {
 if(positionTicket==0 || !PositionSelectByTicket(positionTicket))return false;
 if((ulong)PositionGetInteger(POSITION_MAGIC)!=Magic || PositionGetString(POSITION_SYMBOL)!=_Symbol)return false;
 int dir=(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1);
 double entry=PositionGetDouble(POSITION_PRICE_OPEN),sl=PositionGetDouble(POSITION_SL);
 double risk=dir*(entry-sl);
 if(!Good(sl)||!Good(entry)||risk<=0) {
  // An immediate fill transaction can precede position stop propagation.
  // SafetyWatch closes a position only if the invalid SL persists >=3 seconds.
  Print("RR_PENDING_VALID_STOPS position=",positionTicket);
  return false;
 }
 double target=RoundToTick(entry+dir*RR*risk,dir==1);
 double current=PositionGetDouble(POSITION_TP),tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(!Good(target))return false;
 if(MathAbs(target-current)<tickSize*0.5)return true;
 MqlTick quote;if(!LatestTick(quote)||!StopsOK(dir,quote,sl,target)) {
  Print("RR_RECONCILE_UNAVAILABLE position=",positionTicket,"; original protective stops retained");return false;
 }
 if(!trade.PositionModify(positionTicket,sl,target) || trade.ResultRetcode()!=TRADE_RETCODE_DONE) {
  Print("RR_MODIFY_FAILED position=",positionTicket," ret=",trade.ResultRetcode());return false;
 }
 return true;
}
string FilledMessage(ulong deal,ulong positionTicket) {
 int dir=(HistoryDealGetInteger(deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1);
 double fill=HistoryDealGetDouble(deal,DEAL_PRICE),lots=HistoryDealGetDouble(deal,DEAL_VOLUME),sl=0,tp=0;
 ulong order=(ulong)HistoryDealGetInteger(deal,DEAL_ORDER);
 if(HistoryOrderSelect(order)) {
  sl=HistoryOrderGetDouble(order,ORDER_SL);
  tp=HistoryOrderGetDouble(order,ORDER_TP);
 }
 if(positionTicket>0 && PositionSelectByTicket(positionTicket)) {
  fill=PositionGetDouble(POSITION_PRICE_OPEN);lots=PositionGetDouble(POSITION_VOLUME);
  sl=PositionGetDouble(POSITION_SL);tp=PositionGetDouble(POSITION_TP);
 }
 string signal="CSA/CSAK/CSM";
 string comment=HistoryDealGetString(deal,DEAL_COMMENT);
 // Code suffix: A=CSA, K=CSAK, M=CSM. Works with legacy comments too.
 if(StringLen(comment)>0) {
  string suffix=StringSubstr(comment,StringLen(comment)-1);
  if(suffix=="A")signal="CSA";
  else if(suffix=="K")signal="CSAK";
  else if(suffix=="M")signal="CSM";
 }
 return BRAND+"\n"+(dir==1?"BUY":"SELL")+" "+_Symbol+
        "\nH1 RE-ENTRY > M15 "+signal+" > M5 CSAK"+
        "\nENTRY : "+DoubleToString(fill,_Digits)+
        "\nSL BB "+StopTFName()+" : "+DoubleToString(sl,_Digits)+
        "\nTP RR 1:2 : "+DoubleToString(tp,_Digits)+
        "\nLOT : "+DoubleToString(lots,2)+
        "\nPOSITION ID : "+IntegerToString(HistoryDealGetInteger(deal,DEAL_POSITION_ID))+
        "\nBROKER : "+BarTime((datetime)HistoryDealGetInteger(deal,DEAL_TIME))+
        "\nOJO FULLMARGIN COK";
}
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result) {
 if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || trans.deal==0)return;
 if(!HistoryDealSelect(trans.deal))return;
 if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=_Symbol || (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=Magic)return;
 if(HistoryDealGetInteger(trans.deal,DEAL_ENTRY)!=DEAL_ENTRY_IN)return;
 ulong posTicket=trans.position;
 ReconcileRR(posTicket); // Also handle further partial fills that change average price.
 if(!NotifyOnFilledEntry || (!EnableTelegram && !EnableMT5Push))return;
 long posId=HistoryDealGetInteger(trans.deal,DEAL_POSITION_ID);
 string seen=rootKey+".N"+IntegerToString(posId);
 // CAS de-dup does not wait for trading lock; partial fills share position ID.
 // Delivery policy: at-most-once attempt, not guaranteed remote delivery.
 if(!EnsureVariable(seen,0)) {Print("NOTIFY_STATE_FAILED position=",posId);return;}
 if(GlobalVariableSetOnCondition(seen,1,0)) {
  GlobalVariablesFlush();
  Enqueue(FilledMessage(trans.deal,posTicket),EnableTelegram,EnableMT5Push);
 }
}

void ReleaseAll() {
 for(int i=0;i<FRAME_COUNT;i++) {
  if(frames[i].bb!=INVALID_HANDLE)IndicatorRelease(frames[i].bb);
  if(frames[i].h5!=INVALID_HANDLE)IndicatorRelease(frames[i].h5);
  if(frames[i].h10!=INVALID_HANDLE)IndicatorRelease(frames[i].h10);
  if(frames[i].l5!=INVALID_HANDLE)IndicatorRelease(frames[i].l5);
  if(frames[i].l10!=INVALID_HANDLE)IndicatorRelease(frames[i].l10);
 }
 if(atrM15!=INVALID_HANDLE)IndicatorRelease(atrM15);
 if(slBands!=INVALID_HANDLE)IndicatorRelease(slBands);
}
int OnInit() {
 for(int i=0;i<FRAME_COUNT;i++) {
  frames[i].bb=INVALID_HANDLE;frames[i].h5=INVALID_HANDLE;frames[i].h10=INVALID_HANDLE;
  frames[i].l5=INVALID_HANDLE;frames[i].l10=INVALID_HANDLE;
 }
 if(TF_Filter!=PERIOD_H1 || TF_Signal!=PERIOD_M15 || TF_Entry!=PERIOD_M5
    || H1ReentryMaxAgeBars<1 || H1ReentryMaxAgeBars>24
    || M15SignalMaxAgeBars<0 || M15SignalMaxAgeBars>96
    || TF_StopLoss==PERIOD_CURRENT || PeriodSeconds(TF_StopLoss)<=0
     || BBPeriod<10 || !Good(BBDeviation) || !Good(FixedLot)
    || SLBufferPoints<0 || MaxSpreadPoints<0 || DeviationPoints<0 || MaxEntryDelaySeconds<=0
    || StartHour<0 || StartHour>23 || EndHour<0 || EndHour>24
    || !Good(MaxRiskPerTradePercent) || !Good(MaxCombinedRiskPercent) || MaxConcurrentPositions!=1
    || !Good(DailyDDLimitPercent) || !Good(MinBBWidthATR) || MinSellBodyRatio<=0 || MinSellBodyRatio>1.0)
  return INIT_PARAMETERS_INCORRECT;
 if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) {
  Print("ACCOUNT_NOT_HEDGING; independent SL/TP positions required");return INIT_FAILED;
 }
 double vmin=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),vmax=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
 double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 if(!Good(step)||FixedLot<vmin||FixedLot>vmax||MathAbs(FixedLot/step-MathRound(FixedLot/step))>1e-7)
  return INIT_PARAMETERS_INCORRECT;
 for(int i=0;i<FRAME_COUNT;i++) {
  ENUM_TIMEFRAMES tf=(i==0?TF_Filter:(i==1?TF_Signal:TF_Entry));
  frames[i].bb=iBands(_Symbol,tf,BBPeriod,0,BBDeviation,PRICE_CLOSE);
  frames[i].h5=iMA(_Symbol,tf,5,0,MODE_LWMA,PRICE_HIGH);
  frames[i].h10=iMA(_Symbol,tf,10,0,MODE_LWMA,PRICE_HIGH);
  frames[i].l5=iMA(_Symbol,tf,5,0,MODE_LWMA,PRICE_LOW);
  frames[i].l10=iMA(_Symbol,tf,10,0,MODE_LWMA,PRICE_LOW);
  if(frames[i].bb==INVALID_HANDLE||frames[i].h5==INVALID_HANDLE||frames[i].h10==INVALID_HANDLE
     ||frames[i].l5==INVALID_HANDLE||frames[i].l10==INVALID_HANDLE) {ReleaseAll();return INIT_FAILED;}
 }
 atrM15=iATR(_Symbol,TF_Signal,14);
 if(atrM15==INVALID_HANDLE) {ReleaseAll();return INIT_FAILED;}
 slBands=iBands(_Symbol,TF_StopLoss,BBPeriod,0,BBDeviation,PRICE_CLOSE);
 if(slBands==INVALID_HANDLE) {Print("SL_TF_BANDS_INIT_FAILED ",StopTFName());ReleaseAll();return INIT_FAILED;}
 if(!BuildKeys()) {ReleaseAll();Print("KEY_INIT_FAILED");return INIT_FAILED;}
 // Tester state from a prior pass MUST NOT leak into a new backtest/ablation.
 if(MQLInfoInteger(MQL_TESTER))GlobalVariablesDeleteAll(rootKey);
 if(!EnsureVariable(claimKey,0) || !EnsureVariable(lockKey,0)
   || !EnsureVariable(pilotKey,StartAutopilot?1:0) || !ReadPilot()) {
  ReleaseAll();Print("STATE_INIT_FAILED");return INIT_FAILED;
 }
 trade.SetExpertMagicNumber(Magic);
 trade.SetDeviationInPoints(DeviationPoints);
 trade.SetAsyncMode(false);
 // Startup does NOT replay the most recent M5 event.
 evaluated=iTime(_Symbol,TF_Entry,1);armed=(evaluated>0);
 PaintButton();EventSetTimer(1);
 Print("CEBONK v1.05 NO-LAYER STARTED; 1 position max; H1 filter=",H1FilterEnabled,
       "; stop=BB ",StopTFName()," CLOSED; riskguard=",EnableRiskGuard,
       "; Telegram=",EnableTelegram,
       "; safety defaults are NOT backtest-validated");
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) {
 EventKillTimer();ReleaseAll();ObjectDelete(0,button);
}
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam) {
 if(id==CHARTEVENT_OBJECT_CLICK && sparam==button)TogglePilot();
}
void OnTick() {
 if(stateFault)return;
 bool previous=autopilot;
 if(!ReadPilot()) {stateFault=true;autopilot=false;Skip("PILOT_READ");PaintButton();return;}
 if(previous!=autopilot)PaintButton();
 datetime signalBar=iTime(_Symbol,TF_Entry,1);
 if(signalBar<=0)return;
 if(!armed) {evaluated=signalBar;armed=true;return;}
 if(signalBar==evaluated)return;
 datetime closed=signalBar+PeriodSeconds(TF_Entry);
 datetime now=TimeCurrent();
 if(now<closed || now-closed>MaxEntryDelaySeconds) {evaluated=signalBar;Skip("STALE");return;}
 Snapshot m5;if(!ReadFrame(2,1,m5))return;
 if(m5.bar.time!=signalBar)return;
 // Mark evaluated even on an invalid signal so one event is evaluated once.
 evaluated=signalBar;
 if(!autopilot || !SessionOpen(now))return;
 string triggerName;int m5Dir=Signal(m5,true,triggerName);
 if(m5Dir==0)return;
 datetime h1Event=0,m15Event=0;
 int h1Dir=FilterBias(h1Event);string signalName;int m15Dir=M15Bias(signalName,m15Event);
 if(H1FilterEnabled && h1Dir==0) {Skip("H1_REENTRY_NONE_OR_EXPIRED");return;}
 if(m15Dir==0 || m15Dir!=m5Dir || (H1FilterEnabled && h1Dir!=m5Dir)) {Skip("TF_DIRECTION");return;}
 if(!SidewaysOK()) {Skip("SIDEWAYS");return;}
 Snapshot m15;
 int confirmShift=iBarShift(_Symbol,TF_Signal,m15Event,true);
 if(confirmShift<1 || !ReadFrame(1,confirmShift,m15))return;
 if(!SellQualityOK(m15,m5Dir)) {Skip("SELL_QUALITY");return;}
 Execute(m5Dir,signalBar,signalName,h1Event,m15Event);
}