#property strict
#property version "1.09"
#property description "CEBONK XAUUSD Swing: original Astro feed + H4/H1/M15 + M5 Musang Berjanggut CBR"
#property tester_file "swing-forecast-v2.history.jsonl"
#property tester_file "cebonk-broker-offsets.csv"
#include <CebonkSwing/MarketData.mqh>
#include <CebonkSwing/FeedClient.mqh>
#include <CebonkSwing/BasketManager.mqh>
#include <CebonkSwing/ChartPanel.mqh>

input string InpSymbol="";
input long InpMagic=52251017;
input double InpLotPerLayer=0.01;
input double InpMaxBasketRiskPct=1.0;
input double InpSLFibLevel=-0.236; // Negative Fibonacci extension; applies to new baskets only.
input double InpCommissionPerLotPerSide=-1.0; // Required: actual account currency per lot, 0 only if commission-free.
input uint InpMaxSlippagePoints=30;
input string InpFeedURL="https://EnggarPrasetiyoDaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/data/ea/swing-forecast-v2.json";
input bool InpSydney=true;
input bool InpTokyo=true;
input bool InpLondonOpen=true;
input bool InpNewYork=true;
input bool InpLondonClose=true;
input bool InpStrictIPDA_PDFilter=false;
input double InpMoonMajorPhaseWindowHours=0; // 0=annotation only; optional research veto, no direction or sizing.
input int InpM5DominantMinInside=3; // Engineering definition; the PDF has no numeric child-count rule.
input int InpM5DominantMaxInside=12;
input int InpM5SnRLookback=96;
input int InpM5MaxBarsGateToBreak=16;
input int InpM5MaxBarsBreakToRetest=12;
input bool InpCutProfitEnabled=true;
input bool InpManageExitWhenAutopilotOff=true;
input int InpTesterUtcOffsetMinutes=2147483647; // Unknown: use verified historical CSV, or supply fixed offset for a fixed-offset test range.
input string InpTesterOffsetFile="cebonk-broker-offsets.csv";
input string InpTesterFeedFile="swing-forecast-v2.history.jsonl";
input bool InpTesterAutopilot=false; // Tester only; never arms a live account.
input bool InpTelegramEnabled=false;
input string InpTelegramBotToken=""; // Local inputs only; never commit .set files containing secrets.
input string InpTelegramChatId="";
input bool InpPushEnabled=false;

