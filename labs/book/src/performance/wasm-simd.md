# Why WASM SIMD Isn't Worth It

**TL;DR:** WebAssembly SIMD is too limited for text processing. It only provides marginal gains (1.3-2x at best) while significantly increasing complexity. Not worth maintaining both SIMD and scalar code paths.

## The Investigation

While researching performance optimizations for CSV parsing, I explored SIMD (Single Instruction Multiple Data) techniques inspired by simdjson, which achieves 2-3 GB/s JSON parsing using vectorized operations.

The key insight: CSV's main bottleneck is tracking quote state. You need to know "am I inside quotes?" for every character to determine if a comma is a delimiter or data:

```
a,"b,c",d
  ↑   ↑
  This comma is DATA (inside quotes)
      This comma is DELIMITER (outside quotes)
```

## The Magic Instruction

Native SIMD implementations use `pclmulqdq` (carry-less multiplication) to compute quote state for 32 bytes in parallel:

```
Input:  a,"b,c",d,"e,f",g
Quotes: 00100001001000010  (bitmask: 1 = quote)
Result: 00111110001111100  (1 = inside quotes)
```

This single instruction computes an XOR prefix-sum, giving you "inside/outside quotes" for an entire vector at once. It's like flipping 32 light switches simultaneously and seeing which ones end up ON.

**With this instruction:** Process 32 characters in ~5-10 CPU cycles (vs 32-64 cycles character-by-character).

## The WASM Problem

WebAssembly SIMD has three critical limitations:

### 1. 128-bit Vectors Only
- WASM: 128-bit (16 bytes at a time)
- Native AVX2: 256-bit (32 bytes at a time)
- **Half the throughput per operation**

### 2. Missing the Magic Instruction
- `pclmulqdq` is **NOT** in the WASM SIMD spec
- Must compute XOR prefix-sum manually (~10-20 instructions vs 1)
- The elegant solution becomes awkward and slow

### 3. Marginal Gains
- Native with AVX2 + `pclmulqdq`: **2-4x faster**
- WASM with 128-bit + manual XOR: **1.3-2x faster** (estimate)
- Simple scalar optimizations can achieve similar gains

## What WASM SIMD Has

WASM SIMD provides basic operations:
- ✅ `i8x16.eq` - Vector comparisons (find quotes, commas)
- ✅ `v128.and/or/xor/not` - Bitwise operations
- ✅ `i8x16.swizzle` - Shuffle/classify bytes
- ✅ `i8x16.bitmask` - Extract bitmask from vector
- ❌ `pclmulqdq` - **The key instruction for efficient quote detection**

These work fine for simple operations (byte replacement, character counting), but fall short for stateful text processing.

## The Complexity Cost

Using SIMD means:
- **Two code paths** - SIMD version + scalar fallback
- **Two test suites** - Must verify both implementations
- **Platform detection** - Runtime checks for SIMD support
- **Harder debugging** - Vector operations are opaque
- **Maintenance burden** - Every bug fix needs two implementations

For a 1.3-2x improvement, this isn't justified.

## The Decision

**Don't use WASM SIMD for text processing.**

Better alternatives:
1. **Optimize scalar code** - Better algorithms, fewer branches, string concat tricks
2. **Native CLI tool** - If speed is critical, build a native tool with full AVX2 support (like the flatdata CLI)
3. **Focus on correctness** - Spend complexity budget on features and reliability

## When WASM SIMD Makes Sense

WASM SIMD is worth it for:
- **Simple operations** - Byte replacement, character counting, checksums
- **No state tracking** - Operations that don't depend on previous bytes
- **Embarrassingly parallel** - Image processing, audio, numerical computation

It's not worth it for:
- **Stateful parsing** - CSV, JSON, XML (without `pclmulqdq`)
- **Unpredictable patterns** - Text processing with context-dependent rules
- **Marginal gains** - When scalar optimizations get you 80% of the way there

## The Native Path (Future)

If CSV parsing becomes a proven bottleneck, the right approach is a native CLI tool:

**Platform support:**
- Intel Haswell+ (2013+): AVX2 + `pclmulqdq` ✅
- AMD Zen (2017+): AVX2 + `pclmulqdq` ✅
- ARM Graviton: NEON + `PMULL` (similar but different) ⚠️

**Expected performance:** 100-200+ MB/s (vs current 10-27 MB/s)

But only pursue this if profiling shows CSV parsing is actually the bottleneck in real-world usage.

## Lessons Learned

1. **WASM SIMD is deliberately limited** - It's a lowest-common-denominator instruction set
2. **Missing instructions matter** - One key instruction (`pclmulqdq`) makes the difference between elegant and awkward
3. **Complexity has a cost** - Marginal gains aren't worth maintaining two implementations
4. **Scalar optimizations go far** - String concat tricks, better algorithms, fewer branches can get you most of the way
5. **Profile first** - Don't optimize until you know it's the bottleneck

## References

- Full research: `labs/native/csv-simd/SIMD_RESEARCH.md`
- simdjson paper: "Parsing Gigabytes of JSON per Second" (Langdale & Lemire, 2019)
- WASM SIMD spec: https://github.com/WebAssembly/simd
