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

Statistical analysis of WASM-based flatdata transforms:
- CSV, TSV, Record, JSON parsing and generation
- Warmup phase (20 iterations) for VM optimization
- Measurement phase (10 iterations)
- Statistics: mean, median, std dev, quartiles, throughput (MB/s)
- Data: 100,000 records × 20 columns (~25MB)

**Run time:** ~2-3 minutes

**Example output:**
```
csv2record
============================================================
Results:
  Time (ms):
    Mean:     393.35
    Median:   394.98
    Std Dev:  16.48
  Throughput (MB/s):
    Mean:     64.9
    Median:   64.7
```

### 2. Transform Throughput (`transforms-throughput.ts`)

Quick throughput comparison of all in-process transforms:
- CSV, TSV, Record, JSON formats
- LazyRow binary format
- WASM-accelerated CSV parsing
- Single-run measurements
- Data: 100,000 records × 20 columns (~25MB)

**Run time:** ~30 seconds

**Example output:**
```
SUMMARY
============================================================
Transform                            MB/s         Time
------------------------------------------------------------
fromCsvToRows                        26.2       974 ms
fromTsvToLazyRows                   178.7       143 ms
fromLazyRowBinary                   713.6        45 ms
------------------------------------------------------------
Average                             147.5 MB/s
```

## Notes

- Both benchmarks use the same test data size for consistency
- Flatdata benchmark provides statistical rigor for detailed analysis
- Throughput benchmark provides quick performance overview
- Results vary based on CPU, memory, and system load
