#include "../../MQL5/Include/CebonkSwing/NumericCore.mqh"
#include <cassert>
#include <iostream>
static int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"FAILED line "<<__LINE__<<": "<<#x<<'\n';return 1;}}while(0)
CSBar bar(int i,double o,double h,double l,double c,int seconds=300){return {1700000000LL+i*seconds,o,h,l,c};}
bool near(double a,double b){return std::abs(a-b)<1e-8;}
int main(){
 double raw=0,sl=0;
 CHECK(CSSL(1,3299.1,3300,3300,3310,.01,raw,sl)&&near(sl,3297.64));
 CHECK(CSSL(-1,3300,3300.9,3300,3290,.01,raw,sl)&&near(sl,3302.36));
 CHECK(!CSSL(1,3296,3300,3300,3310,.01,raw,sl));
 CHECK(!CSSL(-1,3300,3305,3300,3290,.01,raw,sl));
 CHECK(!CSSL(1,3299,3300,3300,3290,.01,raw,sl));
 CHECK(!CSSL(1,3299,3300,3300,3300.001,.01,raw,sl));
 for(double tick:{.001,.01,.1}){
  CHECK(CSSL(1,3299.1,3300,3300,3310,tick,raw,sl)&&sl<=raw+1e-9&&raw-sl<tick+1e-8);
  CHECK(CSSL(-1,3300,3300.9,3300,3290,tick,raw,sl)&&sl>=raw-1e-9&&sl-raw<tick+1e-8);
 }
 std::vector<CSBar> exit={bar(0,3316,3320,3305,3314),bar(1,3312,3319,3306,3311),bar(2,3313,3318,3307,3310),bar(3,3315,3319,3307,3314),bar(4,3307,3308,3303,3304.9)};
 CSDominant dominant;
 CHECK(CSDominantExit(exit,.1,3,12,dominant)&&dominant.side==-1&&dominant.children==3);
 auto wick=exit;wick.back()=bar(4,3310,3311,3301,3308);CHECK(!CSDominantExit(wick,.1,3,12,dominant));
 auto two=exit;two.erase(two.begin()+1);CHECK(!CSDominantExit(two,.1,3,12,dominant));
 auto outside=exit;outside[2].high=3320.1;CHECK(!CSDominantExit(outside,.1,3,12,dominant));
 auto bull=exit;bull.back()=bar(4,3318,3323,3315,3320.1);CHECK(CSDominantExit(bull,.1,3,12,dominant)&&dominant.side==1);
 std::vector<CSBar> micro;for(int i=0;i<20;i++)micro.push_back(bar(i,100,101,99,100));
 micro.push_back(bar(20,110,111,99,100));micro.push_back(bar(21,103,105,101,102));micro.push_back(bar(22,102,106,100,104));micro.push_back(bar(23,104,107,101,105));
 micro.push_back(bar(24,105,113,104,112));micro.push_back(bar(25,101,105,100,103));
 CSMicro m;datetime gate=micro[20].time,end=gate+7200;
 CHECK(CSM5CBR(micro,1,gate,end,.01,3,12,96,16,12,m));
 CHECK(m.kind==1&&m.source==micro[20].time&&m.breakClose==micro[24].time+300&&near(m.fib0,100)&&near(m.fib1,112)&&near(m.sl,97.16));
 CHECK(CSPriceInIB(1,102.9,103,m)&&!CSPriceInIB(1,110,110.1,m));
 auto noRetest=micro;noRetest.pop_back();CHECK(!CSM5CBR(noRetest,1,gate,end,.01,3,12,96,16,12,m));
 auto wickBreak=micro;wickBreak[24].close=109;CHECK(!CSM5CBR(wickBreak,1,gate,end,.01,3,12,96,16,12,m));
 auto expired=micro;CHECK(!CSM5CBR(expired,1,gate,expired.back().time+300,.01,3,12,96,16,12,m));
 auto replay=micro;replay.push_back(bar(26,103,105,101,104));CHECK(!CSM5CBR(replay,1,gate,end,.01,3,12,96,16,12,m));
 auto invalid=micro;invalid.insert(invalid.end()-1,bar(25,100,101,98,99));invalid.back().time+=300;CHECK(!CSM5CBR(invalid,1,gate,end,.01,3,12,96,16,12,m));
 auto sell=micro;for(auto &b:sell){b.open=250-b.open;b.close=250-b.close;double hi=250-b.low;b.low=250-b.high;b.high=hi;}
 CHECK(CSM5CBR(sell,-1,gate,end,.01,3,12,96,16,12,m)&&m.side==-1&&m.sl>m.zoneHigh);
 // SnR alternative: no containing dominant candle; resistance existed before break.
 std::vector<CSBar> snr;for(int i=0;i<23;i++)snr.push_back(bar(i,99,102,97,100));
 snr.push_back(bar(23,101,108,96,100));snr.push_back(bar(24,100,103,96,99));snr.push_back(bar(25,99,102,95,98));
 snr.push_back(bar(26,94,96,90,92));snr.push_back(bar(27,98,101,94,99));snr.push_back(bar(28,99,103,95,100));
 snr.push_back(bar(29,100,110,99,109));snr.push_back(bar(30,92.5,95,92,93.5));
 CHECK(CSM5CBR(snr,1,snr[23].time,end+3600,.01,3,12,96,16,12,m)&&m.kind==2&&near(m.breakLevel,108)&&near(m.fib0,92));
 auto longDominant=micro;longDominant.resize(24);for(int i=24;i<35;i++)longDominant.push_back(bar(i,103,107,101,104));
 CHECK(CSHasDominant(longDominant,34,3,96));
 CHECK(!CSPivot(snr,23,2,2,1,24)&&CSPivot(snr,23,2,2,1,25));
 CHECK(near(CSRR(1,100,99,102),2)&&near(CSRR(-1,100,101,98),2)&&CSRR(1,100,101,102)<0);
 CHECK(CSShouldExit(1,-1,12,true)&&CSShouldExit(-1,1,9,true));
 CHECK(!CSShouldExit(1,-1,0,true)&&!CSShouldExit(1,-1,-1,true));
 CHECK(!CSShouldExit(1,1,12,true)&&!CSShouldExit(1,-1,12,false));
 CHECK(!CSShouldExit(1,-1,std::nan(""),true));
 CHECK(near(CSDealNetContribution(100,-1,-2,-.5,false),-2.5));
 CHECK(near(CSDealNetContribution(100,-1,-2,-.5,true),96.5));
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
 auto lookahead=snr;lookahead.push_back(bar(31,100,500,1,110));CHECK(CSPivot(lookahead,23,2,2,1,25));
 CHECK(CSValidBars(micro));auto bad=micro;bad[0].high=90;CHECK(!CSValidBars(bad));
 std::cout<<"PASS "<<checks<<" assertions on the actual shared MQL numeric engine (C++ host, not MetaEditor)\n";
}
