// Tests the verbatim production CSBasket::Net body, selected by the host runner.
// This adapter models history/position responses; it is not a broker simulator.
#include "host_mt5.hpp"
#include "../../MQL5/Include/CebonkSwing/NumericCore.mqh"
#include <map>
#include <iostream>
using ulong=unsigned long;
struct Deal {double profit,swap,commission,fee;long magic,type;};
struct Position {long id,magic;double volume,open,swap;};
std::map<long,std::vector<Deal>> deals;
std::vector<Position> live;
long historyId=0;int selected=-1;bool quoteGood=true;
constexpr int DEAL_TYPE=1,DEAL_MAGIC=2,DEAL_PROFIT=3,DEAL_SWAP=4,DEAL_COMMISSION=5,DEAL_FEE=6;
constexpr int DEAL_TYPE_BUY=0,DEAL_TYPE_SELL=1,POSITION_IDENTIFIER=7,POSITION_VOLUME=8,POSITION_TYPE=9,POSITION_PRICE_OPEN=10,POSITION_SWAP=11;
constexpr int POSITION_TYPE_BUY=0,ORDER_TYPE_BUY=0,ORDER_TYPE_SELL=1;
struct MqlTick {double bid=120,ask=120.1;};
bool SymbolInfoTick(string,MqlTick &q){q.bid=120;q.ask=120.1;return quoteGood;}
bool HistorySelectByPosition(long id){historyId=id;return deals.count(id)>0;}
int HistoryDealsTotal(){return (int)deals[historyId].size();}
ulong HistoryDealGetTicket(int i){return i+1;}
long HistoryDealGetInteger(ulong t,int field){auto &d=deals[historyId][t-1];return field==DEAL_MAGIC?d.magic:d.type;}
double HistoryDealGetDouble(ulong t,int field){auto &d=deals[historyId][t-1];switch(field){case DEAL_PROFIT:return d.profit;case DEAL_SWAP:return d.swap;case DEAL_COMMISSION:return d.commission;default:return d.fee;}}
int PositionsTotal(){return (int)live.size();}
ulong PositionGetTicket(int i){selected=i;return i+1;}
long PositionGetInteger(int field){return field==POSITION_IDENTIFIER?live[selected].id:POSITION_TYPE_BUY;}
double PositionGetDouble(int field){auto &p=live[selected];return field==POSITION_VOLUME?p.volume:field==POSITION_PRICE_OPEN?p.open:p.swap;}
bool OrderCalcProfit(int,string,double volume,double open,double close,double &profit){profit=(close-open)*volume;return true;}
#include "BasketNetUnderTest.mqh"
int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"basket NET fail line "<<__LINE__<<'\n';return 1;}}while(0)
int main(){
 CSBasketNetHarness b;b.m_symbol="XAUUSD";b.m_magic=22;b.m_fee=.5;b.conflict=false;b.positions=1;b.state.ids={11,12};
 deals[11]={{-100,-1,-2,0,22,DEAL_TYPE_BUY}};deals[12]={{0,0,-.5,0,22,DEAL_TYPE_BUY}};
 live={{12,22,1,100,-.25}};double value=0;
 CHECK(b.Net(value)&&std::abs(value+84.25)<1e-8); // Closed -103, entry -.5, floating +20, swap -.25, estimated exit -.5.
 CHECK(!CSShouldExit(1,-1,value,true));
 b.state.ids={12};deals[12].push_back({-30,-1,-.5,0,22,DEAL_TYPE_SELL});
 CHECK(b.Net(value)&&std::abs(value+12.75)<1e-8); // Partial close history of still-open ID must count.
 deals[12][1].profit=40;CHECK(b.Net(value)&&value>0);
 b.m_fee=-1;CHECK(!b.Net(value));b.m_fee=.5;
 b.conflict=true;CHECK(!b.Net(value));b.conflict=false;
 deals[12][1].magic=99;CHECK(!b.Net(value));deals[12][1].magic=22;
 b.state.ids.push_back(999);CHECK(!b.Net(value));b.state.ids={12};
 CHECK(!b.Net(value,true)); // Realized report only after flat.
 live.clear();b.positions=0;quoteGood=false;
 CHECK(b.Net(value,true)&&std::abs(value-38)<1e-8); // Final history only, no second estimated exit cost, no quote needed.
 std::cout<<"PASS "<<checks<<" assertions on verbatim production basket NET method (host broker API adapter)\n";
}
