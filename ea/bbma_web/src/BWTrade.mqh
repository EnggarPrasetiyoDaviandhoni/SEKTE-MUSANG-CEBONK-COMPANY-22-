// CEBONK BBMA WEB EA v1.00 - compact execution + Telegram/MT5 notification.
#ifndef CEBONK_BW_TRADE
#define CEBONK_BW_TRADE

struct BWNoticeItem { string event,text; int tries; bool pushed; };
BWNoticeItem gBWQueue[];
long gBWNextNotify=0;

string BWQ(const string s){
 string out="\"";for(int i=0;i<StringLen(s);i++){ushort c=StringGetCharacter(s,i);
  if(c==34)out+="\\\"";else if(c==92)out+="\\\\";else if(c==10)out+="\\n";
  else if(c==13)out+="\\r";else if(c==9)out+="\\t";else if(c<32)out+=StringFormat("\\u%04X",(int)c);else out+=ShortToString(c);
 }return out+"\"";
}
void BWAudit(const string event,const string symbol,const string detail){
 Print("{\"ea\":\"CEBONK_BBMA_WEB\",\"event\":"+BWQ(event)+",\"symbol\":"+BWQ(symbol)+",\"detail\":"+BWQ(detail)+"}");
}
void BWNotice(const string event,const string text,const string symbol,const bool tester,const bool autoOn){
 BWAudit(event,symbol,text);if(tester)return;
 int n=ArraySize(gBWQueue);if(n>=32)return;ArrayResize(gBWQueue,n+1);
 gBWQueue[n].event=event;gBWQueue[n].tries=0;gBWQueue[n].pushed=false;
 gBWQueue[n].text="SEKTE MUSANG - CEBONK COMPANY 22\nBBMA WEB EA | "+event+"\n"+
 symbol+" | AUTOPILOT "+(autoOn?"ON":"OFF")+"\n--------------------\n"+StringSubstr(text,0,3000)+"\n--------------------\nOJO FULLMARGIN COK";
}
void BWPopNotice(){int n=ArraySize(gBWQueue);for(int i=1;i<n;i++)gBWQueue[i-1]=gBWQueue[i];ArrayResize(gBWQueue,n-1);}
void BWFlushNotice(const bool tester,const bool push,const bool telegram,const string token,const string chat,const int timeout){
 if(tester||ArraySize(gBWQueue)==0||(long)TimeLocal()<gBWNextNotify)return;gBWNextNotify=(long)TimeLocal()+7;
 if(!gBWQueue[0].pushed){if(push&&!SendNotification(StringSubstr(gBWQueue[0].event+" | "+gBWQueue[0].text,0,250)))Print("BW MT5 push gagal.");gBWQueue[0].pushed=true;}
 if(!telegram||token==""||chat==""){BWPopNotice();return;}
 string body="{\"chat_id\":"+BWQ(chat)+",\"text\":"+BWQ(gBWQueue[0].text)+"}";
 char bytes[],answer[];string headers;int len=StringToCharArray(body,bytes,0,WHOLE_ARRAY,CP_UTF8);if(len>0)ArrayResize(bytes,len-1);
 ResetLastError();int http=WebRequest("POST","https://api.telegram.org/bot"+token+"/sendMessage","Content-Type: application/json\r\n",timeout,bytes,answer,headers);
 string response=CharArrayToString(answer,0,WHOLE_ARRAY,CP_UTF8);StringReplace(response," ","");
 if(http==200&&StringFind(response,"\"ok\":true")>=0){BWPopNotice();return;}
 gBWQueue[0].tries++;Print("BW Telegram HTTP=",http," err=",GetLastError(),"; token/response hidden.");
 if(http==400||http==401||http==403||gBWQueue[0].tries>=3)BWPopNotice();else gBWNextNotify=(long)TimeLocal()+(http==429?120:30);
}
bool BWHasPositionOrOrder(const string symbol){
 for(int i=PositionsTotal()-1;i>=0;i--)if(PositionGetTicket(i)>0&&PositionGetString(POSITION_SYMBOL)==symbol)return true;
 for(int i=OrdersTotal()-1;i>=0;i--)if(OrderGetTicket(i)>0&&OrderGetString(ORDER_SYMBOL)==symbol)return true;
 return false;
}
ENUM_ORDER_TYPE_FILLING BWFilling(const string symbol,bool &ok){
 ok=true;long f=SymbolInfoInteger(symbol,SYMBOL_FILLING_MODE);
 if((f&SYMBOL_FILLING_FOK)!=0)return ORDER_FILLING_FOK;
 if((f&SYMBOL_FILLING_IOC)!=0)return ORDER_FILLING_IOC;
 if(SymbolInfoInteger(symbol,SYMBOL_TRADE_EXEMODE)!=SYMBOL_TRADE_EXECUTION_MARKET)return ORDER_FILLING_RETURN;
 ok=false;return ORDER_FILLING_FOK;
}
double BWRoundTick(const string symbol,const double price,const bool up){
 double tick=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
 if(tick<=0)return 0;double x=up?MathCeil(price/tick-1e-9):MathFloor(price/tick+1e-9);
 return NormalizeDouble(x*tick,digits);
}
uint BWHash(const string s){uint h=2166136261;for(int i=0;i<StringLen(s);i++){h^=(uint)StringGetCharacter(s,i);h*=16777619;}return h;}

