# TSV-Record Performance Experiment

Performance comparison of TypeScript vs WASM (Odin) implementations for record→TSV format conversion.

## Quick Start

```bash
# Generate test data
deno run --allow-write data/generate.ts

# Build and run benchmarks
./run.sh
```

## Results Summary

**WASM provides 1.8-2.0x speedup over TypeScript** with validation.

See [RESULTS.md](RESULTS.md) for detailed analysis.

## Format Specification

### Input: Record Format
- Field separator: `0x1f` (Unit Separator)
- Record separator: `0x1e` (Record Separator)

### Output: TSV Format
- Field separator: `0x09` (Tab)
- Record separator: `0x0a` (Newline)

### Transformation
- `0x1f` → `0x09` (field separator → tab)
- `0x1e` → `0x0a` (record separator → newline)

### Validation
- Error on embedded tab (`0x09`), CR (`0x0d`), or LF (`0x0a`)
- Report 1-based record number with locale formatting

See [SPEC.md](SPEC.md) for complete specification.

## Implementations

### TypeScript
- **bytes-correct** - Direct byte manipulation with validation

### WASM (Odin)
- **scalar** - Simple loop
- **scalar-correct** - Loop with validation
- **SIMD** - 16-byte SIMD vectors (recommended)
- **SIMD-correct** - SIMD with validation
- **SIMD-unrolled** - 4x loop unrolling

## Files

```
labs/tsv-record-perf/
├── README.md              # This file
├── SPEC.md               # Format specification
├── RESULTS.md            # Performance analysis
├── run.sh                # Build and benchmark script
├── data/
│   └── generate.ts       # Test data generator
├── odin/
│   ├── record2tsv.odin                  # Scalar
│   ├── record2tsv-correct.odin          # Scalar with validation
│   ├── record2tsv-simd.odin             # SIMD (recommended)
│   ├── record2tsv-simd-correct.odin     # SIMD with validation
│   └── record2tsv-simd-unrolled.odin    # SIMD unrolled
└── typescript/
    ├── benchmark.ts                      # Statistical benchmark
    ├── verify.ts                         # Correctness verification
    ├── odin-runtime.ts                   # Minimal WASM runtime
    ├── record2tsv-wasm.ts                # Scalar wrapper
    ├── record2tsv-wasm-correct.ts        # Scalar-correct wrapper
    ├── record2tsv-wasm-simd.ts           # SIMD wrapper
    ├── record2tsv-wasm-simd-correct.ts   # SIMD-correct wrapper
    └── record2tsv-wasm-simd-unrolled.ts  # SIMD-unrolled wrapper
```

## Benchmark Methodology

- **Warmup**: 10 iterations for JIT compilation
- **Benchmark**: 100 iterations for statistical analysis
- **Test file**: 100MB (3.7M records)
- **Metrics**: Mean, median, standard deviation, min, max throughput

## Key Findings

1. **WASM SIMD** is recommended for production (simple, fast, proven)
2. **Loop unrolling** provides marginal benefit with higher variability
3. **TypeScript** is most stable but ~45% slower
4. **Thermal throttling** is significant factor in extended benchmarks

See [RESULTS.md](RESULTS.md) for complete analysis.
