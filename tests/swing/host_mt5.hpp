// Test adapter for the actual MQL JSON/feed code. Not a terminal SDK or MQL compiler.
#pragma once
#include <string>
#include <vector>
#include <codecvt>
#include <locale>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <algorithm>
#include <tuple>
#include <openssl/sha.h>
class CSString {
public:
 std::u16string value;
 CSString()=default;
 CSString(const char *s):CSString(std::string(s)){}
 CSString(const std::string &s){std::wstring_convert<std::codecvt_utf8_utf16<char16_t>,char16_t> cv;value=cv.from_bytes(s);}
 explicit CSString(const std::u16string &s):value(s){}
 std::string utf8()const{std::wstring_convert<std::codecvt_utf8_utf16<char16_t>,char16_t> cv;return cv.to_bytes(value);}
 CSString &operator+=(const CSString &s){value+=s.value;return *this;}
 friend CSString operator+(CSString a,const CSString &b){a+=b;return a;}
 friend bool operator==(const CSString&a,const CSString&b){return a.value==b.value;}
 friend bool operator!=(const CSString&a,const CSString&b){return !(a==b);}
};
using string=CSString;using ushort=unsigned short;using uchar=unsigned char;
#include "../../MQL5/Include/CebonkSwing/Types.mqh"
template<class T> int ArrayResize(std::vector<T>&v,int n,int reserve){if(n>(int)v.capacity())v.reserve(((n+reserve-1)/reserve)*reserve);v.resize(n);return n;}
template<class T> int ArrayCopy(std::vector<T>&dest,const std::vector<T>&src){dest=src;return (int)dest.size();}
inline int StringLen(const string&s){return (int)s.value.size();}
inline ushort StringGetCharacter(const string&s,int i){return i>=0&&i<StringLen(s)?s.value[i]:0;}
inline string ShortToString(ushort c){return string(std::u16string(1,(char16_t)c));}
inline string StringSubstr(const string&s,int pos,int count=-1){if(pos<0||pos>StringLen(s))return "";return string(s.value.substr(pos,count<0?std::u16string::npos:(size_t)count));}
inline int StringFind(const string&s,const string&what,int pos=0){auto i=s.value.find(what.value,(size_t)pos);return i==std::u16string::npos?-1:(int)i;}
inline void StringTrimRight(string&s){while(!s.value.empty()&&s.value.back()<=32)s.value.pop_back();}
inline int StringReplace(string&s,const string&from,const string&to){int n=0;size_t p=0;while((p=s.value.find(from.value,p))!=std::u16string::npos){s.value.replace(p,from.value.size(),to.value);p+=to.value.size();n++;}return n;}
inline int StringSplit(const string&s,ushort delimiter,std::vector<string>&out){out.clear();size_t start=0;for(size_t i=0;i<=s.value.size();i++)if(i==s.value.size()||s.value[i]==delimiter){out.push_back(string(s.value.substr(start,i-start)));start=i+1;}return (int)out.size();}
inline double StringToDouble(const string&s){return std::strtod(s.utf8().c_str(),nullptr);}
inline long long StringToInteger(const string&s){return std::strtoll(s.utf8().c_str(),nullptr,10);}
inline string IntegerToString(long long n){return string(std::to_string(n));}
inline std::string CSFormatStore(const string &s){return s.utf8();}
template<class T> T CSFormatStore(T value){return value;}
inline const char *CSFormatValue(const std::string &s){return s.c_str();}
template<class T> T CSFormatValue(T value){return value;}
template<class... Args> string StringFormat(const string&format,Args... args){
 auto f=format.utf8();for(const auto &pair:{std::pair<std::string,std::string>{"%I64d","%lld"},{"%I64u","%llu"}})
  for(auto pos=f.find(pair.first);pos!=std::string::npos;pos=f.find(pair.first,pos+pair.second.size()))f.replace(pos,pair.first.size(),pair.second);
 auto values=std::make_tuple(CSFormatStore(args)...);
 return std::apply([&](const auto &...stored){int n=std::snprintf(nullptr,0,f.c_str(),CSFormatValue(stored)...);
  std::vector<char> out(n+1);std::snprintf(out.data(),out.size(),f.c_str(),CSFormatValue(stored)...);return string(std::string(out.data(),n));},values);
}
inline string DoubleToString(double value,int digits=8){return StringFormat("%.*f",digits,value);}
inline int StringCompare(const string&a,const string&b){return a.value<b.value?-1:a.value>b.value?1:0;}
constexpr int WHOLE_ARRAY=-1,CP_UTF8=65001,CRYPT_HASH_SHA256=1;
inline int StringToCharArray(const string&s,std::vector<uchar>&out,int start=0,int count=WHOLE_ARRAY,int cp=CP_UTF8){(void)start;(void)count;(void)cp;auto b=s.utf8();out.assign(b.begin(),b.end());out.push_back(0);return (int)out.size();}
inline int CryptEncode(int method,const std::vector<uchar>&input,const std::vector<uchar>&key,std::vector<uchar>&out){(void)key;if(method!=CRYPT_HASH_SHA256)return -1;out.resize(32);SHA256(input.data(),input.size(),out.data());return 32;}
struct MqlDateTime {int year,mon,day,hour,min,sec,day_of_week,day_of_year;};
inline bool TimeToStruct(datetime t,MqlDateTime&out){std::time_t value=t;std::tm tm{};if(!gmtime_r(&value,&tm))return false;out={tm.tm_year+1900,tm.tm_mon+1,tm.tm_mday,tm.tm_hour,tm.tm_min,tm.tm_sec,tm.tm_wday,tm.tm_yday};return true;}
inline datetime StringToTime(const string&s){std::tm tm{};int year=0,month=0,day=0,h=0,m=0,sec=0;if(std::sscanf(s.utf8().c_str(),"%d.%d.%d %d:%d:%d",&year,&month,&day,&h,&m,&sec)<3)return 0;tm.tm_year=year-1900;tm.tm_mon=month-1;tm.tm_mday=day;tm.tm_hour=h;tm.tm_min=m;tm.tm_sec=sec;return timegm(&tm);}