bool BWPlace(const string symbol,const ulong magic,const BWSignal &s,const bool newsMode,const double fixedLot,
 const int maxSpread,const int deviation,const bool allowReal,const double rr,string &why,ulong &order){
 why="";order=0;MqlTick tick;if(!SymbolInfoTick(symbol,tick)||tick.bid<=0||tick.ask<tick.bid){why="NO_QUOTE";return false;}
 if(!allowReal&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL){why="REAL_ACCOUNT_LOCKED";return false;}
 if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)){why="ALGO_OR_ACCOUNT_DISABLED";return false;}
 if(BWHasPositionOrOrder(symbol)){why="SYMBOL_ALREADY_HAS_POSITION_OR_ORDER";return false;}
 double point=SymbolInfoDouble(symbol,SYMBOL_POINT);if(point<=0||(tick.ask-tick.bid)/point>maxSpread){why="SPREAD_LIMIT";return false;}
 long tradeMode=SymbolInfoInteger(symbol,SYMBOL_TRADE_MODE);
 if(tradeMode==SYMBOL_TRADE_MODE_DISABLED||tradeMode==SYMBOL_TRADE_MODE_CLOSEONLY||(tradeMode==SYMBOL_TRADE_MODE_LONGONLY&&s.dir<0)||(tradeMode==SYMBOL_TRADE_MODE_SHORTONLY&&s.dir>0)){why="SIDE_DISABLED";return false;}
 double minv=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN),maxv=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX),step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
 if(step<=0||fixedLot<minv||fixedLot>maxv){why="FIXED_LOT_INVALID";return false;}
 double lot=NormalizeDouble(MathFloor(fixedLot/step+1e-8)*step,8);if(lot<minv){why="LOT_STEP_INVALID";return false;}
 double entry=s.dir>0?tick.ask:tick.bid;
 double sl=BWRoundTick(symbol,s.structuralSL,s.dir<0);
 double risk=s.dir>0?entry-sl:sl-entry;if(sl<=0||risk<=0){why="SL_WRONG_SIDE";return false;}
 double tp=s.dir>0?entry+risk*rr:entry-risk*rr;tp=BWRoundTick(symbol,tp,s.dir>0);
 double reward=s.dir>0?tp-entry:entry-tp;if(reward<=0){why="TP_WRONG_SIDE";return false;}
 double stop=(SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*point;
 if((s.dir>0&&(tick.bid-sl<stop||tp-tick.bid<stop))||(s.dir<0&&(sl-tick.ask<stop||tick.ask-tp<stop))){why="BROKER_MIN_STOP_DISTANCE";return false;}
 bool fillOK=false;ENUM_ORDER_TYPE_FILLING filling=BWFilling(symbol,fillOK);if(!fillOK){why="FILLING_MODE_UNSUPPORTED";return false;}
 MqlTradeRequest req={};MqlTradeCheckResult chk={};MqlTradeResult res={};
 req.action=TRADE_ACTION_DEAL;req.magic=magic;req.symbol=symbol;req.volume=lot;req.type=s.dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
 req.price=entry;req.sl=sl;req.tp=tp;req.deviation=(ulong)deviation;req.type_filling=filling;
 req.comment="BW-"+(string)s.pkg+"-"+(newsMode?"N":"A")+"-"+StringFormat("%08X",BWHash((string)s.eventAt+"."+(string)s.pkg));
 if(!OrderCheck(req,chk)){why="ORDERCHECK_"+(string)chk.retcode;return false;}
 bool sent=OrderSend(req,res);order=res.order;
 if(!sent||(res.retcode!=TRADE_RETCODE_DONE&&res.retcode!=TRADE_RETCODE_DONE_PARTIAL&&res.retcode!=TRADE_RETCODE_PLACED)){why="ORDER_"+(string)res.retcode;return false;}
 return true;
}
int BWPackageFromComment(const string c){
 if(StringLen(c)<4||StringSubstr(c,0,3)!="BW-")return -1;int p=(int)StringToInteger(StringSubstr(c,3,1));return p>=0&&p<BW_PACKAGE_COUNT?p:-1;
}
bool BWOurPosition(const string symbol,const ulong magic,ulong &ticket,int &dir,int &pkg,double &open,double &sl){
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong t=PositionGetTicket(i);if(t==0||PositionGetString(POSITION_SYMBOL)!=symbol||(ulong)PositionGetInteger(POSITION_MAGIC)!=magic)continue;
  ticket=t;dir=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;pkg=BWPackageFromComment(PositionGetString(POSITION_COMMENT));
  open=PositionGetDouble(POSITION_PRICE_OPEN);sl=PositionGetDouble(POSITION_SL);return true;
 }return false;
}
bool BWClosePosition(const string symbol,const ulong ticket,const int dir,const int deviation,string &why){
 why="";if(!PositionSelectByTicket(ticket)){why="POSITION_NOT_FOUND";return false;}
 MqlTick tick;if(!SymbolInfoTick(symbol,tick)){why="NO_QUOTE";return false;}double volume=PositionGetDouble(POSITION_VOLUME);if(volume<=0){why="VOLUME_INVALID";return false;}
 bool fillOK=false;ENUM_ORDER_TYPE_FILLING filling=BWFilling(symbol,fillOK);if(!fillOK){why="FILLING_MODE_UNSUPPORTED";return false;}
 MqlTradeRequest req={};MqlTradeResult res={};req.action=TRADE_ACTION_DEAL;req.position=ticket;req.symbol=symbol;req.volume=volume;
 req.type=dir>0?ORDER_TYPE_SELL:ORDER_TYPE_BUY;req.price=dir>0?tick.bid:tick.ask;req.deviation=(ulong)deviation;req.type_filling=filling;req.comment="BW-CUT";
 bool sent=OrderSend(req,res);if(!sent||(res.retcode!=TRADE_RETCODE_DONE&&res.retcode!=TRADE_RETCODE_DONE_PARTIAL)){why="CLOSE_"+(string)res.retcode;return false;}return true;
}
void BWTradeTransaction(const MqlTradeTransaction &trans,const string symbol,const ulong magic,const bool tester,const bool autoOn){
 if(trans.type!=TRADE_TRANSACTION_DEAL_ADD||trans.deal==0||!HistoryDealSelect(trans.deal))return;
 if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=symbol||(ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=magic)return;
 long entry=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);double price=HistoryDealGetDouble(trans.deal,DEAL_PRICE),vol=HistoryDealGetDouble(trans.deal,DEAL_VOLUME);
 string side=HistoryDealGetInteger(trans.deal,DEAL_TYPE)==DEAL_TYPE_BUY?"BUY":"SELL";
 if(entry==DEAL_ENTRY_IN||entry==DEAL_ENTRY_INOUT)BWNotice("ENTRY_FILLED",side+" "+DoubleToString(vol,2)+" lot @ "+DoubleToString(price,(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS)),symbol,tester,autoOn);
 if(entry==DEAL_ENTRY_OUT||entry==DEAL_ENTRY_OUT_BY||entry==DEAL_ENTRY_INOUT){
  double net=HistoryDealGetDouble(trans.deal,DEAL_PROFIT)+HistoryDealGetDouble(trans.deal,DEAL_COMMISSION)+HistoryDealGetDouble(trans.deal,DEAL_SWAP)+HistoryDealGetDouble(trans.deal,DEAL_FEE);
  BWNotice("POSITION_EXIT",side+" exit @ "+DoubleToString(price,(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS))+" | net deal "+DoubleToString(net,2),symbol,tester,autoOn);
 }
}
#endif
