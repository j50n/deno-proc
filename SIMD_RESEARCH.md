# SIMD Research for CSV/TSV Parsing

## Context

Evaluating whether SIMD techniques from simdjson are applicable to our CSV/TSV parsing library.

## simdjson Key Techniques

### 1. Two-Stage Architecture
- **Stage 1**: Find all structural characters using SIMD (branchless, fixed cost per byte)
  - Process 64 bytes at a time
  - Output: indexes of structural characters
- **Stage 2**: Parse values using indexes from stage 1
  - No need to scan for next token
  - Can process tokens without data dependencies

### 2. Vectorized Classification
Instead of N comparisons for N characters, use `vpshufb` (shuffle) as lookup table:
```
- Split byte into high/low nibbles (4 bits each)
- Use nibbles as indexes into 16-byte lookup tables
- Combine results with bitwise AND
- Classify into multiple sets simultaneously (structural, whitespace, etc.)
```

**Example**: Identify `,`, `:`, `{`, `}`, `[`, `]` and whitespace in one pass
- 2 shuffle instructions + few logical ops
- Processes 32 bytes at once
- No branching

### 3. Bitset Operations
Convert character locations to bitmasks (1 bit per byte):

**Finding Quoted Regions**:
```
1. Identify backslashes and quotes (vectorized comparison)
2. Find escaped quotes (backslash sequences using arithmetic)
3. Compute quote pairs using carry-less multiplication (pclmulqdq)
   - XOR prefix-sum over unescaped quotes
   - Result: bitmask where 1 = inside quotes
```

**Key insight**: Carry-less multiplication computes XOR prefix-sum in one instruction

### 4. Branchless Processing
- Fixed cost per input byte regardless of content
- All decisions via bitwise operations
- No unpredictable branches in hot path
- Only check for errors once at end

### 5. Index Extraction
From bitmask to array of indexes:
```c
// Extract 8 indexes unconditionally
while(s) {
  *b++ = idx + trailingzeroes(s); s = s & (s-1);  // 8 times unrolled
}
// Overwrite excess with next iteration
```
Avoids branch mispredictions when <8 bits set

## Performance Results (simdjson)

- **Speed**: 2-3 GB/s on single core (Skylake 3.4 GHz)
- **Instructions**: 50% fewer than RapidJSON
- **Stage 1**: ~0.5-1 cycle per input byte (mostly SIMD)
- **Stage 2**: ~0.5-2 cycles per input byte (depends on content)

## Applicability to CSV/TSV

### Good Fit

**1. CSV Parsing (Delimited → Record format)**
- Find delimiters: `,`, `\n`, `\r` (vectorized classification)
- Detect quoted regions (same bitset technique as JSON)
- Handle escaped quotes (same backslash detection)
- **Current**: Character-by-character with branches
- **Potential**: 2-4x speedup

**2. TSV Parsing**
- Simpler than CSV (no quoting)
- Find `\t` and `\n` delimiters
- **Current**: Already fast, less room for improvement

### Less Applicable

**1. Record → TSV (byte replacement)**
- Just replace 0x1E → 0x09, 0x1F → 0x09
- Already trivial with SIMD (current implementation)
- Minimal benefit from complex techniques

**2. Simple Transformations**
- TSV ↔ CSV without quotes: just delimiter replacement
- Overhead of bitset operations may not be worth it

### Key Questions

1. **Is CSV parsing a bottleneck?**
   - Current: ~10-27 MB/s (from TEST_SPEC.md)
   - JSON: ~70-98 MB/s
   - CSV is 3-7x slower than JSON - why?

2. **What's the cost breakdown?**
   - Quoting/escaping logic?
   - Branch mispredictions?
   - Character-by-character processing?

3. **Is two-stage architecture worth it?**
   - CSV is flat (no nesting like JSON)
   - Simpler state machine
   - May not need full separation

## Recommendations

### Phase 1: Measure Current Performance
1. Profile CSV parser to find bottlenecks
2. Measure branch misprediction rate
3. Compare with/without quoting

### Phase 2: Targeted SIMD
If bottlenecks found:
1. **Vectorized delimiter detection** (easy win)
2. **Bitset-based quote detection** (if quoting is slow)
3. **Branchless quote handling** (if branches are problem)

### Phase 3: Consider Two-Stage
Only if:
- CSV parsing is critical path
- Current approach is fundamentally limited
- Willing to increase code complexity

## References

- Paper: "Parsing Gigabytes of JSON per Second" (Langdale & Lemire, 2019)
- Implementation: https://github.com/lemire/simdjson
- Blog series: https://blog.tomlebreux.com/2020/01/03/fast-json-parsing-with-c-and-simd-2.html

## Current Status

- **Testing complete**: 182 Odin tests, 488 TypeScript tests (670 total)
- **Next step**: Profile CSV parser before deciding on SIMD investment
- **Question**: Is 10-27 MB/s CSV parsing acceptable for use cases?
