// One execution path for NORMAL and NEWS; never double-send the same signal.
string SignalKey(const C2Event &s,const ENUM_TIMEFRAMES tf) {
 return gScope+(string)tf+"."+(string)s.dir+"."+(string)s.ib+"."+(string)s.eventStart;
}
string SignalText(const C2Event &s,const C2Astro &a,const C2Zone &z,const string coverage,
 const bool news,const long release,const C2Event &confirm) {
 string text=Side(s.dir)+" SELARAS\n";
 if(news)text+="News: "+NewsNames(release)+"\nRelease: "+WIB(release)+"\nAttack: "+WIB(release+NewsDelay())+" -> "+WIB(release+NewsFinish())+"\n";
 text+="Astrology: "+Side(a.dir)+" | "+WIB(a.from)+" -> "+WIB(a.to)+"\n"+
 "Lokasi: "+gTFNames[z.tf]+" "+ZoneKind(z)+" "+ZoneStatus(z)+" | tested "+(string)z.tests+"x\n"+
 "Area: "+Price(z.low)+" - "+Price(z.high)+"\n";
 if(news)text+="M5: IB + CB1 break "+Side(confirm.dir)+" terkonfirmasi\nM1: CB1 break pasca-release + retest anyar\n";
 else text+="Musang "+TFName()+": IB -> CB1 break -> retest\n";
 text+="CB1: "+Price(s.cb)+"\nZone IB: "+Price(s.low)+" - "+Price(s.high)+"\nRetest acuan: "+Price(s.entry)+
 "\nSL struktur: "+Price(s.sl)+"\nTP1 1.618: "+Price(s.tp1)+"\nTP2 2.618: "+Price(s.tp2)+"\nTP3 4.23: "+Price(s.tp3)+
 "\n"+coverage+"\nSinyal dudu bukti order keisi.";
 return text;
}
void EvaluateMode(const bool news) {
 ENUM_TIMEFRAMES tf=news?PERIOD_M1:InpExecutionTF;
 long bar=(long)iTime(InpSymbol,tf,0);if(bar<=0)return;
 if(news){if(bar==gNewsBar)return;gNewsBar=bar;}else{if(bar==gBar)return;gBar=bar;}
 int selected=-1;
 if(NewsEnabled()){
  int phase=NewsRoute(NowUTC(),selected);
  if((news&&phase!=C2_NEWS_ATTACK)||(!news&&phase!=C2_NEWS_NORMAL)){
   Block(phase==C2_NEWS_DATA_WAIT?"NEWS_DATA_WAIT_FAIL_CLOSED":news?"NEWS_WAIT_ATTACK_WINDOW":"NORMAL_PAUSED_FOR_NEWS");return;
  }
 }
 C2Bar bars[];if(!LoadBars(tf,InpExecutionBars,bar,bars)){Block("EXECUTION_HISTORY_NOT_READY");return;}
 int n=ArraySize(bars),seconds=PeriodSeconds(tf);long now=(long)TimeCurrent();
 if(bars[n-1].end!=bar||now-bar>InpMaxEntryDelaySeconds){Block("STALE_OR_LATE_NEW_BAR");return;}
 C2Event s;C2Musang(bars,seconds,now,s);
 if(s.stage!=C2_VALID){Block((news?"NEWS_":"NORMAL_")+"MUSANG_WAIT_STAGE_"+(string)s.stage);return;}
 if(s.eventStart<gArmedAt){Block("PRE_ATTACH_OR_PRE_ARM_RETEST_SKIPPED");return;}
 string id=SignalKey(s,tf);if(!gTester&&GlobalVariableCheck(id)){Block("SIGNAL_ALREADY_CONSUMED");return;}
 if(!gTester){GlobalVariableSet(id,(double)now);GlobalVariablesFlush();}
 C2Astro a;if(!AstrologyMatches(s,a))return;
 long release;if(!NewsGate(news,s,release))return;
 C2Event confirm;ZeroMemory(confirm);if(news&&!NewsM5Confirm(s,confirm))return;
 C2Zone zone;C2Rank rank;string coverage;if(!Location(s,zone,rank,coverage))return;
 Notice("SIGNAL_VALID",SignalText(s,a,zone,coverage,news,release,confirm),ModeName(news));
 if(!gAuto){Block("AUTOPILOT_OFF_SIGNAL_ONLY");return;}
 MqlTradeRequest req;string why;if(!Prepare(s,req,why)){Notice("ENTRY_BLOCKED",why,ModeName(news));Block(why);return;}
 long releaseAgain;
 if(!AstrologyMatches(s,a)||!NewsGate(news,s,releaseAgain)||(news&&releaseAgain!=release)||
   (long)TimeCurrent()-s.eventEnd>InpMaxEntryDelaySeconds){Notice("ENTRY_BLOCKED","WINDOW_EXPIRED_BEFORE_SEND",ModeName(news));return;}
 // Final stale-tick guard after expensive history/OrderCheck operations.
 MqlTick latest;if(!SymbolInfoTick(InpSymbol,latest)||(!gTester&&MathAbs((double)((long)TimeTradeServer()-(long)latest.time))>15)){
  Notice("ENTRY_BLOCKED","TICK_STALE_BEFORE_SEND",ModeName(news));return;
 }
 double finalPoint=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
 if(finalPoint<=0||(latest.ask-latest.bid)/finalPoint>InpMaxSpreadPoints){Notice("ENTRY_BLOCKED","SPREAD_CHANGED_BEFORE_SEND",ModeName(news));return;}
 double finalQuote=s.dir==1?latest.ask:latest.bid;
 if(MathAbs(finalQuote-req.price)>InpDeviationPoints*finalPoint){Notice("ENTRY_BLOCKED","QUOTE_CHANGED_BEFORE_SEND_NO_CHASE",ModeName(news));return;}
 req.comment=(news?"C2N-":"C2M-")+Side(s.dir)+"-"+StringFormat("%08X",Hash(id));
 if(news)ReserveNews(release);
 gSent=s;gSentZone=zone;gSentSL=req.sl;gSentTP=req.tp;gHaveSent=true;
 gSentIsNews=news;gSentRelease=release;gSentNewsName=news?NewsNames(release):"";gSentQuote=req.price;gSentOrder=0;
 MqlTradeResult result={};bool sent=OrderSend(req,result);gSentOrder=result.order;
 if(sent&&(result.retcode==TRADE_RETCODE_DONE||result.retcode==TRADE_RETCODE_DONE_PARTIAL||result.retcode==TRADE_RETCODE_PLACED)){
  Audit("ORDER_ACCEPTED",ModeName(news)+" | order="+(string)result.order+" retcode="+(string)result.retcode+"; awaiting actual deal");gLastBlock="";
 }else{
  Notice("ORDER_REJECTED","retcode="+(string)result.retcode+"\nOra retry sinyal/event sing padha.",ModeName(news));
  if(result.retcode==TRADE_RETCODE_TIMEOUT||result.retcode==TRADE_RETCODE_CONNECTION){gAuto=false;Block("EXECUTION_UNCERTAIN_AUTOPILOT_OFF_CHECK_POSITIONS");}
  else gHaveSent=false;
 }
}
void EvaluateBar() {
 if(InpRunMode!=C2_NORMAL_ONLY)EvaluateMode(true);
 if(InpRunMode!=C2_NEWS_ONLY)EvaluateMode(false);
}
