# Flatdata Statistical Benchmark Results

## Methodology

### Previous Approach (Subprocess-based)

- Spawned new Deno process for each measurement
- VM warmup restarted every iteration
- Single measurement per conversion
- No statistical analysis

### New Approach (Direct Function Testing)

- Tests transformation functions directly in same process
- 30 warmup iterations to allow VM optimization
- 100 measurement iterations for statistical significance
- Reports: mean, median, std dev, min, max, Q1, Q3

## Warmup Analysis

Warmup progression for csv2record (50 iterations):

- **Iteration 1**: 484ms (52.8 MB/s) - Cold start
- **Iterations 2-5**: Rapid improvement to ~380ms (67 MB/s)
- **Iterations 6+**: Stabilized around 360-410ms (62-71 MB/s)
- **Conclusion**: 30 warmup iterations is sufficient

Natural variance after warmup: ±10-15% due to:

- GC pauses
- OS scheduling
- Memory allocation patterns

## Benchmark Results

Test configuration:

- 100,000 records × 20 columns
- File size: 25.54 MB
- 30 warmup iterations
- 100 measurement iterations

### CSV Conversions

| Conversion  | Mean (MB/s) | Median (MB/s) | Std Dev (ms) |
| ----------- | ----------- | ------------- | ------------ |
| csv2record  | 64.3        | 65.0          | 28.98        |
| csv2lazyrow | 47.3        | 47.7          | 21.56        |
| csv2tsv     | 64.7        | 65.1          | 19.12        |

### TSV Conversions

| Conversion  | Mean (MB/s) | Median (MB/s) | Std Dev (ms) |
| ----------- | ----------- | ------------- | ------------ |
| tsv2record  | 65.1        | 65.7          | 19.28        |
| tsv2lazyrow | 46.8        | 47.4          | 28.27        |
| tsv2csv     | 64.7        | 64.8          | 21.48        |

### Record Conversions

| Conversion     | Mean (MB/s) | Median (MB/s) | Std Dev (ms) |
| -------------- | ----------- | ------------- | ------------ |
| record2csv     | 86.8        | 87.8          | 24.15        |
| record2tsv     | 83.9        | 85.0          | 23.94        |
| record2lazyrow | 50.8        | 51.2          | 25.39        |

### LazyRow Conversions

| Conversion     | Mean (MB/s) | Median (MB/s) | Std Dev (ms) |
| -------------- | ----------- | ------------- | ------------ |
| lazyrow2csv    | 90.8        | 91.2          | 25.24        |
| lazyrow2tsv    | 93.0        | 93.2          | 22.01        |
| lazyrow2record | 94.4        | 93.6          | 25.08        |

## Key Findings

### Performance Ranking (by median throughput)

1. **lazyrow2record**: 93.6 MB/s (fastest)
2. **lazyrow2tsv**: 93.2 MB/s
3. **lazyrow2csv**: 91.2 MB/s
4. **record2csv**: 87.8 MB/s
5. **record2tsv**: 85.0 MB/s
6. **tsv2record**: 65.7 MB/s
7. **csv2tsv**: 65.1 MB/s
8. **csv2record**: 65.0 MB/s
9. **tsv2csv**: 64.8 MB/s
10. **record2lazyrow**: 51.2 MB/s
11. **csv2lazyrow**: 47.7 MB/s
12. **tsv2lazyrow**: 47.4 MB/s (slowest)

### Insights

**LazyRow is fastest for output** (90-94 MB/s):

- Binary format with pre-computed field lengths
- No quoting/escaping logic needed
- Direct memory writes

**Record format is fast for output** (84-88 MB/s):

- Simple delimiter replacement
- No quoting/escaping needed
- SIMD optimization for record→TSV

**CSV/TSV parsing is moderate** (64-66 MB/s):

- RFC 4180 quote handling
- Field boundary detection
- Character-by-character scanning

**LazyRow encoding is slowest** (47-51 MB/s):

- Field length calculation overhead
- Multiple passes over data
- Memory allocation for length arrays

### Variance Analysis

Low variance (19-29ms std dev) indicates:

- Stable VM optimization after warmup
- Consistent WASM performance
- Predictable throughput

Occasional outliers (max 1.5-2x mean) due to:

- Garbage collection pauses
- OS scheduling preemption
- Memory allocation spikes

## Performance Tuning Opportunities

Based on these results, optimization priorities:

1. **LazyRow encoding** (47-51 MB/s) - slowest operations
   - Profile field length calculation
   - Investigate memory allocation patterns
   - Consider single-pass encoding

2. **CSV/TSV parsing** (64-66 MB/s) - moderate performance
   - Already well-optimized with WASM
   - Further gains require algorithmic changes

3. **Record/LazyRow decoding** (84-94 MB/s) - already fast
   - Near-optimal performance
   - Focus elsewhere for gains

## Running the Benchmarks

```bash
# Full statistical benchmark (takes ~15 minutes)
deno run --allow-read --allow-write benchmarks/flatdata-statistical.ts

# Warmup diagnostic (quick check)
deno run --allow-read --allow-write benchmarks/flatdata-warmup-diagnostic.ts
```

## Next Steps

1. Profile lazyrow encoding to identify bottlenecks
2. Test with different data sizes (1MB, 100MB, 1GB)
3. Compare WASM vs pure TypeScript implementations
4. Investigate SIMD opportunities for CSV parsing
