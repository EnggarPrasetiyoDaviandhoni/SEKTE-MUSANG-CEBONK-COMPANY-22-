#include "../../MQL5/Include/CebonkSwing/NumericCore.mqh"
#include <cassert>
#include <iostream>
#include <limits>
static int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"FAILED line "<<__LINE__<<": "<<#x<<'\n';return 1;}}while(0)
CSBar bar(int i,double o,double h,double l,double c,int seconds=300){return {1700000000LL+i*seconds,o,h,l,c};}
bool near(double a,double b){return std::abs(a-b)<1e-8;}
int main(){
 double raw=0,sl=0;
 CHECK(CSSL(1,3299.1,3300,3300,3310,.01,-.236,raw,sl)&&near(sl,3297.64));
 CHECK(CSSL(-1,3300,3300.9,3300,3290,.01,-.236,raw,sl)&&near(sl,3302.36));
 CHECK(CSSL(1,3299.1,3300,3300,3310,.01,-.382,raw,sl)&&near(raw,3296.18)&&near(sl,3296.18));
 CHECK(CSSL(-1,3300,3300.9,3300,3290,.01,-.382,raw,sl)&&near(raw,3303.82)&&near(sl,3303.82));
 CHECK(CSSL(1,3299.1,3300,3300,3310,.01,-.618,raw,sl)&&near(sl,3293.82));
 CHECK(CSSL(-1,3300,3300.9,3300,3290,.01,-.618,raw,sl)&&near(sl,3306.18));
 CHECK(CSSL(1,3299.1,3300,3300,3310,.01,-1,raw,sl)&&near(sl,3290));
 CHECK(CSSL(-1,3300,3300.9,3300,3290,.01,-1,raw,sl)&&near(sl,3310));
 CHECK(!CSSL(1,3296,3300,3300,3310,.01,-.236,raw,sl));
 CHECK(!CSSL(-1,3300,3305,3300,3290,.01,-.236,raw,sl));
 CHECK(!CSSL(1,3299,3300,3300,3290,.01,-.236,raw,sl));
 CHECK(!CSSL(1,3299,3300,3300,3300.001,.01,-.236,raw,sl));
 for(double level:{0.,.236,std::nan(""),std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity()}){
  CHECK(!CSSL(1,3299.1,3300,3300,3310,.01,level,raw,sl));
  CHECK(!CSSL(-1,3300,3300.9,3300,3290,.01,level,raw,sl));
 }
 CHECK(!CSSL(1,3299.1,3300,3300,3310,.01,-std::numeric_limits<double>::max(),raw,sl));
 CHECK(!CSSL(1,3299.1,3300,3300,3310,.01,-.05,raw,sl)); // Inside IB despite a negative level.
 CHECK(!CSSL(1,1,2,1,11,.01,-1,raw,sl)); // Nonpositive price cannot become a server SL.
 for(double tick:{.001,.01,.1})for(double level:{-.236,-.382,-.618}){
  CHECK(CSSL(1,3299.1,3300,3300,3310,tick,level,raw,sl)&&sl<=raw+1e-9&&raw-sl<tick+1e-8);
  CHECK(CSSL(-1,3300,3300.9,3300,3290,tick,level,raw,sl)&&sl>=raw-1e-9&&sl-raw<tick+1e-8);
 }
 std::vector<CSBar> exit={bar(0,3316,3320,3305,3314),bar(1,3312,3319,3306,3311),bar(2,3313,3318,3307,3310),bar(3,3315,3319,3307,3314),bar(4,3307,3308,3303,3304.9)};
 CSDominant dominant;
 CHECK(CSDominantExit(exit,.1,3,12,dominant)&&dominant.side==-1&&dominant.children==3);
 auto wick=exit;wick.back()=bar(4,3310,3311,3301,3308);CHECK(!CSDominantExit(wick,.1,3,12,dominant));
 auto two=exit;two.erase(two.begin()+1);CHECK(!CSDominantExit(two,.1,3,12,dominant));
 auto outside=exit;outside[2].high=3320.1;CHECK(!CSDominantExit(outside,.1,3,12,dominant));
 auto bull=exit;bull.back()=bar(4,3318,3323,3315,3320.1);CHECK(CSDominantExit(bull,.1,3,12,dominant)&&dominant.side==1);
 std::vector<CSBar> micro={
  bar(0,99,101,98,100),bar(1,100,102,99,101),bar(2,101,104,100,102),
  bar(3,102,110,101,105),bar(4,104,106,100,102),bar(5,102,104,99,100),
  bar(6,100,102,98,101),bar(7,101,104,99,103),bar(8,103,106,100,104),
  bar(9,104,109,101,108),bar(10,108,113,107,112),bar(11,112,116,111,115),
  bar(12,115,120,113,116),bar(13,116,118,111,114),bar(14,114,117,110,112),
  bar(15,112,119,111,118),bar(16,118,122,117,121),bar(17,99.5,102,99,101)};
 CSMicro m,custom;datetime gate=micro[9].time+300,end=gate+7200;
 CHECK(CSM5EL2(micro,1,gate,end,.01,16,12,12,-.236,m));
 CHECK(m.kind==2&&m.source==micro[6].time&&m.ibClose==micro[10].time+300&&m.cb1Pivot==micro[12].time);
 CHECK(m.breakClose==micro[16].time+300&&near(m.fib0,100)&&near(m.fib1,121)&&near(m.sl,95.04));
 CHECK(CSM5EL2(micro,1,gate,end,.01,16,12,12,-.618,custom)&&near(custom.slRaw,87.022)&&near(custom.sl,87.02));
 CHECK(custom.source==m.source&&custom.breakClose==m.breakClose&&custom.retestClose==m.retestClose);
 CHECK(CSRR(1,101,m.sl,115)>=2&&CSRR(1,101,custom.sl,115)<2);
 for(double level:{0.,.236,std::nan(""),std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity()})
  CHECK(!CSM5EL2(micro,1,gate,end,.01,16,12,12,level,custom));
 CHECK(CSPriceAfterEL2Retest(1,100.9,101,m)&&!CSPriceAfterEL2Retest(1,99,99.1,m));
 auto noRetest=micro;noRetest.pop_back();CHECK(!CSM5EL2(noRetest,1,gate,end,.01,16,12,12,-.236,m));
 auto wickBreak=micro;wickBreak[16].close=119;CHECK(!CSM5EL2(wickBreak,1,gate,end,.01,16,12,12,-.236,m));
 CHECK(!CSM5EL2(micro,1,gate,micro.back().time+300,.01,16,12,12,-.236,m));
 auto replay=micro;replay.push_back(bar(18,101,104,99,103));CHECK(!CSM5EL2(replay,1,gate,end,.01,16,12,12,-.236,m));
 auto invalid=micro;invalid[15]=bar(15,112,119,96,97);CHECK(!CSM5EL2(invalid,1,gate,end,.01,16,12,12,-.236,m));
 auto noReject=micro;noReject.back()=bar(17,99,101,98.5,100);CHECK(!CSM5EL2(noReject,1,gate,end,.01,16,12,12,-.236,m));
 auto noCB1=micro;noCB1[13].high=121;noCB1[14].high=122;noCB1[15].high=123;
 CHECK(!CSM5EL2(noCB1,1,gate,end,.01,16,12,12,-.236,m));
 CHECK(!CSM5EL2(micro,1,gate,end,.01,16,5,12,-.236,m));
 CHECK(!CSM5EL2(micro,1,gate,end,.01,16,12,0,-.236,m));
 auto sell=micro;for(auto &b:sell){b.open=250-b.open;b.close=250-b.close;double hi=250-b.low;b.low=250-b.high;b.high=hi;}
 CHECK(CSM5EL2(sell,-1,gate,end,.01,16,12,12,-.236,m)&&m.side==-1&&near(m.sl,154.96));
 CHECK(near(m.fib0,150)&&near(m.fib1,129)&&m.sl>m.zoneHigh);
 CHECK(CSM5EL2(sell,-1,gate,end,.01,16,12,12,-.618,custom)&&near(custom.slRaw,162.978)&&near(custom.sl,162.98));
 CHECK(!CSPivot(micro,12,2,2,1,13)&&CSPivot(micro,12,2,2,1,14));
 CHECK(near(CSRR(1,100,99,102),2)&&near(CSRR(-1,100,101,98),2)&&CSRR(1,100,101,102)<0);
 CHECK(CSShouldExit(1,-1,12,true)&&CSShouldExit(-1,1,9,true));
 CHECK(!CSShouldExit(1,-1,0,true)&&!CSShouldExit(1,-1,-1,true));
 CHECK(!CSShouldExit(1,1,12,true)&&!CSShouldExit(1,-1,12,false));
 CHECK(!CSShouldExit(1,-1,std::nan(""),true));
 CHECK(near(CSDealNetContribution(100,-1,-2,-.5),96.5));
 double basketNet=CSDealNetContribution(-100,-1,-2,0)+20-1-.5;
 CHECK(near(basketNet,-84.5)&&!CSShouldExit(1,-1,basketNet,true));
 CHECK(!CSShouldExit(1,-1,CSDealNetContribution(-30,0,-1,0)+20,true)); // Partial close P/L also counts.
 CSWeekLatch weekly;weekly.Clear();datetime monday=1800000000;
 CHECK(weekly.Capture(monday,-1,monday+60)&&weekly.side==-1);
 CHECK(!weekly.Capture(monday,1,monday+86400)&&weekly.side==-1); // Feed/day change cannot flip.
 CSWeekLatch restarted=weekly;CHECK(!restarted.Capture(monday,1,monday+172800)&&restarted.side==-1);
 CHECK(!weekly.Capture(monday-604800,1,monday+100));
 CHECK(weekly.Capture(monday+604800,1,monday+604801)&&weekly.side==1);
 CHECK(weekly.Capture(monday+1209600,0,monday+1209601)&&weekly.side==0);
 CHECK(!weekly.Capture(monday+1209600,1,monday+1209700)&&weekly.side==0); // WAIT is a weekly lock too.
 CHECK(!weekly.Capture(monday+1814400,1,monday+1814399));
 CHECK(CSAligned(-1,-1,-1)&&!CSAligned(-1,1,-1)&&!CSAligned(-1,-1,1)&&!CSAligned(0,1,1));
 CHECK(CSStrengthSide(600,400,360,.55,360)==1&&CSStrengthSide(400,600,360,.55,360)==-1);
 CHECK(CSStrengthSide(500,500,360,.55,360)==0&&CSStrengthSide(540,460,360,.55,360)==0);
 CHECK(CSStrengthSide(900,100,355,.55,360)==0&&CSStrengthSide(550,450,360,.55,360)==1);
 for(uint code:{10009u,10010u})CHECK(CSOrderOutcome(code)==CS_ORDER_FILLED);
 for(uint code:{10004u,10006u,10016u,10019u,10020u,10021u})CHECK(CSOrderOutcome(code)==CS_ORDER_REJECTED);
 for(uint code:{0u,10008u,10011u,10012u,10023u,10025u,10028u,10031u,99999u})CHECK(CSOrderOutcome(code)==CS_ORDER_UNKNOWN);
 int awal=0,inti=0;CHECK(CSReserveLayer(false,awal,inti)&&awal==1);
 CSReleaseLayer(false,awal,inti);CHECK(awal==0&&inti==0); // Rejected first request leaves both slots.
 CHECK(CSReserveLayer(false,awal,inti)&&CSReserveLayer(false,awal,inti)&&!CSReserveLayer(false,awal,inti));
 CHECK(CSReserveLayer(true,awal,inti)&&CSReserveLayer(true,awal,inti)&&!CSReserveLayer(true,awal,inti));
 CSReleaseLayer(true,awal,inti);CHECK(awal==2&&inti==1); // Failed second INTI cannot erase filled AWAL.
 CHECK(CSReserveLayer(true,awal,inti)&&awal+inti==4);
 CHECK(CSRiskCap(10,1000,1)&&!CSRiskCap(10.01,1000,1));
 CHECK(!CSRiskCap(0,0,1)&&!CSRiskCap(1,1000,1.01));
 std::vector<CSBar> trend;
 for(int i=0;i<160;i++){double c=100+i*.1+5*std::sin(i*3.141592653589793/10);trend.push_back(bar(i,c,c+1,c-1,c,14400));}
 CHECK(CSH4Direction(trend)==1);for(auto &b:trend){b.open=250-b.open;b.close=250-b.close;double h=250-b.low;b.low=250-b.high;b.high=h;}
 CHECK(CSH4Direction(trend)==-1);
 std::vector<CSBar> h1;for(int i=0;i<160;i++)h1.push_back(bar(i,100,106,97,103,3600));
 h1[150]=bar(150,99,104,90,98,3600);h1[152]=bar(152,103,110,98,104,3600);
 h1[157]=bar(157,103,108,98,104,3600);h1[158]=bar(158,111,120,110,119,3600);h1[159]=bar(159,116,121,115,118,3600);
 std::vector<CSLevel> levels;std::vector<CSSetup> setups;
 CSH1Setups(h1,levels,1,1,.01,.1,h1.back().time+3600,setups);
 CHECK(!setups.empty()&&setups.front().model==2&&near(setups.front().low,108)&&near(setups.front().high,115));
 CSH1Setups(h1,levels,1,0,.01,.1,h1.back().time+3600,setups);CHECK(setups.empty());
 CSH1Setups(h1,levels,1,-1,.01,.1,h1.back().time+3600,setups);CHECK(setups.empty());
 auto lookahead=micro;lookahead.push_back(bar(18,100,500,1,110));CHECK(CSPivot(lookahead,12,2,2,1,14));
 CHECK(CSValidBars(micro));auto bad=micro;bad[0].high=90;CHECK(!CSValidBars(bad));
 std::cout<<"PASS "<<checks<<" assertions on the actual shared MQL numeric engine (C++ host, not MetaEditor)\n";
}
