#!/usr/bin/env python3
"""Run the original EA JSON reader/DecodeFeed in a temporary C++ compatibility harness.

EA source is read locally, never copied into the repository or uploaded. This
checks the feed decoder, not MetaEditor compilation or live MT5 execution.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

SHIM = r'''
#include <algorithm>
#include <cmath>
#include <codecvt>
#include <ctime>
#include <fstream>
#include <iostream>
#include <locale>
#include <sstream>
#include <string>
#include <vector>
using string = std::u16string;
using datetime = long long;
static_assert(sizeof(long)==8, "The MQL long adapter requires 64 bits");
static_assert(sizeof(ushort)==2, "The MQL ushort adapter requires 16 bits");
std::wstring_convert<std::codecvt_utf8_utf16<char16_t>,char16_t> codec;
int StringLen(const string& s) {return (int)s.size();}
ushort StringGetCharacter(const string& s,int n) {return n>=0 && n<(int)s.size()?s[n]:0;}
string StringSubstr(const string& s,int a,int n=-1) {return a<0 || a>(int)s.size()?u"":s.substr(a,n<0?string::npos:n);}
string ShortToString(ushort c) {return string(1,c);}
string IntegerToString(long long n) {return codec.from_bytes(std::to_string(n));}
long StringToInteger(const string& s) {return std::stoll(codec.to_bytes(s));}
int StringFind(const string& s,const string& needle) {auto n=s.find(needle);return n==string::npos?-1:(int)n;}
int StringCompare(const string& a,const string& b) {return a.compare(b);}
void StringReplace(string& s,const string& before,const string& after) {size_t p=0;while((p=s.find(before,p))!=string::npos){s.replace(p,before.size(),after);p+=after.size();}}
template<class T> int ArrayResize(std::vector<T>& v,int size,int reserve=0) {try{v.resize(size);return size;}catch(...){return -1;}}
template<class T> int ArraySize(const std::vector<T>& v) {return (int)v.size();}
double MathFloor(double v){return std::floor(v);} double MathCeil(double v){return std::ceil(v);}
double MathRound(double v){return std::round(v);} double MathAbs(double v){return std::abs(v);}
double NormalizeDouble(double v,int n){double f=std::pow(10,n);return std::round(v*f)/f;}
struct MqlDateTime {int year,mon,day,hour,min,sec,day_of_week;};
bool TimeToStruct(datetime value,MqlDateTime& out) {time_t t=value;tm v{};if(!gmtime_r(&t,&v))return false;out={v.tm_year+1900,v.tm_mon+1,v.tm_mday,v.tm_hour,v.tm_min,v.tm_sec,v.tm_wday};return true;}
const int TIME_DATE=1,TIME_MINUTES=2;
string TimeToString(datetime value,int mode){time_t t=value;tm v{};gmtime_r(&t,&v);char b[32];strftime(b,sizeof(b),(mode&TIME_MINUTES)?"%Y.%m.%d %H:%M":"%Y.%m.%d",&v);return codec.from_bytes(b);}
'''

MAIN = r'''
int main(int argc,char** argv) {
  try {
    if(argc!=4)return 3;
    std::ifstream file(argv[1],std::ios::binary);std::stringstream stream;stream<<file.rdbuf();
    CebonkJson json;CebonkFeed feed;std::vector<CebonkSignal> signals;string reason;
    bool accepted=json.Parse(codec.from_bytes(stream.str())) && DecodeFeed(json,0,codec.from_bytes(argv[3]),feed,signals,reason);
    if(accepted)accepted=FeedAvailable(feed,std::stoll(argv[2]));
    if(!accepted){std::cerr<<codec.to_bytes(reason.empty()?json.Error():reason)<<"\n";return 2;}
    std::cout<<"{\"accepted_by_original_decoder\":true,\"signals\":"<<signals.size()<<"}\n";
    return 0;
  } catch(const std::exception& e) {std::cerr<<e.what()<<"\n";return 2;}
}
'''


def utf16_literals(source):
    result, i = [], 0
    while i < len(source):
        if source.startswith("//", i) or source.startswith("/*", i):
            end = source.find("\n", i) if source.startswith("//", i) else source.find("*/", i) + 2
            if end < i:
                end = len(source)
            result.append(source[i:end])
            i = end
        elif source[i] in ('"', "'"):
            quote, start = source[i], i
            i += 1
            while i < len(source):
                if source[i] == "\\":
                    i += 2
                elif source[i] == quote:
                    i += 1
                    break
                else:
                    i += 1
            result.append(("u" if quote == '"' else "") + source[start:i])
        else:
            result.append(source[i])
            i += 1
    return "".join(result)


def compile_decoder(ea_path, build):
    raw = Path(ea_path).read_bytes()
    pins = json.loads(Path(__file__).with_name("source-pins.json").read_text())
    digest = hashlib.sha256(raw).hexdigest()
    if digest not in pins["original_ea_sha256"].values():
        raise ValueError("EA has not been audited/pinned; do not execute an arbitrary source file")
    source = raw.decode("utf-8-sig")
    start = source.index("#ifndef CEBONK_SCHEDULE_MQH")
    end = source.index("// ===== Embedded: BBMA_Original.mqh =====")
    adapter = source[start:end]
    adapter = re.sub(r"CebonkSignal\s+&signals\[\]", "std::vector<CebonkSignal> &signals", adapter)
    adapter = re.sub(r"JsonToken\s+m_tokens\[\]", "std::vector<JsonToken> m_tokens", adapter)
    cpp, binary = Path(build) / "local-decoder.cpp", Path(build) / "local-decoder"
    cpp.write_text(SHIM + utf16_literals(adapter) + MAIN)
    subprocess.run(["g++", "-std=c++17", "-O2", str(cpp), "-o", str(binary)], check=True, capture_output=True)
    return binary, digest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ea", type=Path, required=True)
    parser.add_argument("--feed", type=Path, required=True)
    parser.add_argument("--now", type=int, default=None)
    parser.add_argument("--instrument", default="XAUUSD")
    args = parser.parse_args()
    now = args.now if args.now is not None else int(dt.datetime.now(dt.timezone.utc).timestamp())
    with tempfile.TemporaryDirectory(prefix="local-mt5-decoder-") as build:
        binary, digest = compile_decoder(args.ea, build)
        result = subprocess.run([str(binary), str(args.feed), str(now), args.instrument], capture_output=True, text=True)
        print(json.dumps({"ea_sha256": digest, "decoder_exit": result.returncode,
                          "decoder_output": result.stdout.strip(), "reason": result.stderr.strip()}))
        raise SystemExit(result.returncode)
