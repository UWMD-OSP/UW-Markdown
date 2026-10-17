# Explicit word-site and arithmetic mapping

Research mapping for the exact sources in `sources.json`, not accepted numeric
semantics. `kernel.mjs` preserves source expression association; integer access
is specified below instead of inheriting C aliasing/overflow/shift UB. Original
source bytes and individual notices remain in `upstream/`.

## Common model

Every floating `+`, `-`, `*`, `/` and unary sign in the body is one ECMAScript
binary64 operator, rounded nearest/ties-even with gradual underflow. Parentheses
and source left association remain intact; assignment is not extra quantization.
No FMA, reassociation, fround, host sqrt/pow/log/exp or stabilized replacement is
used. A C `int -> double` conversion is exact because its signed32 magnitude fits
binary64. Exp's `double -> int` cast truncates toward zero after range checks
bound it approximately to [-1075,1024]; `s32` has identical values there.

All word arithmetic uses two's-complement32:

| Adapter | Meaning |
|---|---|
| `hi`, `hu`, `lo` | High signed32, high unsigned32, low unsigned32, respectively; DataView big-endian access supplies host-independent identity. |
| `withHi`, `withLo`, `fromWords` | Replace exactly one word or construct both, modulo2^32. Other bits retained; no decimal conversion. |
| `s32`, `u32` | Interpret low32 bits signed or unsigned. Inputs to word arithmetic are exact integers with absolute intermediate sum<2^33, so the JS addition itself loses no integer bit. |
| `add32`, `sub32` | Signed result of modulo2^32 addition/subtraction. |
| `uadd32`, `usub32` | Unsigned result of the same operation. Carry/borrow branches explicitly inspect original words. |
| `shl` | Low32 bits of left shift. Count0 preserves signed word; count32 returns0. |
| `sar` | Arithmetic signed right shift; count32 returns all sign bits. |
| `shr` | Logical unsigned right shift; count32 returns0, including at sqrt's transfer site. |

Shift counts outside integer0..32 throw a local research RangeError; valid
kernel sites cannot reach them under the ranges below. JavaScript's native
shift-count masking is **never** used to give count32 the count0 meaning.
Bitwise AND/OR/XOR/not use JavaScript's exact low32-bit operation. Equality to
zero and bit masks is independent of signed interpretation; when C compares
an unsigned magnitude, the JS side explicitly uses unsigned values.

The mapped signed overflow/negative left shifts are an explicit candidate choice,
not a claim that ISO C defines those source operations. A native reference must
apply the same wrapping/whole-word model and document compiler/adapter settings.
No source mutation silently becomes a new upstream identity.

## Variable signedness and complete site inventory

### pow — upstream/e_pow.c

Signed: hx, hy, ix, iy, i, j, k, yisint, n. Unsigned: lx, ly. Float temporaries
remain Numbers. `lo(z)` assigned to signed i uses `s32`; masks preserve bits.
The source's i0/i1 endianness-probe assignments are omitted: both variables are
unused in the numeric body, and DataView replaces the pointer macros entirely.

