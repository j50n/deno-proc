# Transform Performance Benchmarks

This directory contains performance benchmarks for the transform functions
library.

## Structure

- `transforms/` - Transform function benchmarks with detailed specification
- `data/` - Test datasets of various sizes
- `README.md` - This overview document

## Quick Start

```bash
# Run comprehensive analysis
deno run --allow-read benchmarks/transforms/comparative_analysis.ts

# Generate test data
cd benchmarks/data && ./generate_test_data.ts

# Run individual benchmarks
deno run --allow-read benchmarks/transforms/csv_performance.ts
deno run --allow-read benchmarks/transforms/lazy_row_performance.ts
```

## Documentation

See `transforms/README.md` for detailed benchmark specifications, performance
targets, and methodology.

## Test Data

- `small.csv` - 1KB dataset for micro-benchmarks
- `medium.csv` - 1MB dataset for typical workloads (generated)
- `large.csv` - 100MB dataset for stress testing (generated)

## Metrics

Benchmarks measure:

- **Throughput** - MB/s processing rate
- **Memory usage** - Peak RSS during processing
- **Latency** - Time to first result (streaming)
- **CPU efficiency** - Processing time vs wall time
