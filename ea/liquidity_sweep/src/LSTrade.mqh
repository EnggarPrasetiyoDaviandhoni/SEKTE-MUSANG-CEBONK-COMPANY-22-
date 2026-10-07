// CEBONK LIQUIDITY SWEEP EA v1.01 - compact fixed-lot execution.
#ifndef CEBONK_LS_TRADE
#define CEBONK_LS_TRADE

bool LSHasPositionOrOrder(const string symbol){
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong t=PositionGetTicket(i);
  if(t>0&&PositionGetString(POSITION_SYMBOL)==symbol)return true;
 }
 for(int i=OrdersTotal()-1;i>=0;i--){
  ulong t=OrderGetTicket(i);
  if(t>0&&OrderGetString(ORDER_SYMBOL)==symbol)return true;
 }
 return false;
}
ENUM_ORDER_TYPE_FILLING LSFilling(const string symbol,bool &ok){
 ok=true;long f=SymbolInfoInteger(symbol,SYMBOL_FILLING_MODE);
 if((f&SYMBOL_FILLING_FOK)!=0)return ORDER_FILLING_FOK;
 if((f&SYMBOL_FILLING_IOC)!=0)return ORDER_FILLING_IOC;
 if(SymbolInfoInteger(symbol,SYMBOL_TRADE_EXEMODE)!=SYMBOL_TRADE_EXECUTION_MARKET)return ORDER_FILLING_RETURN;
 ok=false;return ORDER_FILLING_FOK;
}
double LSRoundTick(const string symbol,const double price,const bool up){
 double tick=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);
 int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
 if(tick<=0)return 0;
 double x=up?MathCeil(price/tick-1e-9):MathFloor(price/tick+1e-9);
 return NormalizeDouble(x*tick,digits);
}
uint LSHash(const string s){
 uint h=2166136261;
 for(int i=0;i<StringLen(s);i++){h^=(uint)StringGetCharacter(s,i);h*=16777619;}
 return h;
}
bool LSPlace(const string symbol,const ulong magic,const BWSignal &s,const bool newsMode,
 const double fixedLot,const int maxSpread,const int deviation,const bool allowReal,const double rr,
 string &why,ulong &order){
 why="";order=0;MqlTick tick;
 if(!SymbolInfoTick(symbol,tick)||tick.bid<=0||tick.ask<tick.bid){why="NO_QUOTE";return false;}
 if(!allowReal&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL){why="REAL_ACCOUNT_LOCKED";return false;}
 if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||
    !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)){
  why="ALGO_OR_ACCOUNT_DISABLED";return false;
 }
 if(LSHasPositionOrOrder(symbol)){why="SYMBOL_ALREADY_HAS_POSITION_OR_ORDER";return false;}
 double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
 if(point<=0||(tick.ask-tick.bid)/point>maxSpread){why="SPREAD_LIMIT";return false;}
 long tradeMode=SymbolInfoInteger(symbol,SYMBOL_TRADE_MODE);
 if(tradeMode==SYMBOL_TRADE_MODE_DISABLED||tradeMode==SYMBOL_TRADE_MODE_CLOSEONLY||
   (tradeMode==SYMBOL_TRADE_MODE_LONGONLY&&s.dir<0)||(tradeMode==SYMBOL_TRADE_MODE_SHORTONLY&&s.dir>0)){
  why="SIDE_DISABLED";return false;
 }
 double minv=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN),maxv=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX),step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
 if(step<=0||fixedLot<minv||fixedLot>maxv){why="FIXED_LOT_INVALID";return false;}
 double lot=NormalizeDouble(MathFloor(fixedLot/step+1e-8)*step,8);
 if(lot<minv||lot>maxv){why="LOT_STEP_INVALID";return false;}

 double entry=s.dir>0?tick.ask:tick.bid;
 double sl=LSRoundTick(symbol,s.structuralSL,s.dir<0);
 double risk=s.dir>0?entry-sl:sl-entry;
 if(sl<=0||risk<=0){why="SL_WRONG_SIDE";return false;}
 double tp=s.dir>0?entry+risk*rr:entry-risk*rr;
 tp=LSRoundTick(symbol,tp,s.dir>0);
 double reward=s.dir>0?tp-entry:entry-tp;
 if(reward<=0){why="TP_WRONG_SIDE";return false;}

 double stop=(SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*point;
 if((s.dir>0&&(tick.bid-sl<stop||tp-tick.bid<stop))||
    (s.dir<0&&(sl-tick.ask<stop||tick.ask-tp<stop))){
  why="BROKER_MIN_STOP_DISTANCE";return false;
 }

 bool fillOK=false;ENUM_ORDER_TYPE_FILLING filling=LSFilling(symbol,fillOK);
 if(!fillOK){why="FILLING_MODE_UNSUPPORTED";return false;}

 MqlTradeRequest req={};MqlTradeCheckResult chk={};MqlTradeResult res={};
 req.action=TRADE_ACTION_DEAL;req.magic=magic;req.symbol=symbol;req.volume=lot;
 req.type=s.dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;req.price=entry;req.sl=sl;req.tp=tp;
 req.deviation=(ulong)deviation;req.type_filling=filling;
 req.comment="LS-"+(string)s.pkg+"-"+(newsMode?"N":"A")+"-"+StringFormat("%08X",LSHash((string)s.reAt+"."+(string)s.eventAt+"."+(string)s.pkg));
 if(!OrderCheck(req,chk)){why="ORDERCHECK_"+(string)chk.retcode;return false;}
 bool sent=OrderSend(req,res);order=res.order;
 if(!sent||(res.retcode!=TRADE_RETCODE_DONE&&res.retcode!=TRADE_RETCODE_DONE_PARTIAL&&res.retcode!=TRADE_RETCODE_PLACED)){
  why="ORDER_"+(string)res.retcode;return false;
 }
 return true;
}
void LSTradeTransaction(const MqlTradeTransaction &trans,const string symbol,const ulong magic,const bool tester,const bool autoOn){
 if(trans.type!=TRADE_TRANSACTION_DEAL_ADD||trans.deal==0||!HistoryDealSelect(trans.deal))return;
 if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=symbol||(ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=magic)return;
 long entry=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
 double price=HistoryDealGetDouble(trans.deal,DEAL_PRICE),vol=HistoryDealGetDouble(trans.deal,DEAL_VOLUME);
 string side=HistoryDealGetInteger(trans.deal,DEAL_TYPE)==DEAL_TYPE_BUY?"BUY":"SELL";
 int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
 if(entry==DEAL_ENTRY_IN||entry==DEAL_ENTRY_INOUT)
  LSNotice("ENTRY_FILLED",side+" "+DoubleToString(vol,2)+" lot @ "+DoubleToString(price,digits),symbol,tester,autoOn);
 if(entry==DEAL_ENTRY_OUT||entry==DEAL_ENTRY_OUT_BY||entry==DEAL_ENTRY_INOUT){
  double net=HistoryDealGetDouble(trans.deal,DEAL_PROFIT)+HistoryDealGetDouble(trans.deal,DEAL_COMMISSION)+
             HistoryDealGetDouble(trans.deal,DEAL_SWAP)+HistoryDealGetDouble(trans.deal,DEAL_FEE);
  LSNotice("POSITION_EXIT",side+" exit @ "+DoubleToString(price,digits)+" | net deal "+DoubleToString(net,2),symbol,tester,autoOn);
 }
}
#endif
