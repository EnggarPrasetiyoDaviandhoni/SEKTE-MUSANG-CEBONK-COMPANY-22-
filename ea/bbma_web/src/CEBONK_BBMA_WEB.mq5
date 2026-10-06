// CEBONK COMPANY 22 | BBMA WEB EA | v1.01
// Web-aligned BBMA: TF1 RE-ENTRY -> TF2 CSAK/CSM -> TF3 CSM.
// Astrology is master direction/time. Astrology News overrides normal Astrology during a news episode.
// Fixed lot only. SL = TF2 opposite Bollinger Band +/- fixed price buffer. TP = actual-entry RR.
// No ATR, martingale, recovery, layering, BE, trailing, or strategy partial close.
#property strict
#property version "1.01"
#property description "CEBONK BBMA WEB EA. Modular, closed-candle, fixed lot. Demo/backtest verification required."
#property tester_file "CEBONK_C2_ASTRO.csv"
#property tester_file "CEBONK_C2_NEWS.csv"

#include "BWCore.mqh"
#include "BWAstroNews.mqh"
#include "BWTrade.mqh"

input group "01 | EXECUTION"
input string InpSymbol="XAUUSDc";
input ulong InpMagic=221022;
input bool InpAutopilot=false;
input bool InpAllowRealAccount=false;
input double InpFixedLot=0.01;
input int InpMaxSpreadPoints=70;
input int InpDeviationPoints=30;
input double InpRR=2.0;
input double InpSLBufferPrice=0.20;
input int InpHistoryBars=120;
input bool InpEnableCutProfit=true;

input group "02 | ASTROLOGY WEB MASTER"
input BW_ASTRO_SOURCE InpAstroSource=BW_ASTRO_WEB_MONTH;
input string InpAstroBaseURL="https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/";
input string InpAstroCSV="CEBONK_C2_ASTRO.csv";
input bool InpCSVCommonFolder=false;
input bool InpAcceptExperimentalAstro=true;
input int InpHTTPTimeoutMs=3000;
input bool InpLiveAutoServerUTC=true;
input int InpServerUTCMinutes=180;

input group "03 | ASTROLOGY NEWS OVERRIDE"
input bool InpUseAstrologyNews=true;
input BW_NEWS_SOURCE InpNewsSource=BW_NEWS_MT5_CALENDAR;
input string InpNewsCSV="CEBONK_C2_NEWS.csv";
input bool InpAllowNewsCSVReplay=false;
input int InpNewsPreMinutes=30;
input int InpNewsPostMinutes=120;
input int InpNewsBlockBeforeMinutes=5;
input int InpNewsBlockAfterMinutes=5;
input int InpNewsEntrySpanMinutes=10;
input int InpNewsMinWindowMinutes=15;
input int InpNewsPollSeconds=60;
input int InpNewsMaxCacheSeconds=180;

input group "04 | TELEGRAM / MT5"
input bool InpTelegram=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpMT5Push=true;
input bool InpTelegramTestOnStart=true;

bool gTester=false,gAuto=false;
string gButton="",gScope="",gLastBlock="",gLastSignalKey="";
long gM1=0,gM5=0,gM15=0,gM30=0,gH1=0,gH4=0,gLastCutTry=0;