| C site / purpose | JS mapping and range |
|---|---|
| `__HI(x/y)`, `__LO(x/y)` | hi signed; lo unsigned. `ix/iy = h&0x7fffffff` are nonnegative. All subsequent __HI/__LO reads retain source signed target type. |
| `(iy>>20)-0x3ff` parity exponent | sar20 then sub32; k=0..52 when this branch is reached. |
| `ly>>(52-k)` / `j<<(52-k)` | Logical shr then s32 assignment; shl and **u32 before equality to ly**, matching C's unsigned comparison promotion. k=21..52, so count=0..31. This includes negative signed j when low-word bit31 is set. |
| `iy>>(20-k)` / restoring left shift | sar/shl, k=0..20 and count=0..20; ly must be zero. |
| `(ix-0x3ff00000)|lx` and same difference combined with yisint | sub32 then bitwise OR; only equality to zero is tested. |
| `(hx>>31)+1` and `n|(yisint-1)` | sar31 and add/sub32; these are exact signed sign/parity selectors. |
| `n-=53`, `n+=((ix>>20)-0x3ff)`, interval n++ / ix-=0x100000 | Explicit add/sub32; magnitude remains small after source normalization. |
| `ix>>1`, `k<<18`, high-word addition for t_h | sar1, shl18, add32; k is0/1. withHi installs resulting word. |
| `__LO(t1/s_h/t_h/p_h/y1/t)=0` | withLo preserves high word and clears low word; it is a bit split, not integer rounding of the float. |
| `j-0x40900000`, `j-0xc090cc00`, OR i | sub32 preserves low-word pattern; C's unsigned literal promotion in the second subtraction has the same zero/nonzero result. |
| `(i>>20)-0x3ff`, `0x100000>>(k+1)` | sar, then add32 to j; source tests imply initial k=-1..10 and shift0..11. |
| recomputed k, `0xfffff>>k`, n masked by complement | sar with k=0..10, bitwise masks, withHi on zero. |
| `((n&0xfffff)|0x100000)>>(20-k)`; negate if j<0 | sar, count10..20; final |n|<=1075 after source overflow/underflow selection. |
| `(n<<20)`, high-word j addition and `j>>20` | Defined wrap shl20/add32; sar20 decides scalbn versus high-word install. Negative n left shift has specified low32-bit meaning. |

No algebraic power replacement is made: exponent+1/-1/+2/+0.5, huge exponents,
general split logarithm/exponential and all sign/refusal-producing raw branches
are retained. fabs/sqrt/scalbn calls resolve only to this module's exact helpers.

### log — upstream/e_log.c

Signed: k, hx, i, j. Unsigned: lx. The high signed comparison first rejects raw
negative arguments; the low word participates only in zero/nonzero tests.

| C site | JS mapping |
|---|---|
| high/low extraction, high-word normalization write | hi/lo, withHi; hx masking and `hx|(i^0x3ff00000)` are low32-bit operations. |
| `k-=54`, `k+=(hx>>20)-1023`, `k+=(i>>20)` | sub/add32 with sar20; no fractional or unsafe integer conversion. |
| `(hx+0x95f64)&0x100000`, `2+hx` masked test | add32 then mask. |
| `hx-0x6147a`, `0x6b851-hx`, `i|=j`, signed i>0 | sub32 and signed bitwise OR. This preserves the branch's signed comparison. |
| `dk=(double)k` | Exact binary64 integer value; source order of dk*ln2_hi/lo retained. |

### exp — upstream/e_exp.c

Unsigned: hx. Signed: k, xsb. `hu` supplies unsigned high word; the sign extraction
is logical shr31 and bit1; hx is then masked nonnegative.

| C site | JS mapping |
|---|---|
| hx sign shift and NaN low-word test | shr31; low-word bitwise OR tested against zero. |
| `k=1-xsb-xsb` | Exact small signed integer association, no floating reformulation. |
| `(int)(invln2*x+halF[xsb])` | s32 truncates the already binary64 ordered expression. Finite thresholds precede it; NaN/infinity return earlier. |
| `t=k` | Exact integer-to-binary64 value. |
| `__HI(y)+=(k<<20)` / `((k+1000)<<20)` | add32/shl20, including negative k and wrapped word installation. |

The tiny-input `huge+x>one` and sqrt rounding probes still execute their source
binary64 operations. No C exception-status flags or alternate rounding modes are
emulated or advertised.

### sqrt — upstream/e_sqrt.c

Signed: ix0,s0,q,m,t,i,sign. Unsigned: r,t1,s1,ix1,q1. JS `sign` stores the
unsigned bit pattern0x80000000; each mixed-signed use below makes its meaning
explicit. Other signed temporaries remain s32; unsigned temporaries remain u32.

