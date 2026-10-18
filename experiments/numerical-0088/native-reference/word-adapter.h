/* Explicit proposed interpretations at historical C word sites. */
#include <stdint.h>
#include <stdlib.h>
static inline int32_t uw_signed(uint32_t x) {
    return x<=INT32_MAX?(int32_t)x:(int32_t)((int64_t)x-INT64_C(4294967296));
}
static inline int32_t uw_shl32(int32_t x,unsigned n) {
    if(n>32) abort();
    return n==32?0:uw_signed((uint32_t)x<<n);
}
static inline int32_t uw_sar32(int32_t x,unsigned n) {
    if(n>32) abort();
    if(n==0) return x;
    if(n==32) return x<0?-1:0;
    uint32_t bits=(uint32_t)x>>n;
    if(x<0) bits|=UINT32_MAX<<(32-n);
    return uw_signed(bits);
}
