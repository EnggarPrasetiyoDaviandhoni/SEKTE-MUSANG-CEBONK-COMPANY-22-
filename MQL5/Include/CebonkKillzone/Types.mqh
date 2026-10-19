#ifndef CEBONK_KILLZONE_TYPES_MQH
#define CEBONK_KILLZONE_TYPES_MQH
#ifdef __cplusplus
#include <vector>
#include <cmath>
using datetime=long long;
using uint=unsigned int;
template<class T> int ArraySize(const std::vector<T> &v){return (int)v.size();}
template<class T> int ArrayResize(std::vector<T> &v,int n){v.resize(n);return n;}
inline double MathAbs(double x){return std::abs(x);}
inline double MathFloor(double x){return std::floor(x);}
inline double MathCeil(double x){return std::ceil(x);}
inline bool MathIsValidNumber(double x){return std::isfinite(x);}
#endif
#endif