void BWPaint(){
 if(ObjectFind(0,gButton)<0)return;
 ObjectSetString(0,gButton,OBJPROP_TEXT,gAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gAuto?clrDarkGreen:clrFireBrick);
 ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
}
void BWBlock(const string s){
 if(gLastBlock==s)return;gLastBlock=s;Print("BBMA WEB | ",s);
 if(ObjectFind(0,gButton)>=0)ObjectSetString(0,gButton,OBJPROP_TOOLTIP,s);
}
bool BWInputsOK(){
 if(InpSymbol==""||InpMagic==0||InpFixedLot<=0||InpRR<1.0||InpRR>10.0||InpSLBufferPrice<0||InpHistoryBars<40||InpHistoryBars>1000)return false;
 if(InpMaxSpreadPoints<1||InpDeviationPoints<0||InpHTTPTimeoutMs<500)return false;
 if(InpNewsPreMinutes<5||InpNewsPreMinutes>120||InpNewsPostMinutes<30||InpNewsPostMinutes>360)return false;
 if(InpNewsBlockBeforeMinutes<0||InpNewsBlockBeforeMinutes>60||InpNewsBlockAfterMinutes<5||InpNewsBlockAfterMinutes>60)return false;
 if(InpNewsEntrySpanMinutes<5||InpNewsEntrySpanMinutes>60||InpNewsMinWindowMinutes<5||InpNewsMinWindowMinutes>60)return false;
 if(InpNewsPollSeconds<15||InpNewsPollSeconds>120||InpNewsMaxCacheSeconds<InpNewsPollSeconds||InpNewsMaxCacheSeconds>600)return false;
 return true;
}
string BWPackagesText(const bool buy[],const bool sell[],const int dir){
 string s="";for(int i=0;i<BW_PACKAGE_COUNT;i++){
  bool ok=dir>0?buy[i]:sell[i];if(!ok)continue;BWPackageSpec p;BWGetPackage(i,p);if(s!="")s+=" + ";s+=p.id;
 }return s;
}
int BWCountSide(const bool flags[]){int n=0;for(int i=0;i<BW_PACKAGE_COUNT;i++)if(flags[i])n++;return n;}

bool BWSignalConsumed(const string key){
 if(gLastSignalKey==key)return true;
 return !gTester&&GlobalVariableCheck(gScope+key);
}
void BWReserveSignal(const string key){
 gLastSignalKey=key;if(!gTester){GlobalVariableSet(gScope+key,(double)TimeCurrent());GlobalVariablesFlush();}
}

