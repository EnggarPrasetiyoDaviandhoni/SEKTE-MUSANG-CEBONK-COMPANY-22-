#include "host_mt5.hpp"
#include "Forecast.mqh"
#include <iostream>
#include <fstream>
#include <sstream>
static int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"FAILED line "<<__LINE__<<": "<<#x<<'\n';return 1;}}while(0)
std::string read(const char *path){std::ifstream f(path);std::stringstream b;b<<f.rdbuf();return b.str();}
std::string replaceOne(std::string s,const std::string&a,const std::string&b){auto pos=s.find(a);if(pos==std::string::npos)throw std::runtime_error("missing fixture field");s.replace(pos,a.size(),b);return s;}
std::string rehash(std::string raw){auto marker=raw.rfind(",\"payload_sha256\":\"");auto payload=raw.substr(0,marker)+"}";std::vector<uchar> input(payload.begin(),payload.end()),key,digest;CryptEncode(CRYPT_HASH_SHA256,input,key,digest);std::string h;for(auto c:digest)h+=StringFormat("%02x",(int)c).utf8();return payload.substr(0,payload.size()-1)+",\"payload_sha256\":\""+h+"\"}\n";}
int main(int argc,char **argv){
 CHECK(argc==4);std::string raw=read(argv[1]);CKAJson j;
 CHECK(j.Parse(raw)&&j.VerifyHash(raw));datetime now=(datetime)j.Number(j.Get(0,"generated_at_utc"))+1;
 CKAForecast feed;CHECK(feed.Accept(raw,now));CHECK(ArraySize(feed.sessions)==150&&ArraySize(feed.windows)>50);
 CHECK(feed.Covers(feed.horizonStart)&&feed.Covers(feed.horizonEnd));CHECK(!feed.Covers(feed.horizonStart-86400)&&!feed.Covers(feed.horizonEnd+86400));
 CHECK(!feed.Accept(replaceOne(raw,"Sydney","Sidney"),now)&&feed.error=="FORECAST_SHA256");
 CHECK(!feed.Accept(rehash(replaceOne(raw,"Sydney","Sidney")),now)&&feed.error=="FORECAST_SESSION_FIELDS");
 CHECK(!feed.Accept(rehash(replaceOne(raw,"CEBONK_ASTRODOX_V1_SESSION_ONLY","OTHER_MODEL")),now)&&feed.error=="FORECAST_MODEL_FIELDS");
 CHECK(!feed.Accept(raw,now-602)&&feed.error=="FORECAST_FUTURE");
 CHECK(!feed.Accept(rehash(replaceOne(raw,"\"best_index\":0","\"best_index\":-1")),now)&&feed.error=="FORECAST_FOCUS_RANK");
 CHECK(!j.Parse("{\"a\":1,\"a\":2}")&&j.Error()=="JSON_DUPLICATE_KEY");
 for(const char *bad:{"[1,]","{\"a\":01}","[NaN]","[1e309]","[1e]","[1.]","true false","{\"a\":}","{\"x\":\"\\uD800\"}"})CHECK(!j.Parse(bad));
 CHECK(j.Parse("{\"unicode\":\"\\uD83D\\uDE00\",\"n\":-0.1e2,\"a\":[true,null,{}]}"));
 CHECK(j.Text(j.Get(0,"unicode")).utf8()=="\xF0\x9F\x98\x80"&&j.Number(j.Get(0,"n"))==-10);
 CHECK(!j.Parse(std::string(26,'[')+"0"+std::string(26,']')));
 CHECK(CKADateParse("2026-02-30")==0&&CKADateParse("2026-10-19")>0);
 CHECK(CKAUpcomingDay(CKADateParse("2026-10-17"))==CKADateParse("2026-10-19"));
 CHECK(CKANextTradingDay(CKADateParse("2026-10-19"),-1)==CKADateParse("2026-10-16"));
 CHECK(CKAToChart(1000,120)==8200&&CKAToChart(1000,-300)==-17000);
 CHECK(CKAPhase(99,100,150,200)=="UPCOMING");CHECK(CKAPhase(100,100,150,200)=="AWAL");
 CHECK(CKAPhase(150,100,150,200)=="INTI"&&CKAPhase(199,100,150,200)=="INTI");CHECK(CKAPhase(200,100,150,200)=="FINISHED");
 CHECK(CKAPhase(100,100,100,200)=="INTI"); // Source may have zero-duration AWAL.
 CKAForecast mixed;CHECK(mixed.Accept(read(argv[2]),now));
 CHECK(mixed.sessions[0].side==0&&mixed.sessions[0].count==2&&mixed.sessions[0].best==-1);
 CHECK(mixed.sessions[1].side==1&&mixed.sessions[1].best==mixed.sessions[1].first+1);
 auto window=mixed.windows[mixed.sessions[1].best];CHECK(window.core==window.start);
 // UTC schedules independently exported from original JS Intl/IANA code.
 std::ifstream calendar(argv[3]);std::string line;int schedules=0;
 while(std::getline(calendar,line)){
  if(line.empty())continue;std::replace(line.begin(),line.end(),',',' ');std::istringstream row(line);std::string date;int index;long long start,end;row>>date>>index>>start>>end;
  datetime d=CKADateParse(date);int local=index==0?480:index==1?540:index==4?900:480;
  CHECK(start==d+local*60-CKAIanaOffset(d,index)*60&&end==start+(index==4?7200:10800));schedules++;
 }
 CHECK(schedules==60);CHECK(feed.Accept(raw,now));
 std::cout<<"PASS "<<checks<<" assertions on actual standalone MQL forecast/calendar/parser headers; 60 IANA/DST schedules; C++ host, not MetaEditor\n";
}
