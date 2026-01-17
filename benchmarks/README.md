# Benchmarks

Performance benchmarks for deno-proc transforms.

## Quick Start

```bash
# Run all benchmarks
./benchmarks/run-benchmarks.sh

# Run specific benchmark
./benchmarks/run-benchmarks.sh 1  # Flatdata statistical
./benchmarks/run-benchmarks.sh 2  # Transform throughput
```

## Available Benchmarks

### 1. Flatdata Statistical (`flatdata-statistical.ts`)

Statistical analysis of WASM-based flatdata transforms with multiple runs:
- CSV parsing (rows, LazyRow)
- TSV parsing (rows, LazyRow)
- Record format conversions
- JSON parsing
- Outputs: mean, median, std dev, min, max, throughput (MB/s)

**Run time:** ~2-3 minutes

### 2. Transform Throughput (`transforms-throughput.ts`)

Throughput comparison of all in-process transforms:
- CSV, TSV, Record, JSON formats
- LazyRow binary format
- WASM-accelerated CSV parsing
- Tests with 100K records × 20 columns (~10MB)

**Run time:** ~1-2 minutes

## Legacy Benchmarks

The `transforms/` directory contains older benchmarks that may have lint errors or be outdated. Use the main benchmarks above for current performance testing.
