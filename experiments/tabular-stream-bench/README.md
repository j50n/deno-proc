# Tabular Stream Bench

Performance benchmarking suite for CSV/TSV streaming parsers using different execution contexts and optimization strategies.

## Project Goals

Evaluate and compare the performance characteristics of various CSV/TSV parsing implementations to determine optimal strategies for "hiding" processing overhead through:

- **Parallelization**: Web Workers, separate processes
- **Optimization**: WASM compilation, native executables  
- **Architecture**: Different parsing strategies and data flow patterns

All implementations center around `jsr:@j50n/proc` for consistent streaming and process management.

## Test Matrix

### Data Sets
- **Columns**: 10, 100, 1000 columns per row
- **Size**: ~100MB uncompressed per file
- **Formats**: CSV and TSV variants (6 files total)

### Implementations
1. **baseline-js** - Plain JavaScript streaming parser
2. **worker-js** - Web Worker-based parallel processing
3. **process-ts** - Out-of-process TypeScript script
4. **process-native** - Compiled executable (Rust/Go/C++)
5. **wasm-direct** - Direct WASM implementation
6. **wasm-threaded** - Multi-threaded WASM with SharedArrayBuffer

### Metrics
- **Throughput**: Rows/second, MB/second
- **Memory**: Peak usage, allocation patterns
- **Latency**: Time to first result, total processing time
- **CPU**: Core utilization, thread efficiency

## Project Structure

```
tabular-stream-bench/
├── README.md
├── data/
│   ├── generate.ts          # Data generation script
│   ├── csv/                 # Generated CSV files
│   └── tsv/                 # Generated TSV files
├── benchmark/
│   ├── runner.ts            # Benchmark orchestration
│   ├── profiler.ts          # Deno profiling integration
│   └── results/             # Benchmark outputs
├── implementations/
│   ├── baseline-js/         # Plain JavaScript
│   ├── worker-js/           # Web Workers
│   ├── process-ts/          # TypeScript subprocess
│   ├── process-native/      # Compiled executable
│   ├── wasm-direct/         # Direct WASM
│   └── wasm-threaded/       # Threaded WASM
└── analysis/
    ├── compare.ts           # Results comparison
    └── visualize.ts         # Performance visualization
```

## Implementation Requirements

Each implementation must:
- Parse the same test data sets
- Expose identical async iterable interface
- Handle errors consistently
- Support streaming (no full file loading)
- Integrate with benchmark runner
- Include isolated dependencies

## Getting Started

1. Generate test data: `deno run data/generate.ts`
2. Build implementations: `deno task build-all`
3. Run benchmarks: `deno run benchmark/runner.ts`
4. Analyze results: `deno run analysis/compare.ts`

## Profiling

Uses Deno's built-in profiling capabilities:
- `--cpu-prof` for CPU profiling
- `--heap-prof` for memory analysis
- Custom timing instrumentation for detailed metrics