void BWEvaluate(){
 if(BWHasPositionOrOrder(InpSymbol)){BWBlock("SYMBOL_ALREADY_HAS_POSITION_OR_ORDER");return;}
 long nowServer=(long)TimeTradeServer();if(nowServer<=0)nowServer=(long)TimeCurrent();
 long nowUtc=BWNowUTC(gTester,InpLiveAutoServerUTC,InpServerUTCMinutes);
 bool buy[BW_PACKAGE_COUNT],sell[BW_PACKAGE_COUNT];BWSignal bs[BW_PACKAGE_COUNT],ss[BW_PACKAGE_COUNT];
 for(int i=0;i<BW_PACKAGE_COUNT;i++){buy[i]=false;sell[i]=false;string wb="",ws="";
  buy[i]=BWScanDirection(InpSymbol,i,1,nowServer,InpRR,InpSLBufferPrice,InpHistoryBars,bs[i],wb);
  sell[i]=BWScanDirection(InpSymbol,i,-1,nowServer,InpRR,InpSLBufferPrice,InpHistoryBars,ss[i],ws);
 }
 int bc=BWCountSide(buy),sc=BWCountSide(sell);
 if(bc>0&&sc>0){BWBlock("BBMA_PACKAGE_CONFLICT_BUY_SELL");return;}
 if(bc==0&&sc==0){BWBlock("BBMA_WAIT_NO_VALID_PACKAGE");return;}
 int dir=bc>0?1:-1,count=dir>0?bc:sc,chosen=-1;
 for(int i=0;i<BW_PACKAGE_COUNT;i++)if((dir>0&&buy[i])||(dir<0&&sell[i])){chosen=i;break;}
 if(chosen<0)return;BWSignal sig;if(dir>0)sig=bs[chosen];else sig=ss[chosen];
 long eventUtc=BWServerToUTC(sig.eventAt,gTester,InpLiveAutoServerUTC,InpServerUTCMinutes);
 bool newsMode=false;string gate="";
 if(InpUseAstrologyNews){
  if(!BWNewsHealthy(gTester,InpNewsSource,InpNewsMaxCacheSeconds,InpLiveAutoServerUTC,InpServerUTCMinutes)){BWBlock("NEWS_DATA_WAIT_FAIL_CLOSED: "+gBWNewsError);return;}
  BWNewsGate ng=BWBuildNewsGate(nowUtc,InpNewsPreMinutes,InpNewsPostMinutes,InpNewsBlockBeforeMinutes,InpNewsBlockAfterMinutes,InpNewsEntrySpanMinutes,InpNewsMinWindowMinutes,InpAcceptExperimentalAstro);
  if(ng.episode){
   newsMode=true;if(!ng.candidate){BWBlock(ng.reason);return;}
   if(dir!=ng.dir){BWBlock("ASTROLOGY_NEWS_DIRECTION_MISMATCH");return;}
   if(eventUtc<ng.windowStart||eventUtc>=ng.entryEnd){BWBlock("TECHNICAL_EVENT_OUTSIDE_ASTROLOGY_NEWS_ENTRY_WINDOW");return;}
   gate="ASTROLOGY NEWS "+BWSide(dir)+" | "+ng.names+" | "+BWWIB(ng.windowStart)+" -> "+BWWIB(ng.entryEnd);
  }
 }
 if(!newsMode){
  if(!BWAstroNormalGate(nowUtc,eventUtc,dir,InpAcceptExperimentalAstro,gate)){BWBlock(gate);return;}
 }
 string mode=newsMode?"NEWS":"NORMAL",key="S."+(string)sig.pkg+"."+(string)dir+"."+(string)sig.eventAt+"."+mode;
 if(BWSignalConsumed(key)){BWBlock("SIGNAL_ALREADY_CONSUMED");return;}
 BWReserveSignal(key);
 BWPackageSpec p;BWGetPackage(sig.pkg,p);
 int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
 string strength=count>1?"STRONG CONFLUENCE":"VALID";
 string text=strength+" "+BWSide(dir)+" | "+mode+"\nPackages: "+BWPackagesText(buy,sell,dir)+"\n"+
 "TF1 "+p.id+" RE-ENTRY -> TF2 "+sig.tf2Type+" -> TF3 CSM\n"+
 gate+"\nSignal close: "+BWWIB(eventUtc)+"\nReference: "+DoubleToString(sig.referenceEntry,digits)+
 "\nSL TF2 BB: "+DoubleToString(sig.structuralSL,digits)+"\nTP: RR 1:"+DoubleToString(InpRR,2)+" saka fill nyata";
 BWNotice("SIGNAL_VALID",text,InpSymbol,gTester,gAuto);
 if(!gAuto){BWBlock("AUTOPILOT_OFF_SIGNAL_ONLY");return;}
 string why;ulong order=0;
 if(!BWPlace(InpSymbol,InpMagic,sig,newsMode,InpFixedLot,InpMaxSpreadPoints,InpDeviationPoints,InpAllowRealAccount,InpRR,why,order)){
  BWNotice("ORDER_REJECTED",why+" | ora retry sinyal sing padha",InpSymbol,gTester,gAuto);BWBlock(why);return;
 }
 BWNotice("ORDER_ACCEPTED","order="+(string)order+" | "+mode+" | "+p.id+" | fixed lot "+DoubleToString(InpFixedLot,2),InpSymbol,gTester,gAuto);
 gLastBlock="";
}

void BWManageCut(){
 if(!InpEnableCutProfit)return;ulong ticket=0;int dir=0,pkg=-1;double open=0,sl=0;
 if(!BWOurPosition(InpSymbol,InpMagic,ticket,dir,pkg,open,sl)||pkg<0||sl<=0)return;
 double risk=MathAbs(open-sl);if(risk<=0)return;MqlTick q;if(!SymbolInfoTick(InpSymbol,q))return;
 double move=dir>0?q.bid-open:open-q.ask;if(move<risk)return;
 bool opp=false,mid=false;if(!BWLatestCutSignal(InpSymbol,pkg,dir,opp,mid)||(!opp&&!mid))return;
 long now=(long)TimeCurrent();if(now-gLastCutTry<5)return;gLastCutTry=now;
 string why;if(BWClosePosition(InpSymbol,ticket,dir,InpDeviationPoints,why))
  BWNotice("CUT_PROFIT","Reached >=1R | "+(opp?"opposite TF3 CSM":"")+(opp&&mid?" + ":"")+(mid?"TF2 Mid BB break":""),InpSymbol,gTester,gAuto);
 else BWBlock("CUT_PROFIT_CLOSE_FAIL: "+why);
}

