// In-memory terminal/transport adapter. Never sends a real push or HTTP request.
#pragma once
#include "host_mt5.hpp"
#include <map>
constexpr int INVALID_HANDLE=-1,FILE_READ=1,FILE_WRITE=2,FILE_TXT=4,FILE_ANSI=8,FILE_COMMON=16,FILE_REWRITE=32,MQL_TESTER=0;
constexpr int ACCOUNT_LOGIN=0;
inline long AccountInfoInteger(int){return 12345;}
struct CSFakeFile {std::string path;};
inline std::map<std::string,std::string> testFiles;
inline std::map<int,CSFakeFile> testHandles;
inline std::vector<string> pushMessages,telegramBodies;
inline bool failPush=false,failTelegram=false;
inline int pushAttempts=0,nextHandle=1;
inline int MQLInfoInteger(int){return 0;}
inline int FileOpen(string path,int flags,int=0,int=CP_UTF8){
 auto p=path.utf8();if((flags&FILE_READ)&&!testFiles.count(p))return INVALID_HANDLE;
 if(flags&FILE_WRITE)testFiles[p]="";int h=nextHandle++;testHandles[h]={p};return h;
}
inline bool FileIsExist(string path,int=0){return testFiles.count(path.utf8())>0;}
inline long FileSize(int h){return (long)testFiles[testHandles.at(h).path].size();}
inline string FileReadString(int h){return string(testFiles[testHandles.at(h).path]);}
inline int FileWriteString(int h,string text){auto raw=text.utf8();testFiles[testHandles.at(h).path]+=raw;return (int)raw.size();}
inline void FileFlush(int){}
inline void FileClose(int h){testHandles.erase(h);}
inline bool FileDelete(string path,int=0){return testFiles.erase(path.utf8())>0;}
inline bool FileMove(string from,int,string to,int){
 if(!testFiles.count(from.utf8()))return false;testFiles[to.utf8()]=testFiles[from.utf8()];testFiles.erase(from.utf8());return true;
}
template<class... T> void Print(T...){ }
inline double MathPow(double a,double b){return std::pow(a,b);}
inline bool SendNotification(string text){
 pushAttempts++;if(failPush||StringLen(text)>255)return false;pushMessages.push_back(text);return true;
}
inline int StringToCharArray(const string &s,std::vector<char>&out,int=0,int=WHOLE_ARRAY,int=CP_UTF8){auto b=s.utf8();out.assign(b.begin(),b.end());out.push_back(0);return (int)out.size();}
inline string CharArrayToString(const std::vector<char>&data,int start,int count,int=CP_UTF8){return string(std::string(data.begin()+start,data.begin()+start+count));}
inline int WebRequest(string,string,string,int,const std::vector<char>&data,std::vector<char>&result,string &headers){
 headers="";if(failTelegram)return 429;telegramBodies.push_back(CharArrayToString(data,0,(int)data.size()));
 std::string raw="{\"ok\":true}";result.assign(raw.begin(),raw.end());return 200;
}
