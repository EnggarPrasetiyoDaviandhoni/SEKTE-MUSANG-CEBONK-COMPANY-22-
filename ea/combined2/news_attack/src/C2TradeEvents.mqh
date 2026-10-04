void OnTradeTransaction(const MqlTradeTransaction &tr,const MqlTradeRequest &request,const MqlTradeResult &result) {
 if(tr.type!=TRADE_TRANSACTION_DEAL_ADD||tr.deal==0||!HistoryDealSelect(tr.deal)||HistoryDealGetString(tr.deal,DEAL_SYMBOL)!=InpSymbol)return;
 long entry=HistoryDealGetInteger(tr.deal,DEAL_ENTRY);ulong magic=(ulong)HistoryDealGetInteger(tr.deal,DEAL_MAGIC),pos=(ulong)HistoryDealGetInteger(tr.deal,DEAL_POSITION_ID);
 double price=HistoryDealGetDouble(tr.deal,DEAL_PRICE),lot=HistoryDealGetDouble(tr.deal,DEAL_VOLUME);int dir=HistoryDealGetInteger(tr.deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1;
 string posKey=gScope+"POS."+(string)pos+".NEWS";
 if(entry==DEAL_ENTRY_IN&&magic==InpMagic){
  bool matched=gHaveSent&&(gSentOrder==0||tr.order==gSentOrder);
  bool news=matched?gSentIsNews:StringFind(HistoryDealGetString(tr.deal,DEAL_COMMENT),"C2N-")==0;
  long release=matched?gSentRelease:0;if(!gTester&&news&&release>0)GlobalVariableSet(posKey,(double)release);
  double sl=matched?gSentSL:0,tp=matched?gSentTP:0;
  if(!matched)for(int i=PositionsTotal()-1;i>=0;i--)if(PositionGetTicket(i)>0&&(ulong)PositionGetInteger(POSITION_IDENTIFIER)==pos){sl=PositionGetDouble(POSITION_SL);tp=PositionGetDouble(POSITION_TP);break;}
  double risk=dir*(price-sl),reward=dir*(tp-price);
  string info=Side(dir)+" WIS MLEBU\n";
  if(news&&matched)info+="News: "+gSentNewsName+"\nRelease: "+WIB(release)+"\n";
  info+="Deal: "+(string)tr.deal+" | posisi: "+(string)pos+"\nFill nyata: "+Price(price)+"\nLot: "+DoubleToString(lot,3)+
   "\nSL: "+(sl>0?Price(sl):"cek terminal")+"\nTP dipilih: "+(tp>0?Price(tp):"cek terminal");
  if(matched){
   double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
   info+="\nTP1 1.618: "+Price(gSent.tp1)+"\nTP2 2.618: "+Price(gSent.tp2)+"\nTP3 4.23: "+Price(gSent.tp3)+
    "\nRR fill: "+(risk>0&&reward>0?"1:"+DoubleToString(reward/risk,2):"invalid")+
    "\nLokasi: "+gTFNames[gSentZone.tf]+" "+ZoneKind(gSentZone)+" "+ZoneStatus(gSentZone);
   if(point>0)info+="\nSlippage vs request: "+DoubleToString(dir*(price-gSentQuote)/point,1)+" points (+ = luwih elek)";
  }
  Notice("ENTRY_FILLED",info,ModeName(news));return;
 }
 if(entry!=DEAL_ENTRY_OUT&&entry!=DEAL_ENTRY_OUT_BY)return;
 long reason=HistoryDealGetInteger(tr.deal,DEAL_REASON);if(!HistorySelectByPosition(pos))return;
 bool ours=false,news=false;double net=0;int initialSide=0;
 for(int i=0;i<HistoryDealsTotal();i++){ulong d=HistoryDealGetTicket(i);if(d==0)continue;
  if(HistoryDealGetInteger(d,DEAL_ENTRY)==DEAL_ENTRY_IN&&(ulong)HistoryDealGetInteger(d,DEAL_MAGIC)==InpMagic){
   ours=true;initialSide=HistoryDealGetInteger(d,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1;
   if(StringFind(HistoryDealGetString(d,DEAL_COMMENT),"C2N-")==0)news=true;
  }
  net+=HistoryDealGetDouble(d,DEAL_PROFIT)+HistoryDealGetDouble(d,DEAL_SWAP)+HistoryDealGetDouble(d,DEAL_COMMISSION)+HistoryDealGetDouble(d,DEAL_FEE);
 }
 if(!ours)return;bool stillOpen=false;
 for(int i=PositionsTotal()-1;i>=0;i--)if(PositionGetTicket(i)>0&&(ulong)PositionGetInteger(POSITION_IDENTIFIER)==pos)stillOpen=true;
 long release=0;if(!gTester&&GlobalVariableCheck(posKey)){news=true;release=(long)GlobalVariableGet(posKey);}
 string why=reason==DEAL_REASON_TP?"TP":reason==DEAL_REASON_SL?"SL":"OTHER_"+(string)reason;
 string text="Arah: "+Side(initialSide)+"\nPosisi: "+(string)pos+"\nExit: "+Price(price)+"\nAlasan: "+why+
  "\nNet posisi: "+DoubleToString(net,2)+" "+AccountInfoString(ACCOUNT_CURRENCY)+
  "\nKalebu fee, commission, swap sing broker catat ing deal posisi iki.";
 if(news&&release>0)text+="\nRelease news: "+WIB(release);
 Notice(stillOpen?"EXIT_DEAL_PARTIAL":"POSITION_CLOSED",text,ModeName(news));
}