bool BWPulse(){
 long m1=(long)iTime(InpSymbol,PERIOD_M1,0),m5=(long)iTime(InpSymbol,PERIOD_M5,0),m15=(long)iTime(InpSymbol,PERIOD_M15,0);
 long m30=(long)iTime(InpSymbol,PERIOD_M30,0),h1=(long)iTime(InpSymbol,PERIOD_H1,0),h4=(long)iTime(InpSymbol,PERIOD_H4,0);
 bool changed=(m1>0&&m1!=gM1)||(m5>0&&m5!=gM5)||(m15>0&&m15!=gM15)||
              (m30>0&&m30!=gM30)||(h1>0&&h1!=gH1)||(h4>0&&h4!=gH4);
 gM1=m1;gM5=m5;gM15=m15;gM30=m30;gH1=h1;gH4=h4;return changed;
}
void BWHeartbeat(){
 BWAstroPoll(gTester,InpAstroSource,InpAstroBaseURL,InpAstroCSV,InpCSVCommonFolder,InpHTTPTimeoutMs,InpLiveAutoServerUTC,InpServerUTCMinutes);
 if(InpUseAstrologyNews)BWNewsPoll(gTester,InpNewsSource,InpNewsCSV,InpCSVCommonFolder,InpAllowNewsCSVReplay,InpNewsPollSeconds,InpNewsMaxCacheSeconds,InpLiveAutoServerUTC,InpServerUTCMinutes);
 BWFlushNotice(gTester,InpMT5Push,InpTelegram,InpTelegramToken,InpTelegramChatID,InpHTTPTimeoutMs);
 BWManageCut();
}

int OnInit(){
 gTester=(bool)MQLInfoInteger(MQL_TESTER);gAuto=InpAutopilot;
 if(_Symbol!=InpSymbol){Print("Pasang EA neng chart ",InpSymbol,". TF chart bebas.");return INIT_PARAMETERS_INCORRECT;}
 if(!BWInputsOK())return INIT_PARAMETERS_INCORRECT;
 gScope="CEBONK.BW."+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"."+InpSymbol+"."+(string)InpMagic+".";
 gButton="CEBONK_BW_AUTO_"+(string)ChartID();
 if(!gTester){
  ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0);ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
  ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12);ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,18);
  ObjectSetInteger(0,gButton,OBJPROP_XSIZE,126);ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);BWPaint();
 }
 gM1=(long)iTime(InpSymbol,PERIOD_M1,0);gM5=(long)iTime(InpSymbol,PERIOD_M5,0);gM15=(long)iTime(InpSymbol,PERIOD_M15,0);
 gM30=(long)iTime(InpSymbol,PERIOD_M30,0);gH1=(long)iTime(InpSymbol,PERIOD_H1,0);gH4=(long)iTime(InpSymbol,PERIOD_H4,0);
 EventSetTimer(1);BWHeartbeat();
 BWNotice("EA_STARTED","BBMA WEB v1.01 | fixed lot | RR "+DoubleToString(InpRR,2)+" | SL TF2 BB + buffer | Astrology News "+(InpUseAstrologyNews?"ON":"OFF"),InpSymbol,gTester,gAuto);
 if(InpTelegramTestOnStart)BWNotice("TELEGRAM_TEST","Tes notifikasi. Ora ana order.",InpSymbol,gTester,gAuto);
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){EventKillTimer();if(ObjectFind(0,gButton)>=0)ObjectDelete(0,gButton);}
void OnTimer(){BWHeartbeat();if(BWPulse())BWEvaluate();}
void OnTick(){BWManageCut();}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){
 if(id==CHARTEVENT_OBJECT_CLICK&&s==gButton){gAuto=!gAuto;BWPaint();BWNotice("AUTOPILOT",gAuto?"ON":"OFF",InpSymbol,gTester,gAuto);}
}
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result){
 BWTradeTransaction(trans,InpSymbol,InpMagic,gTester,gAuto);
}
