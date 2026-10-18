#ifndef CEBONK_SWING_POLICY_CORE_MQH
#define CEBONK_SWING_POLICY_CORE_MQH
#include "Types.mqh"
// Pure policies shared by MT5 and host regression tests.
struct CSWeekLatch {
 datetime monday,captured;int side;
 void Clear(){monday=0;captured=0;side=0;}
 bool CanCapture(datetime week,int direction,datetime now){
  return week>0&&week>monday&&direction>=-1&&direction<=1&&now>=week&&now<week+604800;
 }
 bool Capture(datetime week,int direction,datetime now){
  if(!CanCapture(week,direction,now))return false;
  monday=week;side=direction;captured=now;return true;
 }
 bool Current(datetime week){return monday==week&&week>0;}
};
bool CSAligned(int locked,int session){return locked*locked==1&&session==locked;}
int CSStrengthSide(double buy,double sell,int minutes,double minShare,int minMinutes){
 if(!CSFinite(buy)||!CSFinite(sell)||buy<0||sell<0||minShare<=0.5||minShare>1||minutes<minMinutes)return 0;
 double total=buy+sell;if(total<=0||MathAbs(buy-sell)<=total*1e-12)return 0;
 return CSMax(buy,sell)/total+1e-12>=minShare?(buy>sell?1:-1):0;
}
enum CSOrderDisposition {CS_ORDER_UNKNOWN=0,CS_ORDER_FILLED=1,CS_ORDER_REJECTED=2};
int CSOrderOutcome(uint code){
 if(code==10009||code==10010)return CS_ORDER_FILLED;
 // Only explicit server rejections release a reserved layer. Timeouts, placed,
 // connection loss, locked requests and generic errors remain pending.
 switch(code){
  case 10004:case 10006:case 10007:case 10013:case 10014:case 10015:
  case 10016:case 10017:case 10018:case 10019:case 10020:case 10021:
  case 10022:case 10024:case 10026:case 10027:case 10029:case 10030:
  case 10032:case 10033:case 10034:case 10035:case 10042:case 10043:
  case 10044:case 10045:case 10046:return CS_ORDER_REJECTED;
 }return CS_ORDER_UNKNOWN;
}
bool CSReserveLayer(int &layers){
 if(layers<0||layers>=4)return false;
 layers++;return true;
}
void CSReleaseLayer(int &layers){if(layers>0)layers--;}
#endif