CSClock Clock;CSFeed Feed;CSFeedClient FeedClient;CSMarket Market;CSBasket Basket;CSNotifier Notify;CSPanel Panel;
string TradeSymbol,LastReason="STARTING",LockKey,HeartbeatKey;double LockOwner=0;bool Autopilot=false,Dirty=true,HasLock=false,StateReady=false;
int LockFile=INVALID_HANDLE;
datetime LastM5Open=0;string LastFeedHash="",LastWeek="",LastDay="";
bool SessionEnabled(string id){return id=="sydney"?InpSydney:id=="tokyo"?InpTokyo:id=="london"?InpLondonOpen:id=="newyork"?InpNewYork:InpLondonClose;}
void Reason(string value){if(value!=LastReason){Print("CEBONK ",value);LastReason=value;}}
bool AcquireLock(){
 if(Clock.Tester())return true;
 LockFile=FileOpen(LockKey+".lck",FILE_READ|FILE_WRITE|FILE_BIN|FILE_COMMON);
 if(LockFile==INVALID_HANDLE)return false; // No sharing flags: also excludes other local terminal processes.
 GlobalVariableTemp(LockKey);double previous=GlobalVariableGet(LockKey);
 if(previous!=0&&GlobalVariableCheck(HeartbeatKey)&&TimeLocal()-(datetime)GlobalVariableGet(HeartbeatKey)>120)GlobalVariableSetOnCondition(LockKey,0,previous);
 if(!GlobalVariableSetOnCondition(LockKey,LockOwner,0)){FileClose(LockFile);LockFile=INVALID_HANDLE;return false;}GlobalVariableSet(HeartbeatKey,(double)TimeLocal());return true;
}
bool CheckLock(){
 if(Clock.Tester())return true;if(!GlobalVariableCheck(LockKey)||GlobalVariableGet(LockKey)!=LockOwner){Autopilot=false;HasLock=false;Reason("INSTANCE_LOCK_LOST");return false;}
 GlobalVariableSet(HeartbeatKey,(double)TimeLocal());return true;
}
void ProtectBasket(){
 if(!HasLock)return;
 if(Dirty){Basket.Reconcile(Notify);Basket.state.Save();Dirty=false;}
 if(Basket.positions>0){CSBar bars[];if(Market.Copy(TradeSymbol,PERIOD_M15,32,5,bars))
  Basket.ManageExit(bars,InpCutProfitEnabled&&(Autopilot||InpManageExitWhenAutopilotOff),Notify);}
}
void Entry(){
 datetime now=Clock.Now();if(!Autopilot){Reason("AUTOPILOT_OFF");return;}
 if(now<=0){Reason("CLOCK_UNVERIFIED");return;}if(!Feed.Valid(now)){Reason(Feed.error);return;}
 int owner=Feed.Owner(now);if(owner<0){Reason("SKIP_ASTRO_ALIGNMENT_OR_WINDOW");return;}
 CSSession session=Feed.sessions[owner];if(!SessionEnabled(session.sessionId)){Reason("SESSION_DISABLED");return;}
 if(Basket.conflict||Basket.state.pending||Basket.state.exitPending){Reason("BASKET_BLOCKED");return;}
 if(Basket.positions==0&&Basket.GlobalBusy()){Reason("ONE_GLOBAL_BASKET");return;}
 bool core=now>=session.core;string window=session.id+"|"+IntegerToString((long)session.windowStart)+"|"+IntegerToString((long)session.windowEnd);
 if(Basket.positions==0&&Basket.state.Contains(Basket.state.spent,window)){Reason("WINDOW_ALREADY_SPENT");return;}
 if(Basket.positions>0&&(Basket.state.window!=window||!core||Basket.state.inti>=2||Basket.state.awal==0||Basket.state.recovered)){Reason("BASKET_ACTIVE_NO_NEW_LAYERS");return;}
 if(InpMoonMajorPhaseWindowHours>0){double nearest=1e20;for(int i=0;i<ArraySize(Feed.majorEvents);i++)nearest=CSMin(nearest,MathAbs((double)(now-Feed.majorEvents[i])));
  if(nearest>InpMoonMajorPhaseWindowHours*3600){Reason("SKIP_MOON_RESEARCH_WINDOW");return;}}
 if(!Market.Load(TradeSymbol)){Reason(Market.error);return;}Market.Build(Feed,Clock);
 int side=session.direction;MqlTick quote;if(!SymbolInfoTick(TradeSymbol,quote)){Reason("QUOTE_NOT_READY");return;}
 if(Market.h4State==-2||(Market.h4State!=0&&Market.h4State!=side)){Reason("SKIP_H4_OPPOSED_OR_NOT_READY");return;}
 if(InpStrictIPDA_PDFilter){double eq=(Market.ipdaHigh[0]+Market.ipdaLow[0])/2,mid=(quote.ask+quote.bid)/2;
  if(side>0?mid>=eq-Market.tick:mid<=eq+Market.tick){Reason("SKIP_IPDA_RESEARCH_PD_FILTER");return;}}
 CSSetup setups[];CSH1Setups(Market.h1,Market.levels,side,Market.h4State,Market.tick,quote.ask-quote.bid,TimeCurrent(),setups);
 datetime start=Clock.ToServer(session.windowStart),end=Clock.ToServer(session.windowEnd);if(start<=0||end<=start){Reason("CLOCK_WINDOW_UNVERIFIED");return;}
 string failure="WAIT_H1_SWEEP_MSS_OR_BOS";
 for(int i=0;i<ArraySize(setups);i++){
  CSSetup setup=setups[i];datetime gate=CSM15Gate(Market.m15,setup,start,end);if(gate==0){failure="WAIT_M15_FRESH_RETEST";continue;}
  CSMicro micro;if(!CSM5CBR(Market.m5,side,gate,end,Market.tick,InpM5DominantMinInside,InpM5DominantMaxInside,InpM5SnRLookback,InpM5MaxBarsGateToBreak,InpM5MaxBarsBreakToRetest,InpSLFibLevel,micro)){failure="WAIT_M5_BERJANGGUT_BREAK_AND_IB_RETEST";continue;}
  if(micro.retestClose>TimeCurrent()||TimeCurrent()-micro.retestClose>30){failure="SKIP_NOT_FIRST_RETEST_TICK";continue;}
  double entry=side>0?quote.ask:quote.bid,tp=0;uint kind=0;string why="";
  double sl=Basket.positions>0?Basket.state.sl:micro.sl;
  if(Basket.positions>0)tp=Basket.state.tp;else if(!Market.Target(side,entry,sl,2,tp,kind,why)){failure=why;continue;}
  string signal=CSHash16(TradeSymbol+"|"+IntegerToString(InpMagic)+"|"+Feed.source+"|"+window+"|"+
   IntegerToString(setup.model)+"|"+IntegerToString((long)setup.origin)+"|"+IntegerToString((long)setup.structure)+"|"+IntegerToString((long)setup.birth)+"|"+
   IntegerToString((long)gate)+"|"+IntegerToString((long)micro.source)+"|"+IntegerToString((long)micro.breakClose)+"|"+IntegerToString((long)micro.retestClose));
  if(signal==""){failure="SIGNAL_HASH_FAILED";continue;}
  int day=Feed.DayIndex(session.date);
  Notify.Add("SIGNAL_"+signal,StringFormat("CEBONK %s %s | WEEK/DAY/SESSION aligned | H1 model %d, M15 retest, M5 %s + IB retest | candidate fib0 %.5f fib1 %.5f | order SL FIB %.5f TP ICT %.5f RR %.2f | moon rank %d (annotation)",TradeSymbol,session.sessionId,setup.model,micro.kind==1?"dominant break":"nearest SnR break",micro.fib0,micro.fib1,sl,tp,CSRR(side,entry,sl,tp),day<0?0:Feed.days[day].rank));
  PrintFormat("CEBONK M5 CBR kind=%d source=%I64d break=%I64d retest=%I64d IB=[%.8f,%.8f] fib0=%.8f fib1=%.8f span=%.8f candidate_SL_level=%.8f candidate_SL_raw=%.8f order_SL=%.8f TP_ICT=%.8f target_mask=%u RR=%.3f",micro.kind,(long)micro.source,(long)micro.breakClose,(long)micro.retestClose,micro.zoneLow,micro.zoneHigh,micro.fib0,micro.fib1,micro.fib1-micro.fib0,InpSLFibLevel,micro.slRaw,sl,tp,kind,CSRR(side,entry,sl,tp));
  // Recheck UTC/window immediately before execution; source/feed can expire while evaluating.
  now=Clock.Now();if(!Feed.Valid(now)||now<session.windowStart||now>=session.windowEnd){failure="SKIP_WINDOW_OR_FEED_EXPIRED";break;}
  core=now>=session.core;datetime phaseEnd=core?session.windowEnd:session.core;
  datetime deadline=TimeCurrent()+(datetime)CSMin(phaseEnd-now,Feed.expires-now);
  bool sent=Basket.Submit(window,core,signal,setup,gate,micro,tp,deadline,Notify);failure=Basket.error;Dirty=true;
  if(!sent)Notify.Add("ENTRY_BLOCKED_"+signal+"_"+failure,"CEBONK entry blocked: "+failure);
  if(sent||Basket.state.Contains(Basket.state.signals,signal))break;
 }
 Reason(failure);
}
void Draw(){
 string rows[];ArrayResize(rows,22);datetime now=Clock.Now();
 rows[0]="CEBONK SWING v1.09 | "+TradeSymbol+" | M5 MUSANG BERJANGGUT CBR";
 rows[1]="UTC "+TimeToString(now,TIME_DATE|TIME_SECONDS)+" | WIB "+TimeToString(now+25200,TIME_DATE|TIME_SECONDS);
 rows[2]="Broker "+TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS)+" | "+Clock.error;
 rows[3]="Feed "+Feed.error+" | age "+IntegerToString(now>0?(long)(now-Feed.generated):0)+" s";
 int day=Feed.DayIndex(CSDate(now+25200));rows[4]=day<0?"WEEK / DAY: WAIT":StringFormat("WEEK=%d DAY=%d | moon rank=%d/5 illumination=%.2f%%",Feed.days[day].weekly,Feed.days[day].daily,Feed.days[day].rank,Feed.days[day].illumination);
 rows[5]="Moon: no accepted observation";for(int i=ArraySize(Feed.moon)-1;i>=0;i--)if(Feed.moon[i].observed<=now){rows[5]=Feed.moon[i].phase+" "+DoubleToString(Feed.moon[i].illumination,2)+"% observed UTC "+TimeToString(Feed.moon[i].observed,TIME_DATE|TIME_MINUTES);break;}
 for(int k=0;k<5;k++){rows[6+k]="Session "+IntegerToString(k)+": WAIT";for(int i=0;i<ArraySize(Feed.sessions);i++){
  CSSession s=Feed.sessions[i];if(CSSessionIndex(s.sessionId)==k&&s.date==CSDate(now+25200)){
   rows[6+k]=s.sessionId+" "+s.zone+" dir="+IntegerToString(s.direction)+(s.direction==0?" WAIT":" UTC "+TimeToString(s.windowStart,TIME_MINUTES)+" / "+TimeToString(s.core,TIME_MINUTES)+" / "+TimeToString(s.windowEnd,TIME_MINUTES));break;
  }}}
 rows[11]="IPDA D1 20 H/L "+DoubleToString(Market.ipdaHigh[0],3)+" / "+DoubleToString(Market.ipdaLow[0],3);
 rows[12]="IPDA D1 40 H/L "+DoubleToString(Market.ipdaHigh[1],3)+" / "+DoubleToString(Market.ipdaLow[1],3);
 rows[13]="IPDA D1 60 H/L "+DoubleToString(Market.ipdaHigh[2],3)+" / "+DoubleToString(Market.ipdaLow[2],3);
 rows[14]="H4 state="+IntegerToString(Market.h4State)+" | H1/M15/M5: "+LastReason;
 rows[15]="Basket "+Basket.state.basket+" positions="+IntegerToString(Basket.positions)+" layers="+IntegerToString(Basket.state.awal+Basket.state.inti)+"/4";
 rows[16]="New basket FIB "+DoubleToString(InpSLFibLevel,5)+" | Basket SL "+DoubleToString(Basket.state.sl,5)+" | TP ICT "+DoubleToString(Basket.state.tp,5);
 double net=0;bool verified=Basket.Net(net);rows[17]="Risk="+DoubleToString(Basket.lastRisk,3)+"% | NET="+(verified?DoubleToString(net,2):"UNVERIFIED");
 rows[18]="M15 exit "+Basket.error+" pending="+(Basket.state.exitPending?"YES":"NO");
 rows[19]="Telegram "+(InpTelegramEnabled?"ON":"OFF")+" | MT5 Push "+(InpPushEnabled?"ON":"OFF")+" | risk cap "+DoubleToString(InpMaxBasketRiskPct,2)+"%";
 rows[20]="5-day bias: ";if(day>=0)for(int i=0;i<ArraySize(Feed.days);i++)if(Feed.days[i].monday==Feed.days[day].monday)rows[20]+=Feed.days[i].date+":"+IntegerToString(Feed.days[i].daily)+" ";
 rows[21]="H1 source "+TimeToString(Basket.state.h1Origin,TIME_DATE|TIME_MINUTES)+" | M15 "+TimeToString(Basket.state.m15Retest,TIME_MINUTES)+" | IB "+TimeToString(Basket.state.m5Source,TIME_MINUTES);
 Panel.Draw(Autopilot,InpCutProfitEnabled&&InpManageExitWhenAutopilotOff,rows);
}
int OnInit(){
 TradeSymbol=InpSymbol==""?_Symbol:InpSymbol;
 if(!CSValidSLFibLevel(InpSLFibLevel)){Print("CEBONK InpSLFibLevel must be finite and negative, for example -0.236");return INIT_PARAMETERS_INCORRECT;}
 if(TradeSymbol!=_Symbol||StringFind(TradeSymbol,"XAUUSD")!=0||StringFind(InpFeedURL,"https://")!=0||InpMagic<=0||InpLotPerLayer<=0||InpMaxBasketRiskPct<=0||InpMaxBasketRiskPct>1||(InpCommissionPerLotPerSide<0&&InpCommissionPerLotPerSide!=-1)||
  InpM5DominantMinInside<1||InpM5DominantMaxInside>12||InpM5DominantMinInside>InpM5DominantMaxInside||InpM5SnRLookback<12||InpM5SnRLookback>256||
  InpM5MaxBarsGateToBreak<1||InpM5MaxBarsBreakToRetest<1||InpMoonMajorPhaseWindowHours<0)return INIT_PARAMETERS_INCORRECT;
 if(!SymbolSelect(TradeSymbol,true)||!Clock.Init(InpTesterUtcOffsetMinutes,InpTesterOffsetFile))return INIT_FAILED;
 LockKey="CSB_LOCK_"+IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))+"_"+IntegerToString(InpMagic);HeartbeatKey=LockKey+".HB";
 LockOwner=(double)(ChartID()%2147483647)*1000000+(double)(GetTickCount64()%1000000);HasLock=AcquireLock();if(!HasLock){Print("CEBONK one EA instance per account/magic is allowed");return INIT_FAILED;}
 string storage="CSB_"+IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))+"_"+IntegerToString(InpMagic)+"_"+CSHash16(TradeSymbol)+(Clock.Tester()?"_T"+IntegerToString(ChartID()):"");
 Basket.Init(TradeSymbol,InpMagic,InpCommissionPerLotPerSide,InpMaxBasketRiskPct,InpLotPerLayer,InpMaxSlippagePoints);
 if(!Basket.state.Init(storage+".json",TradeSymbol,InpMagic,Clock.Tester())){Print("CEBONK STATE_CORRUPT_OR_UNWRITABLE: ",storage);return INIT_FAILED;}
 StateReady=true;
 Notify.Init(InpPushEnabled,InpTelegramEnabled,InpTelegramBotToken,InpTelegramChatId,storage+".notices.json");Panel.Init();
 FeedClient.Init(InpFeedURL,InpTesterFeedFile,storage+"_feed.json");
 Autopilot=Clock.Tester()&&InpTesterAutopilot;LastM5Open=iTime(TradeSymbol,PERIOD_M5,0);Basket.Reconcile(Notify);
 if(!Basket.state.exitPending){datetime latest=iTime(TradeSymbol,PERIOD_M15,1);if(latest>0)Basket.state.lastM15=(datetime)CSMax(Basket.state.lastM15,latest+900);}
 Basket.state.Save();FeedClient.Poll(Clock.Now(),Feed);EventSetTimer(10);Draw();return INIT_SUCCEEDED;
}
void OnTick(){
 if(!HasLock||!CheckLock())return;ProtectBasket();datetime open=iTime(TradeSymbol,PERIOD_M5,0);
 if(open<=0)return;if(LastM5Open==0){LastM5Open=open;return;}if(open!=LastM5Open){LastM5Open=open;Dirty=true;ProtectBasket();Clock.Refresh();Entry();}
}
void OnTimer(){
 if(!HasLock||!CheckLock())return;Clock.Refresh();Dirty=true;ProtectBasket();FeedClient.Poll(Clock.Now(),Feed);
 if(Feed.healthy&&Feed.hash!=LastFeedHash){LastFeedHash=Feed.hash;Notify.Add("FEED_"+Feed.hash,"CEBONK accepted Astro feed; source "+Feed.source);}
 if(Feed.Valid(Clock.Now())){
  int d=Feed.DayIndex(CSDate(Clock.Now()+25200));if(d>=0){
   string week=Feed.days[d].monday+"_"+IntegerToString(Feed.days[d].weekly),day=Feed.days[d].date+"_"+IntegerToString(Feed.days[d].daily);
   if(week!=LastWeek){LastWeek=week;Notify.Add("WEEK_"+week,"CEBONK weekly bias "+week);}
   if(day!=LastDay){LastDay=day;Notify.Add("DAY_"+day,"CEBONK daily bias "+day);}
  }
  int owner=Feed.Owner(Clock.Now());if(owner>=0&&SessionEnabled(Feed.sessions[owner].sessionId))Notify.Add("WINDOW_READY_"+Feed.sessions[owner].windowId,"CEBONK window ready "+Feed.sessions[owner].sessionId+"; entry still requires H4/H1/M15/M5, SL/TP and risk checks");
 }
 Notify.Pump(TimeCurrent());Draw();
}
void OnTradeTransaction(const MqlTradeTransaction &transaction,const MqlTradeRequest &request,const MqlTradeResult &result){Dirty=true;}
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam){
 if(id!=CHARTEVENT_OBJECT_CLICK)return;
 if(Panel.Toggle(sparam)){Autopilot=!Autopilot;Notify.Add("AUTOPILOT_"+IntegerToString((long)TimeCurrent())+"_"+(Autopilot?"ON":"OFF"),Autopilot?"AUTOPILOT ON":"OFF ENTRIES / existing basket protection remains configured");Draw();}
 if(Panel.Test(sparam))Notify.Add("TEST_"+IntegerToString((long)TimeCurrent()),"CEBONK TEST NOTIFIKASI");
}
void OnDeinit(const int reason){
 EventKillTimer();Autopilot=false;FeedClient.Close();if(StateReady)Basket.state.Save();Panel.Remove();
 if(HasLock&&!Clock.Tester()){GlobalVariableSetOnCondition(LockKey,0,LockOwner);}HasLock=false;
 if(LockFile!=INVALID_HANDLE){FileClose(LockFile);LockFile=INVALID_HANDLE;}
}
double OnTester(){
 PrintFormat("CEBONK MT5 TESTER: trades=%.0f net=%.2f expected_payoff=%.4f profit_factor=%.4f max_equity_DD_pct=%.4f max_balance_DD_pct=%.4f",
  TesterStatistics(STAT_TRADES),TesterStatistics(STAT_PROFIT),TesterStatistics(STAT_EXPECTED_PAYOFF),TesterStatistics(STAT_PROFIT_FACTOR),TesterStatistics(STAT_EQUITY_DDREL_PERCENT),TesterStatistics(STAT_BALANCE_DDREL_PERCENT));
 return TesterStatistics(STAT_PROFIT_FACTOR);
}