| C site | JS mapping and range |
|---|---|
| high/low reads and final __HI/__LO writes | hi, lo, fromWords. Source z's uninitialized other word is never read: both final words are installed together. |
| zero mask `ix0&(~sign)` | Mask0x7fffffff, same bit pattern; preserve -0 by returning x. |
| initial `ix0>>20`, m subtraction, `m>>=1` | sar20, sub32 and sar1; negative odd m rounds toward negative infinity as source arithmetic shift. |
| normalization `ix1>>11`, `ix1<<=21`, `ix0<<=1` | Logical shr11, shl21 + u32, signed shl1. Transfer loop<=2, search loop<=20. |
| `ix1>>(32-i)` / `ix1<<=i` | Explicit logical shr with count12..32 and low-word left shift0..20. Count32 returns0: the only possible whole-word shift site, not x86/JS count masking. |
| `(ix1&sign)>>31` | Logical `shr(ix1,31)`, value0/1, matching unsigned C promotion. |
| `ix0 += ix0 + carry`, `ix1+=ix1` | Nested add32 (source association), uadd32. |
| `r=0x200000`, `r>>=1` high digit loop | r unsigned; logical shr1 gives exactly22 iterations. |
| `t=s0+r`, `s0=t+r`, `q+=r` | Unsigned arithmetic promoted by r, then signed assignment via s32; low32 bits retained. Comparisons t<=ix0 remain signed. |
| `r=sign`, `t1=s1+r`, `s1=t1+r`, `q1+=r` | r/t1/s1/q1 unsigned via uadd32; logical shr1 gives exactly32 iterations. |
| carry `((t1&sign)==sign)&&((s1&sign)==0)` | u32(t1&sign) compared to unsigned sign pattern; second comparison only zero/nonzero. Then signed s0 add32. |
| borrow `ix1<t1`, `ix0-=t`, `ix0--`, `ix1-=t1` | Unsigned low comparison, signed sub32 high updates, unsigned usub32 low subtraction. |
| q1==0xffffffff/0xfffffffe; q++ / q1+=2 or(q1&1) | Unsigned q1 equality and uadd32; signed q add32. RN-even probes choose q1's tie bit, preserving carry. |
| `(q>>1)+0x3fe00000`, `q1>>1`, `ix1|=sign`, `(m<<20)` | sar1/add32, logical shr1, u32 OR sign, wrap shl20/add32. |

### scalbn, fabs, copysign

scalbn k/hx/lx are C signed32; JS lo is unsigned but lx is only bitwise-zero tested,
so its interpretation is immaterial. `n` must be a signed32 integer at this raw
C-shaped API. Source-specific n<-50000 and n>50000 branches are **retained source
control**, not newly chosen numerical caps.

| C site | JS mapping |
|---|---|
| scalbn `(hx&0x7ff00000)>>20`, high/low reads | hi, lo, sar20 after positive mask. |
| scalbn k-54, **k+n**, k+54 | sub/add32. k+n explicitly wraps even for signed32 extreme n; the source's n>50000 recovery branch remains. |
| scalbn high preserve mask and `k<<20` | `(hx&0x800fffff)|shl(k,20)`, then withHi. Sign/low fraction preserved. |
| fabs `__HI(x)&=0x7fffffff` | withHi and high unsigned mask; no host fabs. |
| copysign high AND/OR | withHi of x magnitude high + y sign; no floating arithmetic or host copysign. |

## Remaining review obligations

This is a complete translation inventory, not proof that it is defect-free.
Independent native C must state its UB normalization and strict floating build
flags; source-reproduction comparisons are separate from the bounded mathematical
certificates. No finite corpus proves every branch/carry or universal accuracy.
Arithmetic NaN payload/sign propagation and floating exception flags are not
portable research guarantees; compare generated NaNs by class. Signed zero and
infinity sign are exact comparison subjects.
