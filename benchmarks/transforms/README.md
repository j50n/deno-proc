# Transform Functions Performance Benchmarks

This directory contains performance benchmarks for the transform functions library, designed to measure and compare the efficiency of different data format transformers.

## Benchmark Objectives

### Primary Goals
1. **Throughput measurement** - MB/s processing rates for each transformer
2. **Memory efficiency** - Peak memory usage during processing
3. **Latency analysis** - Time to first result in streaming scenarios
4. **Comparative analysis** - Head-to-head performance between formats
5. **LazyRow optimization validation** - Selective access performance benefits

### Performance Metrics
- **Parsing throughput**: Input data processed per second (MB/s)
- **Stringify throughput**: Output data generated per second (MB/s)  
- **Memory overhead**: Peak RSS vs input data size ratio
- **Streaming latency**: Time to first yielded batch
- **CPU efficiency**: Processing time vs wall clock time

## Test Scenarios

### Data Sizes
- **Small**: 1K rows (~40KB) - Micro-benchmark overhead analysis
- **Medium**: 10K rows (~400KB) - Typical application workloads
- **Large**: 100K+ rows (10MB+) - Stress testing and scalability

### Access Patterns
- **Full processing**: Access all fields in all rows (worst case for LazyRow)
- **Selective access**: Access only specific fields (LazyRow optimization target)
- **Streaming**: Process data in chunks without full materialization

### Format Comparison
- **CSV**: Complex parsing with quote handling (Deno std/csv)
- **TSV**: Simple tab-delimited parsing (custom implementation)
- **JSON**: Native JSON.parse with JSONL format
- **Record**: Binary format with ASCII control characters

## Benchmark Files

### `streaming_performance.ts` ⭐
- **Primary benchmark** using real file streaming with `enumerate(file.readable)`
- Tests multiple dataset sizes and column configurations
- Lightweight sanity checks to verify data integrity without overhead
- Isolates transform performance from data generation
- Measures true streaming throughput from disk

### `csv_performance.ts`
- CSV-specific parsing and stringify benchmarks
- Tests both `fromCsvToRows()` and `fromCsvToLazyRows()`
- Measures impact of Deno CSV library overhead
- Validates quote handling performance

### `lazy_row_performance.ts`
- LazyRow class micro-benchmarks
- Creation, field access, and conversion performance
- Access pattern analysis (sequential, selective, random)
- Overhead comparison vs direct string array access

### `comparative_analysis.ts`
- Head-to-head format comparison using generated data
- All transformers tested with identical datasets
- Performance ranking and efficiency analysis
- LazyRow vs Row performance ratios

## Test Data Generation

### Dataset Configurations
- **Small datasets**: 1K rows × 10 cols, 100 rows × 100 cols
- **Medium datasets**: 100K rows × 10 cols, 10K rows × 100 cols (~10MB each)
- **Large datasets**: 1M rows × 10 cols, 100K rows × 100 cols (~100MB each)

### Data Characteristics
- **Realistic field types**: IDs, names, emails, descriptions
- **Variable field lengths**: 5-50 characters per field
- **Multiple formats**: CSV, TSV, JSON generated for each configuration
- **Streaming friendly**: Generated directly to files, not held in memory

## Benchmark Methodology

### Streaming Approach
```typescript
// Primary benchmark pattern - true streaming from files
const file = await Deno.open(`benchmarks/data/${filename}`);
const result = await enumerate(file.readable)
  .transform(fromCsvToRows())
  .collect();
```

### Sanity Checking
- **Lightweight validation**: Row count within 20% of expected
- **No data inspection**: Avoids overhead that would skew performance
- **Early failure detection**: Stops benchmark if data is clearly wrong

### Stringify Isolation
- **Pre-generated test data**: Small datasets created once per benchmark
- **Consistent data size**: Limited to 1K rows to focus on transform speed
- **Multiple iterations**: Average of 3 runs to reduce variance

## Expected Performance Characteristics

### Format Speed Hierarchy (Parsing)
1. **TSV** - Fastest (simple string splitting)
2. **JSON** - Fast (native JSON.parse optimization)
3. **CSV** - Moderate (complex quote/escape handling)
4. **Record** - Variable (depends on field count and size)

### LazyRow Performance Profile
- **Slower** than Row for full data access (expected overhead)
- **Faster** than Row for selective field access (lazy evaluation benefit)
- **Memory efficient** for large datasets with sparse access patterns
- **Streaming friendly** with constant memory usage

### Throughput Targets
- **Parsing**: 20-100 MB/s depending on format complexity
- **Stringify**: 50-200 MB/s (generally faster than parsing)
- **Memory overhead**: <2x input size for streaming operations
- **Latency**: <10ms to first result for streaming transformers

## Running Benchmarks

```bash
# Complete benchmark suite (recommended)
./benchmarks/run_benchmarks.sh

# Generate test data only
./benchmarks/data/generate_datasets.ts

# Individual benchmarks
deno run --allow-read benchmarks/transforms/streaming_performance.ts
deno run --allow-read benchmarks/transforms/csv_performance.ts
deno run --allow-read benchmarks/transforms/lazy_row_performance.ts
deno run --allow-read benchmarks/transforms/comparative_analysis.ts
```

### Benchmark Runner Features
- **Automated linting** and type checking of benchmark scripts
- **Conditional data generation** - only creates files if missing
- **Timeout protection** - prevents runaway benchmarks
- **Progress reporting** - clear status and results summary

## Performance Validation Criteria

### Acceptance Thresholds
- **Parsing throughput**: >10 MB/s for all formats
- **Memory efficiency**: <3x input size peak usage
- **LazyRow selective advantage**: >2x faster than Row for <25% field access
- **Streaming latency**: <50ms to first batch for 1MB+ inputs

### Regression Detection
- **Throughput degradation**: >20% slower than baseline
- **Memory growth**: >50% increase in peak usage
- **Latency increase**: >100% slower time to first result

## Optimization Opportunities

### Current Focus Areas
1. **CSV parsing optimization** - Currently slowest format
2. **LazyRow creation overhead** - Reduce binary format construction cost
3. **Batching efficiency** - Optimize 128KB batch size for different scenarios
4. **UTF-8 decoding** - Streaming TextDecoder performance tuning

### Future Enhancements
- **Parallel processing** - Multi-threaded parsing for large datasets
- **Memory pooling** - Reuse buffers to reduce GC pressure
- **SIMD optimization** - Vectorized string processing where available
- **Compression integration** - Direct parsing from compressed streams
