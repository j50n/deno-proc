# Record → TSV Performance Experiment

Minimal implementations to isolate and profile the performance bottleneck in flatdata transformations.

## Quick Start

```bash
# TypeScript implementations
cat input.record | deno run typescript/record2tsv-bytes.ts > output.tsv
cat input.record | deno run typescript/record2tsv-string.ts > output.tsv

# Build WASM module
cd odin && ./build.sh

# WASM implementations
cat input.record | deno run --allow-read deno/record2tsv-wasm.ts > output.tsv
cat input.record | deno run --allow-read deno/record2tsv-wasm-simd.ts > output.tsv

# Benchmarks
deno run typescript/benchmark-ts.ts < large-file.record
deno run --allow-read deno/benchmark-wasm.ts < large-file.record
```

## Four Implementations

1. **TypeScript (Uint8Array)** - Direct byte manipulation
2. **TypeScript (TextDecoder + replaceAll)** - String-based with regex
3. **WASM (Standard loop)** - Simple Odin loop
4. **WASM (SIMD)** - 128-bit vectorized processing

## Goal

Identify whether the bottleneck is:
- Data transfer between Deno and WASM
- WASM invocation overhead
- Memory allocation patterns
- Or actual processing time

Also determine if TypeScript is competitive for simple operations.

See [SPEC.md](SPEC.md) for complete details.

## Structure

- `typescript/` - Pure TypeScript implementations
- `odin/` - WASM implementation (standard + SIMD)
- `deno/` - WASM wrappers and benchmarks
- `results/` - Profiling data and analysis
