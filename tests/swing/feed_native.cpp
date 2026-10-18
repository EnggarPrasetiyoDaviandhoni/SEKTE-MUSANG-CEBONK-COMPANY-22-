#include "host_mt5.hpp"
#include "FeedValidator.mqh"
#include <iostream>
#include <fstream>
#include <sstream>
#include <regex>
static int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"FAILED native feed line "<<__LINE__<<": "<<#x<<'\n';return 1;}}while(0)
std::string replaceOne(std::string s,const std::string&a,const std::string&b){auto pos=s.find(a);if(pos==std::string::npos)throw std::runtime_error("missing fixture field");s.replace(pos,a.size(),b);return s;}
std::string rehash(std::string raw){auto marker=raw.rfind(",\"payload_sha256\":\"");auto payload=raw.substr(0,marker)+"}";std::vector<uchar> input(payload.begin(),payload.end()),key,digest;CryptEncode(CRYPT_HASH_SHA256,input,key,digest);std::string h;for(auto c:digest)h+=StringFormat("%02x",(int)c).utf8();return payload.substr(0,payload.size()-1)+",\"payload_sha256\":\""+h+"\"}\n";}
int main(int argc,char **argv){
 CHECK(argc==2);std::ifstream in(argv[1]);std::stringstream buffer;buffer<<in.rdbuf();std::string raw=buffer.str();CSJson j;
 CHECK(j.Parse(raw)&&j.VerifyHash(raw));datetime now=(datetime)j.Number(j.Get(0,"generated_at_utc"));
 CSFeed feed;if(!feed.Accept(raw,now+1)){std::cerr<<feed.error.utf8()<<'\n';return 1;}CHECK(feed.Valid(now+1));CHECK(ArraySize(feed.sessions)==25&&ArraySize(feed.days)==5&&ArraySize(feed.moon)==193);
 CHECK(!feed.Accept(raw,now+108001)&&feed.error=="FEED_STALE_FUTURE");
 CHECK(!feed.Accept(replaceOne(raw,"MUSANG_EL2_IB_CB1_RETEST","OTHER_MODEL"),now));CHECK(feed.error=="FEED_SHA256");
 CHECK(!feed.Accept(rehash(replaceOne(raw,"MUSANG_EL2_IB_CB1_RETEST","OTHER_MODEL")),now)&&feed.error=="FEED_MODEL");
 auto drift=raw;std::regex pattern("\\\"session_start_utc\\\":([0-9]+)");std::smatch match;CHECK(std::regex_search(drift,match,pattern));auto old=match.str(1);drift=replaceOne(drift,"\"session_start_utc\":"+old,"\"session_start_utc\":"+std::to_string(std::stoll(old)+3600));
 CHECK(!feed.Accept(rehash(drift),now)&&feed.error=="FEED_SESSION_DST_SCHEDULE");
 CHECK(!j.Parse("{\"a\":1,\"a\":2}")&&j.Error()=="JSON_DUPLICATE_KEY");
 CHECK(!j.Parse("{\"a\":1,\"\\u0061\":2}")&&j.Error()=="JSON_DUPLICATE_KEY");
 for(const char *bad:{"[1,]","{\"a\":01}","[NaN]","[1e309]","[1e]","[1.]","true false","{\"a\":}","{\"x\":\"\\uD800\"}"})CHECK(!j.Parse(bad));
 CHECK(j.Parse("{\"unicode\":\"\\uD83D\\uDE00\",\"n\":-0.1e2,\"a\":[true,null,{}]}"));
 CHECK(j.Text(j.Get(0,"unicode")).utf8()=="\xF0\x9F\x98\x80");CHECK(j.Number(j.Get(0,"n"))==-10);
 CHECK(j.Kind(j.At(j.Get(0,"a"),1))==CSJ_NULL);
 CHECK(!j.Parse(std::string(26,'[')+"0"+std::string(26,']')));
 CHECK(CSDateParse("2026-02-30")==0&&CSDateParse("2026-10-17")>0);
 CHECK(CSIanaOffset(CSDateParse("2026-03-06"),3)==-300&&CSIanaOffset(CSDateParse("2026-03-09"),3)==-240);
 CHECK(CSIanaOffset(CSDateParse("2026-03-27"),2)==0&&CSIanaOffset(CSDateParse("2026-03-30"),2)==60);
 CHECK(CSIanaOffset(CSDateParse("2026-04-03"),0)==660&&CSIanaOffset(CSDateParse("2026-04-06"),0)==600);
 CSFeed gates;ArrayResize(gates.days,1);gates.days[0].date="2026-10-19";gates.days[0].weekly=1;gates.days[0].daily=1;
 ArrayResize(gates.sessions,1);gates.sessions[0].date="2026-10-19";gates.sessions[0].direction=1;gates.sessions[0].windowStart=1000;gates.sessions[0].windowEnd=2000;gates.sessions[0].sessionId="london";
 CHECK(gates.Owner(1000,1)==0&&gates.Owner(1999,1)==0&&gates.Owner(2000,1)==-1);
 gates.days[0].daily=-1;CHECK(gates.Owner(1500,1)==-1);gates.days[0].daily=1;gates.days[0].weekly=-1;CHECK(gates.Owner(1500,1)==0); // Updated feed cannot overturn persisted BUY lock.
 gates.sessions[0].direction=-1;CHECK(gates.Owner(1500,1)==-1); // Opposite session always WAIT.
 gates.days[0].daily=-1;CHECK(gates.Owner(1500,-1)==0&&gates.Owner(1500,0)==-1);
 CHECK(!feed.Accept(rehash(replaceOne(raw,"\"total_slots\":2016","\"total_slots\":1728")),now)&&feed.error=="FEED_WEEKLY_STRENGTH");
 CHECK(!feed.Accept(rehash(replaceOne(raw,"\"min_share\":0.55","\"min_share\":0.5")),now)&&feed.error=="FEED_WEEKLY_STRENGTH");
 CHECK(feed.Accept(raw,now));std::cout<<"PASS "<<checks<<" assertions on actual MQL JSON/feed logic via host API adapter (not MetaEditor)\n";
}
