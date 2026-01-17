# CSV SIMD Parser

Exploring SIMD techniques for high-performance CSV parsing, inspired by simdjson.

## Goal

Improve CSV parsing performance from current 10-27 MB/s to 40-100+ MB/s using vectorized operations.

## Approach

Apply simdjson's proven techniques to CSV parsing:

1. **Vectorized quote detection** - Track "inside/outside quotes" for 32 bytes in parallel using bitset operations
2. **Vectorized delimiter detection** - Find all commas, newlines, tabs simultaneously using shuffle-as-lookup
3. **Branchless processing** - Eliminate branch mispredictions in quote/delimiter handling
4. **Single-pass architecture** - Process CSV in one pass (no two-stage like JSON)

## Current Status

Research phase - evaluating techniques and planning implementation.

## Key Insight

CSV's main bottleneck is quote state tracking. simdjson's carry-less multiplication technique (`pclmulqdq`) can compute quote state for entire vectors at once, eliminating the character-by-character state machine.

## References

See [SIMD_RESEARCH.md](./SIMD_RESEARCH.md) for detailed analysis.
