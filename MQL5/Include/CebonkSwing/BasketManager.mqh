#ifndef CEBONK_SWING_BASKET_MQH
#define CEBONK_SWING_BASKET_MQH
#include <Trade/Trade.mqh>
#include "Persistence.mqh"
#include "Notifier.mqh"
#include "NumericCore.mqh"
class CSBasket {
 private:
  CTrade m_trade;string m_symbol;long m_magic;double m_fee,m_risk,m_lot,m_tick;uint m_deviation;datetime m_lastClose;
  bool m_noticeAutopilot,m_noticeCutProfit;
  bool Netting(){return AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;}
  bool AllDealsOwned(long id){
   if(!HistorySelectByPosition(id))return false;
   for(int i=0;i<HistoryDealsTotal();i++){
    ulong d=HistoryDealGetTicket(i);long type=HistoryDealGetInteger(d,DEAL_TYPE);
    if((type==DEAL_TYPE_BUY||type==DEAL_TYPE_SELL)&&HistoryDealGetInteger(d,DEAL_MAGIC)!=m_magic)return false;
   }return true;
  }
  bool OwnSelected(){
   if(PositionGetString(POSITION_SYMBOL)!=m_symbol||PositionGetInteger(POSITION_MAGIC)!=m_magic)return false;
   long id=PositionGetInteger(POSITION_IDENTIFIER);string comment=PositionGetString(POSITION_COMMENT);
   if(!state.HasId(id)&&StringFind(comment,"CSB|"+state.basket+"|")!=0)return false;
   return !Netting()||AllDealsOwned(id);
  }
  bool MarketOpen(datetime server,int &secondsToClose){
   MqlDateTime dt;TimeToStruct(server,dt);int seconds=dt.hour*3600+dt.min*60+dt.sec;secondsToClose=2147483647;bool open=false;long latestClose=0;
   for(int previous=0;previous<=1;previous++){
    ENUM_DAY_OF_WEEK day=(ENUM_DAY_OF_WEEK)((dt.day_of_week+7-previous)%7);
    for(uint i=0;i<32;i++){
     datetime from=0,to=0;if(!SymbolInfoSessionTrade(m_symbol,day,i,from,to))break;
     long a=(long)from%86400,b=(long)to%86400;if(b<=a)b+=86400;long now=seconds+previous*86400;
     if(b-previous*86400>latestClose)latestClose=b-previous*86400;
     if(now>=a&&now<b)open=true;
    }
   }if(open)secondsToClose=(int)(latestClose-seconds);return open;
  }
 public:
  CSState state;int positions;double lastNet,lastRisk;string error;bool conflict;
  void NoticeMode(bool autopilot,bool cutProfit){m_noticeAutopilot=autopilot;m_noticeCutProfit=cutProfit;}
  void Init(string sym,long magic,double commission,double risk,double lot,uint deviation){
   m_symbol=sym;m_magic=magic;m_fee=commission;m_risk=risk;m_lot=lot;m_deviation=deviation;m_tick=SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_SIZE);
   m_trade.SetExpertMagicNumber((ulong)magic);m_trade.SetDeviationInPoints(deviation);m_trade.SetAsyncMode(false);m_trade.SetTypeFillingBySymbol(sym);
   positions=0;lastNet=0;lastRisk=0;conflict=false;m_lastClose=0;m_noticeAutopilot=false;m_noticeCutProfit=false;error="BASKET_READY";
  }
  bool Tradable(MqlTick &q,bool entry){
   if(!SymbolInfoTick(m_symbol,q)||q.bid<=0||q.ask<q.bid||q.time<=0||MathAbs((double)(TimeCurrent()-q.time))>30){error="QUOTE_STALE";return false;}
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)){error="TRADING_DISABLED";return false;}
   long mode=SymbolInfoInteger(m_symbol,SYMBOL_TRADE_MODE);
   if(mode==SYMBOL_TRADE_MODE_DISABLED||(entry&&mode==SYMBOL_TRADE_MODE_CLOSEONLY)){error="BROKER_TRADE_MODE";return false;}
   int close=0;if(!MarketOpen(TimeCurrent(),close)){error="BROKER_MARKET_CLOSED";return false;}
   MqlDateTime dt;TimeToStruct(TimeCurrent(),dt);if(entry&&dt.day_of_week==5&&close<=3600){error="FRIDAY_NO_NEW_60_MINUTES";return false;}
   return true;
  }
  bool GlobalBusy(){
   for(int i=0;i<PositionsTotal();i++){ulong p=PositionGetTicket(i);if(p&&PositionGetInteger(POSITION_MAGIC)==m_magic)return true;}
   for(int i=0;i<OrdersTotal();i++){ulong p=OrderGetTicket(i);if(p&&OrderGetInteger(ORDER_MAGIC)==m_magic)return true;}
   return state.pending;
  }
  bool Net(double &value,bool realized=false){
   value=0;if((!realized&&m_fee<0)||conflict||(realized&&positions>0))return false;MqlTick q;
   if(!realized&&!SymbolInfoTick(m_symbol,q))return false;
   for(int i=0;i<ArraySize(state.ids);i++){
    if(!HistorySelectByPosition(state.ids[i])||HistoryDealsTotal()==0)return false;
    for(int d=0;d<HistoryDealsTotal();d++){
     ulong t=HistoryDealGetTicket(d);long type=HistoryDealGetInteger(t,DEAL_TYPE);
     if((type==DEAL_TYPE_BUY||type==DEAL_TYPE_SELL)&&HistoryDealGetInteger(t,DEAL_MAGIC)!=m_magic)return false;
     value+=CSDealNetContribution(HistoryDealGetDouble(t,DEAL_PROFIT),HistoryDealGetDouble(t,DEAL_SWAP),HistoryDealGetDouble(t,DEAL_COMMISSION),HistoryDealGetDouble(t,DEAL_FEE));
    }
   }
   for(int i=0;i<PositionsTotal()&&!realized;i++){
    ulong p=PositionGetTicket(i);if(!p||!OwnSelected())continue;double profit=0,volume=PositionGetDouble(POSITION_VOLUME);
    bool buy=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY;
    if(!OrderCalcProfit(buy?ORDER_TYPE_BUY:ORDER_TYPE_SELL,m_symbol,volume,PositionGetDouble(POSITION_PRICE_OPEN),buy?q.bid:q.ask,profit))return false;
    value+=profit+PositionGetDouble(POSITION_SWAP)-m_fee*volume;
   }lastNet=value;return MathIsValidNumber(value);
  }
  bool Risk(double newVolume,int side,double entry,double sl,double &cash){
   if(m_fee<0){error="COMMISSION_UNVERIFIED";return false;}cash=0;double closedPL=0;
   for(int i=0;i<ArraySize(state.ids);i++){
    if(!HistorySelectByPosition(state.ids[i])||HistoryDealsTotal()==0)return false;
    for(int j=0;j<HistoryDealsTotal();j++){ulong d=HistoryDealGetTicket(j);cash+=CSMax(0,-HistoryDealGetDouble(d,DEAL_COMMISSION)-HistoryDealGetDouble(d,DEAL_FEE));closedPL+=HistoryDealGetDouble(d,DEAL_PROFIT)+HistoryDealGetDouble(d,DEAL_SWAP);}
   }
   cash+=CSMax(0,-closedPL);
   for(int i=0;i<PositionsTotal();i++){
    ulong p=PositionGetTicket(i);if(!p||!OwnSelected())continue;double loss=0,volume=PositionGetDouble(POSITION_VOLUME);
    if(!OrderCalcProfit(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?ORDER_TYPE_BUY:ORDER_TYPE_SELL,m_symbol,volume,PositionGetDouble(POSITION_PRICE_OPEN),sl,loss))return false;
    cash+=CSMax(0,-loss)+m_fee*volume+CSMax(0,-PositionGetDouble(POSITION_SWAP));
   }
   if(newVolume>0){double loss=0;if(!OrderCalcProfit(side>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL,m_symbol,newVolume,entry,sl,loss))return false;cash+=CSMax(0,-loss)+2*m_fee*newVolume;}
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);lastRisk=equity>0?cash/equity*100:100;
   if(!CSRiskCap(cash,equity,m_risk)){error="SKIP_RISK";return false;}return true;
  }
  void Reconcile(CSNotifier &notify){
   positions=0;conflict=false;
   if(state.basket!=""&&state.first>0&&HistorySelect(state.first-3600,TimeCurrent()+60)){
    int count=HistoryDealsTotal();long found[];bool latestFilled=false;double fillVolume=0,fillValue=0;
    string latest="CSB|"+state.basket+"|"+IntegerToString(state.layers);
    for(int d=0;d<count;d++){
     ulong t=HistoryDealGetTicket(d);if(HistoryDealGetInteger(t,DEAL_MAGIC)==m_magic&&HistoryDealGetString(t,DEAL_SYMBOL)==m_symbol&&(StringFind(HistoryDealGetString(t,DEAL_COMMENT),"CSB|"+state.basket+"|")==0||(state.pending&&state.pendingOrder>0&&(ulong)HistoryDealGetInteger(t,DEAL_ORDER)==state.pendingOrder))){
      int n=ArraySize(found);ArrayResize(found,n+1);found[n]=HistoryDealGetInteger(t,DEAL_POSITION_ID);
      long entry=HistoryDealGetInteger(t,DEAL_ENTRY);
      if(state.pending&&(entry==DEAL_ENTRY_IN||entry==DEAL_ENTRY_INOUT)&&
       ((state.pendingOrder>0&&(ulong)HistoryDealGetInteger(t,DEAL_ORDER)==state.pendingOrder)||
        (state.pendingOrder==0&&HistoryDealGetString(t,DEAL_COMMENT)==latest))){
       latestFilled=true;double volume=HistoryDealGetDouble(t,DEAL_VOLUME);
       fillVolume+=volume;fillValue+=volume*HistoryDealGetDouble(t,DEAL_PRICE);
      }
     }
    }for(int k=0;k<ArraySize(found);k++)state.AddId(found[k]);
    bool activeOrder=false;
    for(int o=0;o<OrdersTotal();o++){
     ulong ticket=OrderGetTicket(o);if(!ticket||OrderGetInteger(ORDER_MAGIC)!=m_magic||OrderGetString(ORDER_SYMBOL)!=m_symbol)continue;
     if((state.pendingOrder>0&&ticket==state.pendingOrder)||(state.pendingOrder==0&&OrderGetString(ORDER_COMMENT)==latest))activeOrder=true;
    }
    if(latestFilled){
     if(fillVolume>0&&fillValue>0){
      CSOrderNoticeContext context;CSNoticeContextDecode(state.noticeContext,context);
      if(context.known){context.autopilot=m_noticeAutopilot;context.cutProfit=m_noticeCutProfit;}
      notify.Add("ENTRY_FILLED_"+state.basket+"_"+IntegerToString(state.layers),
       CSFilledOrderNotice(context,m_symbol,state.side,state.layers,fillVolume,fillValue/fillVolume,state.sl,state.tp));
     }
     state.Remember(state.spent,state.window,256);state.Remember(state.signals,state.signal,512);
     state.last=TimeCurrent();if(!activeOrder){state.pending=false;state.pendingOrder=0;}state.Save();
    }else if(state.pending&&state.pendingOrder>0&&!activeOrder&&HistoryOrderSelect(state.pendingOrder)&&
      (ENUM_ORDER_STATE)HistoryOrderGetInteger(state.pendingOrder,ORDER_STATE)==ORDER_STATE_REJECTED){
     CSReleaseLayer(state.layers);state.pending=false;state.pendingOrder=0;state.Save();
    }
   }
   for(int i=0;i<PositionsTotal();i++){
    ulong p=PositionGetTicket(i);if(!p)continue;
    if(Netting()&&PositionGetString(POSITION_SYMBOL)==m_symbol&&PositionGetInteger(POSITION_MAGIC)!=m_magic){conflict=true;continue;}
    if(PositionGetInteger(POSITION_MAGIC)!=m_magic)continue;
    if(PositionGetString(POSITION_SYMBOL)!=m_symbol){conflict=true;continue;}
    string comment=PositionGetString(POSITION_COMMENT);
    if(state.basket==""){
     if(StringFind(comment,"CSB|")!=0||StringLen(comment)<21){conflict=true;continue;}
     state.basket=StringSubstr(comment,4,16);state.side=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;
     state.sl=PositionGetDouble(POSITION_SL);state.tp=PositionGetDouble(POSITION_TP);state.first=(datetime)PositionGetInteger(POSITION_TIME);state.last=state.first;state.recovered=true;
    }
    if(!OwnSelected()){conflict=true;continue;}
    state.AddId(PositionGetInteger(POSITION_IDENTIFIER));positions++;
    int side=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;
    if(side!=state.side){conflict=true;continue;}
    if(state.sl<=0||state.tp<=0){
     state.exitEvent="SAFETY_RECOVERY_"+state.basket;state.exitPending=true;state.Save();
     MqlTick q;if(Tradable(q,false)){m_trade.PositionClose(p,m_deviation);notify.Add("NAKED_RECOVERY_"+IntegerToString((long)p),"Missing original SL/TP; emergency close requested for recognized EA ticket");}
     conflict=true;error="RECOVERY_MISSING_ORIGINAL_SLTP";continue;
    }
    if(MathAbs(PositionGetDouble(POSITION_SL)-state.sl)>m_tick/2||MathAbs(PositionGetDouble(POSITION_TP)-state.tp)>m_tick/2){
     MqlTick q;if(Tradable(q,false)){
      bool repaired=m_trade.PositionModify(p,state.sl,state.tp)&&m_trade.ResultRetcode()==TRADE_RETCODE_DONE;
      if(!repaired){state.exitEvent="SAFETY_STOP_"+state.basket;state.exitPending=true;state.Save();m_trade.PositionClose(p,m_deviation);notify.Add("SLTP_FAILSAFE_"+IntegerToString((long)p),"Original SL/TP repair failed; emergency close requested for EA ticket "+IntegerToString((long)p));}
     }
    }
   }
   if(state.basket!=""&&positions==0&&!GlobalBusy()&&!state.pending){
    double realized=0;bool verified=Net(realized,true);string id=state.basket;
    string reason=StringFind(state.exitEvent,"SAFETY_")==0?"SAFETY_BASKET_CLOSED":state.exitPending?"CUT_PROFIT_CLOSED":"BASKET_CLOSED";
    if(ArraySize(state.ids)>0)notify.Add("BASKET_FLAT_"+id,reason+(verified?" NET realized=":" NET UNVERIFIED ")+DoubleToString(realized,2));
    state.EmptyBasket();state.Save();
   }
   if(conflict)error="POSITION_OWNERSHIP_CONFLICT";
   if(state.recovered)error="RECOVERED_BASKET_NO_ADDITIONS";
  }
  bool Preflight(int side,const CSMicro &micro,double sl,double tp,MqlTick &q){
   if(conflict||state.pending||!Tradable(q,true))return false;
   long mode=SymbolInfoInteger(m_symbol,SYMBOL_TRADE_MODE);
   if((side>0&&mode==SYMBOL_TRADE_MODE_SHORTONLY)||(side<0&&mode==SYMBOL_TRADE_MODE_LONGONLY)){error="BROKER_DIRECTION_DISABLED";return false;}
   if(!CSPriceAfterEL2Retest(side,q.bid,q.ask,micro)){error="SKIP_EL2_REJECTION_LOST";return false;}
   double entry=side>0?q.ask:q.bid,stop=side*(entry-sl);
   if(stop<=0||(q.ask-q.bid)/stop>0.10||CSRR(side,entry,sl,tp)<2){error="SKIP_SPREAD_OR_RR";return false;}
   double step=SymbolInfoDouble(m_symbol,SYMBOL_VOLUME_STEP),min=SymbolInfoDouble(m_symbol,SYMBOL_VOLUME_MIN),max=SymbolInfoDouble(m_symbol,SYMBOL_VOLUME_MAX);
   if(step<=0||m_lot<min||m_lot>max||MathAbs(m_lot/step-MathRound(m_lot/step))>1e-7){error="SKIP_VOLUME";return false;}
   double point=SymbolInfoDouble(m_symbol,SYMBOL_POINT),distance=CSMax(SymbolInfoInteger(m_symbol,SYMBOL_TRADE_STOPS_LEVEL),SymbolInfoInteger(m_symbol,SYMBOL_TRADE_FREEZE_LEVEL))*point;
   if(side>0?(q.bid-sl<distance||tp-q.bid<distance):(sl-q.ask<distance||q.ask-tp<distance)){error="SKIP_BROKER_STOPLEVEL";return false;}
   double margin=0,cash=0;if(!OrderCalcMargin(side>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL,m_symbol,m_lot,entry,margin)||margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)){error="SKIP_MARGIN";return false;}
   if(!Risk(m_lot,side,entry,sl,cash))return false;
   MqlTradeRequest request={};MqlTradeCheckResult checked={};
   request.action=TRADE_ACTION_DEAL;request.symbol=m_symbol;request.magic=(ulong)m_magic;request.volume=m_lot;
   request.type=side>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;request.price=entry;request.sl=sl;request.tp=tp;request.deviation=m_deviation;
   long filling=SymbolInfoInteger(m_symbol,SYMBOL_FILLING_MODE);
   request.type_filling=(filling&SYMBOL_FILLING_FOK)!=0?ORDER_FILLING_FOK:(filling&SYMBOL_FILLING_IOC)!=0?ORDER_FILLING_IOC:ORDER_FILLING_RETURN;
   if(!OrderCheck(request,checked)){error="ORDER_CHECK_"+IntegerToString(checked.retcode);return false;}return true;
  }
  bool Submit(string windowId,string signal,const CSSetup &setup,datetime gate,const CSMicro &micro,double tp,datetime deadline,const CSOrderNoticeContext &context,CSNotifier &notify){
   bool newBasket=positions==0;
   if(newBasket&&(GlobalBusy()||state.Contains(state.spent,windowId))){error="WINDOW_SPENT_OR_BASKET_BUSY";return false;}
   if(state.layers>=4){error="LAYER_LIMIT";return false;}
   if(!newBasket&&(state.side!=setup.side||state.recovered)){error="SKIP_BASKET_ADDITION";return false;}
   if(state.Contains(state.signals,signal)){error="DUPLICATE_SIGNAL";return false;}
   if(!newBasket&&(setup.origin<=state.last||setup.structure<=state.last||setup.origin==state.h1Origin||setup.birth==state.h1Birth||gate<=state.last||micro.source<=state.last)){error="ADDITION_REQUIRES_NEW_ICT_EL2_SETUP";return false;}
   double sl=newBasket?micro.sl:state.sl,target=newBasket?tp:state.tp;MqlTick q;
   if(!Preflight(setup.side,micro,sl,target,q))return false;
   if(newBasket){
    state.basket=CSHash16(windowId+signal+IntegerToString(state.account)+IntegerToString(m_magic));if(state.basket==""){error="HASH_FAILED";return false;}
    state.window=windowId;state.side=setup.side;state.sl=sl;state.tp=target;state.fib0=micro.fib0;state.fib1=micro.fib1;state.first=TimeCurrent();state.last=TimeCurrent();
   }
   state.h1Origin=setup.origin;state.h1Structure=setup.structure;state.h1Birth=setup.birth;state.m15Retest=gate;state.m5Source=micro.source;
   for(int layer=0;layer<2;layer++){
    if(TimeCurrent()>=deadline){error="SKIP_WINDOW_OR_FEED_EXPIRED";break;}
    if(!Preflight(setup.side,micro,state.sl,state.tp,q))break;
    // Reserve before the request. Uncertain fills cannot be retried as new entries.
    if(!CSReserveLayer(state.layers)){error="LAYER_LIMIT";break;}
    state.noticeContext=CSNoticeContextEncode(context);state.signal=signal;state.pending=true;state.window=windowId;state.pendingOrder=0;state.intent=TimeCurrent();
    if(!state.Save()){error="PERSISTENCE_FAILED_BEFORE_ORDER";return false;}
    int index=state.layers;string comment="CSB|"+state.basket+"|"+IntegerToString(index);
    bool sent=setup.side>0?m_trade.Buy(m_lot,m_symbol,q.ask,state.sl,state.tp,comment):m_trade.Sell(m_lot,m_symbol,q.bid,state.sl,state.tp,comment);
    uint code=m_trade.ResultRetcode();int outcome=CSOrderOutcome(code);
    bool filled=outcome==CS_ORDER_FILLED;
    state.pendingOrder=m_trade.ResultOrder();
    if(filled){state.Remember(state.spent,windowId,256);state.Remember(state.signals,signal,512);state.last=TimeCurrent();}
    else if(outcome==CS_ORDER_REJECTED){CSReleaseLayer(state.layers);state.pending=false;state.pendingOrder=0;}
    // 'sent' alone is not a broker fill acknowledgement. Unknown requests stay
    // persisted until the exact latest order/deal is reconciled, never an old fill.
    state.Save();
    PrintFormat("%s %.2f ticket=%I64u retcode=%u SL FIB=%s TP ICT=%s fib0=%s fib1=%s risk=%.3f%%",setup.side>0?"BUY":"SELL",m_lot,m_trade.ResultOrder(),code,DoubleToString(state.sl,8),DoubleToString(state.tp,8),DoubleToString(state.fib0,8),DoubleToString(state.fib1,8),lastRisk);
    if(outcome!=CS_ORDER_FILLED)notify.Add("ORDER_STATUS_"+state.basket+"_"+IntegerToString(index)+"_"+IntegerToString(code),
     "🟢 CEBONK COMPANY 22\n"+(outcome==CS_ORDER_REJECTED?"⛔ ORDER DITOLAK":"⏳ STATUS ORDER BELUM PASTI")+
     " — "+CSNoticeSide(setup.side)+" "+m_symbol+"\nRetcode: "+IntegerToString(code)+"\nBelum ada fill terkonfirmasi untuk request ini.");
    if(!sent&&outcome==CS_ORDER_UNKNOWN)error="ORDER_ACK_UNKNOWN";
    Reconcile(notify);if(!filled||state.pending||positions==0||conflict)break;
    double cash=0;if(!Risk(0,state.side,0,state.sl,cash)){state.exitEvent="SAFETY_RISK_"+state.basket;state.exitPending=true;state.Save();notify.Add("UNSAFE_FILL_"+state.basket,"Risk after fill exceeded cap; emergency close requested");CloseAll(notify);break;}
   }
   if(positions==0&&!state.pending&&ArraySize(state.ids)==0){state.EmptyBasket();state.Save();}
   error=state.pending?"ORDER_ACK_UNKNOWN":positions>0?"BASKET_ACTIVE":"ORDER_REJECTED_WINDOW_AVAILABLE";return positions>0;
  }
  void CloseAll(CSNotifier &notify){
   MqlTick q;if(conflict||TimeCurrent()-m_lastClose<10||!Tradable(q,false))return;m_lastClose=TimeCurrent();
   ulong tickets[];for(int i=0;i<PositionsTotal();i++){ulong p=PositionGetTicket(i);if(p&&OwnSelected()){int n=ArraySize(tickets);ArrayResize(tickets,n+1);tickets[n]=p;}}
   for(int i=0;i<ArraySize(tickets);i++){
    if(!PositionSelectByTicket(tickets[i])||!OwnSelected())continue;
    bool ok=m_trade.PositionClose(tickets[i],m_deviation);uint code=m_trade.ResultRetcode();
    notify.Add("EXIT_REQUEST_"+state.exitEvent+"_"+IntegerToString((long)tickets[i])+"_"+IntegerToString(code),StringFormat("%s request ticket=%I64u accepted=%s retcode=%u",StringFind(state.exitEvent,"SAFETY_")==0?"SAFETY_CLOSE":"CUT_PROFIT",tickets[i],ok?"true":"false",code));
   }
  }
  void ManageExit(CS_CONST_ARRAY(CSBar,m15),bool enabled,CSNotifier &notify){
   if(positions<=0||conflict)return;
   if(state.exitPending&&StringFind(state.exitEvent,"SAFETY_")==0){CloseAll(notify);return;}
   if(!enabled)return;
   if(state.recovered&&!state.exitPending){error="EXIT_NET_UNVERIFIED_RECOVERY";return;}
   if(state.exitPending){
    if(TimeCurrent()>=state.exitExpiry){notify.Add("EXIT_EXPIRED_"+state.exitEvent,"CUT_PROFIT_PARTIAL/FAILED: M15 signal expired; original server SL/TP remain");state.exitPending=false;state.Save();}
    else{CloseAll(notify);return;}
   }
   if(ArraySize(m15)<5)return;datetime close=m15[ArraySize(m15)-1].time+900;
   if(close<=state.lastM15||close<=state.last)return;
   state.lastM15=close;if(!state.Save()){error="EXIT_PERSISTENCE_FAILED";return;}
   CSDominant signal;if(!CSDominantExit(m15,m_tick,3,12,signal))return;
   if(signal.side!=-state.side){error="EXIT_DOMINANT_M15_SAME_DIRECTION_IGNORED";return;}
   double net=0;if(!Net(net)){error="EXIT_NET_UNVERIFIED";return;}if(!CSShouldExit(state.side,signal.side,net,true)){error="EXIT_NO_NET_PROFIT";return;}
   state.exitEvent=CSHash16(m_symbol+IntegerToString((long)signal.mother)+IntegerToString((long)close)+IntegerToString(signal.side));
   state.exitExpiry=close+900;state.exitPending=true;if(!state.Save()){error="EXIT_PERSISTENCE_FAILED";return;}
   notify.Add("CUT_PROFIT_REQUESTED_"+state.exitEvent,StringFormat("Dominant M15 opposite; mother=%I64d children=%d break=%I64d NET estimated=%.2f",(long)signal.mother,signal.children,(long)close,net));
   CloseAll(notify);
  }
};
#endif
