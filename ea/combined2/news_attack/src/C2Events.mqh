// EA lifecycle. Reuses the original price core, risk checks, Astrology and instance lock.
int OnInit() {
 gTester=(bool)MQLInfoInteger(MQL_TESTER);gAuto=InpAutopilot;
 if(_Symbol!=InpSymbol){Print("Pasang neng chart ",InpSymbol,". Normal default M5; News M1 + M5.");return INIT_PARAMETERS_INCORRECT;}
 if(InpMagic==0||InpFixedLot<=0||!Fin(InpFixedLot)||(InpExecutionTF!=PERIOD_M1&&InpExecutionTF!=PERIOD_M5&&InpExecutionTF!=PERIOD_M15)||InpExecutionBars<100||InpExecutionBars>2000||InpContextBars<30||InpContextBars>1000||InpMonthlyBars<30||InpMonthlyBars>500||InpMaxSpreadPoints<0||InpDeviationPoints<0||!Fin(InpMaxTradeRiskPct)||InpMaxTradeRiskPct<0||!Fin(InpMinRR)||InpMinRR<0||!Fin(InpMaxDriftR)||InpMaxDriftR<=0||InpMaxEntryDelaySeconds<1||InpMaxEntryDelaySeconds>60||MathAbs(InpServerUTCMinutes)>840||InpHTTPTimeoutMs<500||InpHTTPTimeoutMs>10000||!ValidateNewsInputs())return INIT_PARAMETERS_INCORRECT;
 if(!SymbolSelect(InpSymbol,true))return INIT_FAILED;gDigits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
 // Same scope as baseline: do NOT run baseline and this EA concurrently on the same symbol/magic.
 gScope="C2."+StringFormat("%08X",Hash(AccountInfoString(ACCOUNT_SERVER)+":"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+":"+(string)InpMagic+":"+InpSymbol))+".";
 gButton="CEBONK_C2_AUTOPILOT_"+(string)InpMagic;
 if(!gTester){gLock=FileOpen(gScope+"LOCK.bin",FILE_READ|FILE_WRITE|FILE_BIN|FILE_COMMON);if(gLock==INVALID_HANDLE){Print("C2 another instance holds exclusive lock. Close old C2 first.");return INIT_FAILED;}}
 if(gTester||InpAstroSource==C2_ASTRO_LOCAL_CSV){if(!LocalSchedule()){Print(gScheduleError);return INIT_FAILED;}}
 else if(StringFind(InpAstroBaseURL,"https://")!=0){Print("HTTPS AstroBaseURL required");return INIT_PARAMETERS_INCORRECT;}
 if(gTester&&NewsEnabled()){
  if(InpNewsSource!=C2_NEWS_LOCAL_CSV){Print("Tester NEWS needs InpNewsSource=C2_NEWS_LOCAL_CSV and an exported calendar CSV. Native calendar unavailable in tester.");return INIT_PARAMETERS_INCORRECT;}
  if(!NewsCSV()){Print(gNewsError);return INIT_FAILED;}
 }
 gBar=(long)iTime(InpSymbol,InpExecutionTF,0);gNewsBar=(long)iTime(InpSymbol,PERIOD_M1,0);gArmedAt=(long)TimeCurrent();
 if(ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0)){
  ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_LEFT_UPPER);ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,10);ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,15);ObjectSetInteger(0,gButton,OBJPROP_XSIZE,155);ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);Paint();
 }
 if(!gTester)EventSetTimer(1);
 string run=InpRunMode==C2_NORMAL_ONLY?"NORMAL ONLY":InpRunMode==C2_NEWS_ONLY?"NEWS ONLY":"NORMAL + NEWS ATTACK";
 Notice("EA_STARTED","Mode: "+run+"\nNormal: "+TFName()+" | News: M1 trigger + M5 konfirmasi\n"+
 "Lot: "+DoubleToString(InpFixedLot,2)+" | spread max: "+(string)InpMaxSpreadPoints+" points\n"+
 "News lock: T-"+(string)InpNewsPreBlockMinutes+" nganti T+"+(string)InpNewsStartAfterMinutes+" menit\n"+
 "Attack: T+"+(string)InpNewsStartAfterMinutes+" nganti T+"+(string)InpNewsEndAfterMinutes+" menit\n"+
 "Astrology tetep arah + jam. FRESH utama, TESTED 1x oleh. Ora martingale/BE/trailing/partial.","SYSTEM");
 if(!InpAcceptExperimentalAstro)Block("SET InpAcceptExperimentalAstro=true ONLY FOR DELIBERATE TESTING");
 if(InpTelegramTestOnStart)Notice("TELEGRAM_TEST","Tes notifikasi COMBINED 2 NEWS ATTACK. Iki ora mbukak order.","SYSTEM");
 // External operations run only in OnTimer; first retest before attach/arm never replayed.
 return INIT_SUCCEEDED;
}
void OnTick() {
 MqlTick tick;if(!SymbolInfoTick(InpSymbol,tick)||tick.bid<=0||tick.ask<tick.bid)return;
 if(!gTester&&MathAbs((double)((long)TimeTradeServer()-(long)tick.time))>15){Block("BROKER_TICK_STALE");return;}
 NewsHeartbeat();EvaluateBar();Paint();
}
void OnTimer() {
 if(NetworkSlot()){PollAstrology();PollNews();FlushNotice();}
 NewsHeartbeat();Paint();
}
void OnChartEvent(const int id,const long &lp,const double &dp,const string &sp) {
 if(id==CHARTEVENT_OBJECT_CLICK&&sp==gButton){
  gAuto=!gAuto;gArmedAt=(long)TimeCurrent();Paint();
  Notice("AUTOPILOT",gAuto?"ON. Mung retest anyar sawise diaktifke lan kabeh syarat lolos.":"OFF. Sinyal tetep dipantau; ora ana order anyar. SL/TP posisi lawas tetep.","SYSTEM");
 }
}
string DealMode(const ulong order,const ulong position) {
 string note="";if(order>0&&HistoryOrderSelect(order))note=HistoryOrderGetString(order,ORDER_COMMENT);
 if(StringFind(note,"C2N-")==0)return ModeName(true);
 if(StringFind(note,"C2M-")==0)return ModeName(false);
 string key=gScope+"POSMODE."+(string)position;
 if(!gTester&&GlobalVariableCheck(key))return ModeName(GlobalVariableGet(key)>0);
 if(gHaveSent&&order==gSentOrder)return ModeName(gSentIsNews);
 return "OWN POSITION | MODE NOT RECOVERED";
}
void OnTradeTransaction(const MqlTradeTransaction &tr,const MqlTradeRequest &request,const MqlTradeResult &result) {
 if(tr.type!=TRADE_TRANSACTION_DEAL_ADD||tr.deal==0||!HistoryDealSelect(tr.deal)||HistoryDealGetString(tr.deal,DEAL_SYMBOL)!=InpSymbol)return;
 long entry=HistoryDealGetInteger(tr.deal,DEAL_ENTRY);ulong magic=(ulong)HistoryDealGetInteger(tr.deal,DEAL_MAGIC),pos=(ulong)HistoryDealGetInteger(tr.deal,DEAL_POSITION_ID),order=(ulong)HistoryDealGetInteger(tr.deal,DEAL_ORDER);
 double price=HistoryDealGetDouble(tr.deal,DEAL_PRICE),lot=HistoryDealGetDouble(tr.deal,DEAL_VOLUME);int dir=HistoryDealGetInteger(tr.deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1;
 if(entry==DEAL_ENTRY_IN&&magic==InpMagic){
  bool matched=gHaveSent&&gSentOrder>0&&order==gSentOrder;string mode=DealMode(order,pos);
  double sl=0,tp=0;if(matched){sl=gSentSL;tp=gSentTP;}
  else if(HistoryOrderSelect(order)){sl=HistoryOrderGetDouble(order,ORDER_SL);tp=HistoryOrderGetDouble(order,ORDER_TP);}
  bool news=StringFind(mode,"NEWS ATTACK")==0;
  if(!gTester){GlobalVariableSet(gScope+"POSMODE."+(string)pos,news?1.0:0.0);GlobalVariablesFlush();}
  double risk=dir*(price-sl),reward=dir*(tp-price);
  string info=Side(dir)+" WIS MLEBU\nDeal: "+(string)tr.deal+" | posisi: "+(string)pos+"\n";
  if(matched&&news)info+="News: "+gSentNewsName+"\nRelease: "+WIB(gSentRelease)+"\n";
  info+="Fill nyata: "+Price(price)+"\nLot: "+DoubleToString(lot,3)+"\nSL: "+(sl>0?Price(sl):"cek terminal")+"\nTP dipilih: "+(tp>0?Price(tp):"cek terminal");
  if(matched)info+="\nTP1 1.618: "+Price(gSent.tp1)+"\nTP2 2.618: "+Price(gSent.tp2)+"\nTP3 4.23: "+Price(gSent.tp3)+
   "\nRR fill: "+(risk>0&&reward>0?DoubleToString(reward/risk,2):"cek terminal")+"\nSlippage arah rugi: "+DoubleToString(dir*(price-gSentQuote)/SymbolInfoDouble(InpSymbol,SYMBOL_POINT),1)+" points"+
   "\nLokasi: "+gTFNames[gSentZone.tf]+" "+ZoneKind(gSentZone)+" "+ZoneStatus(gSentZone);
  Notice("ENTRY_FILLED",info,mode);return;
 }
 if(entry!=DEAL_ENTRY_OUT&&entry!=DEAL_ENTRY_OUT_BY)return;
 long reason=HistoryDealGetInteger(tr.deal,DEAL_REASON);if(!HistorySelectByPosition(pos))return;
 bool ours=false;double net=0;int initialSide=0;ulong originalOrder=0;
 for(int i=0;i<HistoryDealsTotal();i++){ulong d=HistoryDealGetTicket(i);if(d==0)continue;
  if(HistoryDealGetInteger(d,DEAL_ENTRY)==DEAL_ENTRY_IN&&(ulong)HistoryDealGetInteger(d,DEAL_MAGIC)==InpMagic){ours=true;initialSide=HistoryDealGetInteger(d,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1;originalOrder=(ulong)HistoryDealGetInteger(d,DEAL_ORDER);}
  net+=HistoryDealGetDouble(d,DEAL_PROFIT)+HistoryDealGetDouble(d,DEAL_SWAP)+HistoryDealGetDouble(d,DEAL_COMMISSION)+HistoryDealGetDouble(d,DEAL_FEE);
 }
 if(!ours)return;bool stillOpen=false;
 for(int i=PositionsTotal()-1;i>=0;i--)if(PositionGetTicket(i)>0&&(ulong)PositionGetInteger(POSITION_IDENTIFIER)==pos)stillOpen=true;
 string why=reason==DEAL_REASON_TP?"TP":reason==DEAL_REASON_SL?"SL":"OTHER_"+(string)reason;
 Notice(stillOpen?"EXIT_DEAL_PARTIAL":"POSITION_CLOSED","Arah: "+Side(initialSide)+"\nPosisi: "+(string)pos+"\nExit: "+Price(price)+"\nAlasan: "+why+"\nNet posisi s.d. saiki: "+DoubleToString(net,2)+" "+AccountInfoString(ACCOUNT_CURRENCY)+"\nKalebu commission/fee/swap sing dicatat broker ing deal posisi iki.",DealMode(originalOrder,pos));
}
void OnDeinit(const int reason) {EventKillTimer();ObjectDelete(0,gButton);if(gLock!=INVALID_HANDLE){FileClose(gLock);gLock=INVALID_HANDLE;}}
