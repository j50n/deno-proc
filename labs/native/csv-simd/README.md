# CSV SIMD Parser (Native)

Research and future implementation of SIMD-accelerated CSV parsing for native platforms (x86-64/ARM).

## Status

**Research complete. Implementation deferred.**

SIMD techniques are well-understood and documented, but not worth implementing in WebAssembly due to:
- 128-bit vector limitation (vs 256-bit AVX2)
- Missing `pclmulqdq` instruction (the key to efficient quote detection)
- Marginal gains (1.3-2x) don't justify complexity

## Goal (Native Implementation)

Achieve 100-200+ MB/s CSV parsing using native SIMD:

1. **Vectorized quote detection** - Track "inside/outside quotes" for 32 bytes in parallel using `pclmulqdq`
2. **Vectorized delimiter detection** - Find all commas, newlines, tabs simultaneously using `vpshufb`
3. **Branchless processing** - Eliminate branch mispredictions
4. **Single-pass architecture** - Process CSV in one pass (no two-stage)

## Platform Requirements

- **x86-64**: AVX2 + `pclmulqdq` (Intel Haswell+ 2013, AMD Zen+ 2017)
- **ARM**: NEON + `PMULL` (requires different implementation)

## Key Insight

CSV's main bottleneck is quote state tracking. The `pclmulqdq` instruction computes XOR prefix-sum in one operation, giving you "inside/outside quotes" for 32 bytes simultaneously. This eliminates the character-by-character state machine.

**Without `pclmulqdq` (WASM)**: Must compute manually (~10-20 instructions) - not worth it.

## References

See [SIMD_RESEARCH.md](./SIMD_RESEARCH.md) for detailed analysis and techniques.
