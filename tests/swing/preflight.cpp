// Verbatim CSBasket::Preflight, with a local broker-response adapter. No orders sent.
#include "host_mt5.hpp"
#include "../../MQL5/Include/CebonkSwing/NumericCore.mqh"
#include <iostream>
using ulong=unsigned long;
constexpr int SYMBOL_TRADE_MODE=1,SYMBOL_TRADE_MODE_SHORTONLY=2,SYMBOL_TRADE_MODE_LONGONLY=3;
constexpr int SYMBOL_VOLUME_STEP=4,SYMBOL_VOLUME_MIN=5,SYMBOL_VOLUME_MAX=6,SYMBOL_POINT=7;
constexpr int SYMBOL_TRADE_STOPS_LEVEL=8,SYMBOL_TRADE_FREEZE_LEVEL=9,SYMBOL_FILLING_MODE=10,ACCOUNT_MARGIN_FREE=11;
constexpr int ORDER_TYPE_BUY=0,ORDER_TYPE_SELL=1,TRADE_ACTION_DEAL=1,SYMBOL_FILLING_FOK=1,SYMBOL_FILLING_IOC=2;
constexpr int ORDER_FILLING_FOK=0,ORDER_FILLING_IOC=1,ORDER_FILLING_RETURN=2;
struct MqlTick {double bid,ask;};
struct MqlTradeRequest {int action=0;string symbol;ulong magic=0;double volume=0;int type=0;double price=0,sl=0,tp=0;uint deviation=0;int type_filling=0;};
struct MqlTradeCheckResult {uint retcode=0;};
datetime TimeCurrent(){return 100000;}
MqlTick currentQuote{4249.99,4250};int checksSent=0;
long SymbolInfoInteger(string,int field){return field==SYMBOL_FILLING_MODE?SYMBOL_FILLING_FOK:0;}
double SymbolInfoDouble(string,int field){return field==SYMBOL_VOLUME_MAX?100:.01;}
double AccountInfoDouble(int){return 1000000;}
double MathRound(double value){return std::round(value);}
bool OrderCalcMargin(int,string,double,double,double &margin){margin=10;return true;}
bool OrderCheck(const MqlTradeRequest&,MqlTradeCheckResult &result){checksSent++;result.retcode=0;return true;}
#include "BasketPreflightUnderTest.mqh"
int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"FAILED preflight "<<__LINE__<<": "<<#x<<'\n';return 1;}}while(0)
int main(){
 CSBasketPreflightHarness b;b.conflict=false;b.state.pending=false;b.m_symbol="XAUUSDc";b.m_magic=77;b.m_lot=.01;b.m_deviation=30;
 b.m_h4Ready=true;b.m_tick=.01;b.m_h4Levels={{4400,1,2,0,CS_H4,1}};
 b.m_ipdaReady=true;b.m_ipda.point=.01;b.m_ipda.low[0]=4200;b.m_ipda.high[0]=4260;
 b.m_ipda.low[1]=4200;b.m_ipda.high[1]=4320;b.m_ipda.low[2]=4200;b.m_ipda.high[2]=4360;
 CSMicro micro{};micro.zoneLow=4220;micro.zoneHigh=4230;MqlTick q{};
 CHECK(b.Preflight(1,micro,4240,4400,q)&&b.m_ipdaSelected==1&&checksSent==1);
 // Each invocation obtains a new quote: the next layer can qualify on a different range.
 currentQuote={4269.99,4270};CHECK(b.Preflight(1,micro,4240,4400,q)&&b.m_ipdaSelected==2&&checksSent==2);
 currentQuote={4289.99,4290};CHECK(!b.Preflight(1,micro,4240,4400,q)&&b.error=="SKIP_IPDA_ZONE"&&checksSent==2);
 currentQuote={4249.99,4250};b.m_ipdaReady=false;CHECK(!b.Preflight(1,micro,4240,4400,q)&&checksSent==2);
 b.m_h4Levels.push_back({4222,1,2,0,CS_H4,-1});
 b.m_ipdaReady=true;micro.zoneLow=4270;micro.zoneHigh=4280;currentQuote={4250,4250.01};
 CHECK(b.Preflight(-1,micro,4260,4222,q)&&b.m_ipdaSelected==0&&checksSent==3); // SELL uses Bid, only 20 qualifies.
 b.m_h4Levels.push_back({4280,1,2,0,CS_H4,1});
 micro.zoneLow=4220;micro.zoneHigh=4230;currentQuote={4230,4230.01};
 CHECK(b.Preflight(1,micro,4220,4280,q)&&b.m_ipdaSelected==1); // Bid at 20-midpoint, Ask already premium: choose 40.
 b.m_ipda.high[1]=b.m_ipda.high[0];b.m_ipda.high[2]=b.m_ipda.high[0];auto before=checksSent;
 CHECK(!b.Preflight(1,micro,4230,4280,q)&&b.error=="SKIP_IPDA_ZONE"&&checksSent==before);
 // The original broker/RR gates remain active after zone confluence succeeds.
 currentQuote={4224.99,4225};micro.zoneHigh=4220;b.m_h4Levels.push_back({4230,1,2,0,CS_H4,1});
 CHECK(!b.Preflight(1,micro,4215,4230,q)&&b.error=="SKIP_RR_NEAREST_H4");
 b.m_h4Levels={{4400,1,2,0,CS_H4,1},{4245,1,2,0,CS_H4,1}};b.m_ipda.high[1]=4320;b.m_ipda.high[2]=4360;
 currentQuote={4249.99,4250};CHECK(b.Preflight(1,micro,4220,4400,q));
 currentQuote={4224.99,4225};before=checksSent;
 CHECK(!b.Preflight(1,micro,4220,4400,q)&&b.error=="SKIP_H4_TARGET_CHANGED"&&checksSent==before);
 b.m_h4Ready=false;CHECK(!b.Preflight(1,micro,4220,4245,q)&&b.error=="NO_H4_LIQUIDITY");
 std::cout<<"PASS "<<checks<<" assertions on verbatim production order preflight with fresh-quote IPDA gate (host API adapter; no orders sent)\n";
}
