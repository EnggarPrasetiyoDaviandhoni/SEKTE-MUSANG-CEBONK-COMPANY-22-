#ifndef CEBONK_SWING_TYPES_MQH
#define CEBONK_SWING_TYPES_MQH
// The numeric engine is shared with the C++ host tests, without terminal APIs.
#ifdef __cplusplus
#include <vector>
#include <cmath>
#include <algorithm>
using datetime=long long;
using uint=unsigned int;
#define CS_CONST_ARRAY(T,N) const std::vector<T> &N
#define CS_ARRAY(T,N) std::vector<T> &N
template<class T> int ArraySize(const std::vector<T> &v){return (int)v.size();}
template<class T> int ArrayResize(std::vector<T> &v,int n){v.resize(n);return n;}
inline double MathAbs(double x){return std::abs(x);}
inline double MathFloor(double x){return std::floor(x);}
inline double MathCeil(double x){return std::ceil(x);}
inline bool MathIsValidNumber(double x){return std::isfinite(x);}
#else
#define CS_CONST_ARRAY(T,N) const T &N[]
#define CS_ARRAY(T,N) T &N[]
#endif
struct CSBar {datetime time;double open,high,low,close;};
struct CSLevel {
 double price;
 datetime origin,known,consumed;
 uint kinds;
 int side; // +1 BSL, -1 SSL
};
enum CSLevelKind {CS_PDH=1,CS_H4=2,CS_D1=4,CS_WEEK=8,CS_IPDA20=16,CS_IPDA40=32,CS_IPDA60=64,CS_H1=128,CS_SESSION=256};
struct CSSetup {
 int side,model;
 datetime origin,structure,birth;
 double low,high,invalidExtreme,liquidity;
};
struct CSMicro {
 int side,kind,children;
 datetime source,breakClose,retestClose;
 double zoneLow,zoneHigh,fib0,fib1,slRaw,sl,breakLevel;
};
struct CSDominant {
 int side,children;
 datetime mother,breakClose;
 double high,low;
};
double CSMin(double a,double b){return a<b?a:b;}
double CSMax(double a,double b){return a>b?a:b;}
int CSSign(double x){return x>0?1:x<0?-1:0;}
bool CSFinite(double x){return MathIsValidNumber(x);}
#endif
