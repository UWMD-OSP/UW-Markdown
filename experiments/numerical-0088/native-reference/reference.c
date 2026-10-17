/* Isolated fdlibm research driver. No UWMD production linkage. */
#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <float.h>
#include <fenv.h>
extern double __ieee754_pow(double,double);
extern double __ieee754_log(double);
extern double __ieee754_exp(double);
extern double __ieee754_sqrt(double);
extern double uw_scalbn(double,int);
extern double uw_fabs(double);
extern double uw_copysign(double,double);
static double value(uint64_t word) { double x; memcpy(&x,&word,8); return x; }
static uint64_t word(double x) { uint64_t u; memcpy(&u,&x,8); return u; }
int main(void) {
    uint32_t endian=1;
    if(sizeof(double)!=8 || sizeof(int)!=4 || sizeof(unsigned)!=4 || CHAR_BIT!=8 ||
       DBL_MANT_DIG!=53 || DBL_MAX_EXP!=1024 || FLT_RADIX!=2 || FLT_EVAL_METHOD!=0 ||
       INT_MAX!=2147483647 || ((-1)>>1)!=-1 || *((unsigned char*)&endian)!=1) return 20;
    if(fesetround(FE_TONEAREST)!=0 || fegetround()!=FE_TONEAREST) return 21;
    volatile double sub=value(1), doubled=sub+sub;
    if(word(doubled)!=2) return 22;
    char line[160],op[20],extra;
    uint64_t x,y; int n;
    while(fgets(line,sizeof(line),stdin)) {
        if(sscanf(line,"%19s %" SCNx64 " %" SCNx64 " %d %c",op,&x,&y,&n,&extra)!=4) return 23;
        double a=value(x), b=value(y), result;
        if(strcmp(op,"pow")==0) result=__ieee754_pow(a,b);
        else if(strcmp(op,"log")==0) result=__ieee754_log(a);
        else if(strcmp(op,"exp")==0) result=__ieee754_exp(a);
        else if(strcmp(op,"sqrt")==0) result=__ieee754_sqrt(a);
        else if(strcmp(op,"scalbn")==0) result=uw_scalbn(a,n);
        else if(strcmp(op,"fabs")==0) result=uw_fabs(a);
        else if(strcmp(op,"copysign")==0) result=uw_copysign(a,b);
        else return 24;
        printf("%016" PRIx64 "\n",word(result));
    }
    return ferror(stdin)?25:0;
}
