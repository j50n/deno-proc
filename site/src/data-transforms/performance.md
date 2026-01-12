# Performance Guide

Comprehensive benchmarks, optimization strategies, and format selection guidance for data transforms.

## Performance Overview

All performance data is based on comprehensive benchmarks across multiple dataset sizes and configurations. Tests include realistic data with special characters (café, naïve, 🚀, 東京, москва) to ensure real-world applicability.

## Format Performance Comparison

### Parsing Throughput (MB/s)

| Format | Small (1K) | Medium (10K) | Large (50K) | Best Use Case |
|--------|------------|--------------|-------------|---------------|
| **Record** | 59.95 | 86.34 | 93.34 | Maximum throughput |
| **JSON** | 98.20 | 80.68 | 70.31 | Rich object structures |
| **TSV** | 71.61 | 116.00 | 56.88 | Human readable + fast |
| **CSV** | 9.82 | 17.09 | 27.29 | Universal compatibility |

### Stringify Throughput (MB/s)

| Format | Small (1K) | Medium (10K) | Large (50K) | 
|--------|------------|--------------|-------------|
| **JSON** | 318.54 | 224.10 | 185.42 |
| **Record** | 188.16 | 89.86 | 220.38 |
| **TSV** | 156.83 | 166.69 | 145.24 |
| **CSV** | 44.40 | 56.78 | 71.09 |

## LazyRow Performance Benefits

### CSV with LazyRow

| Dataset Size | Regular | LazyRow | Improvement |
|--------------|---------|---------|-------------|
| Small (1K)   | 9.82 MB/s | 14.81 MB/s | **+51%** |
| Medium (10K) | 17.09 MB/s | 19.14 MB/s | **+12%** |
| Large (50K)  | 27.29 MB/s | 29.29 MB/s | **+7%** |

### TSV with LazyRow

| Dataset Size | Regular | LazyRow | Improvement |
|--------------|---------|---------|-------------|
| Small (1K)   | 71.61 MB/s | 104.09 MB/s | **+45%** |
| Medium (10K) | 116.00 MB/s | 81.59 MB/s | **-30%** |
| Large (50K)  | 56.88 MB/s | 88.25 MB/s | **+55%** |

### Record with LazyRow

| Dataset Size | Regular | LazyRow | Improvement |
|--------------|---------|---------|-------------|
| Small (1K)   | 59.95 MB/s | 102.96 MB/s | **+72%** |
| Medium (10K) | 86.34 MB/s | 64.23 MB/s | **-26%** |
| Large (50K)  | 93.34 MB/s | 77.02 MB/s | **-17%** |

> **Key Insight**: LazyRow excels with CSV (always faster) and shows mixed results with TSV/Record depending on dataset size and access patterns.

## Format Selection Guide

### Choose CSV When:
- **Compatibility is critical** (Excel, legacy systems)
- **Human readability matters** 
- **Data contains complex quoting/escaping**
- **Always use LazyRow** for performance

```typescript
// Best practice for CSV
await read("data.csv")
  .transform(fromCsvToLazyRows())  // Always use LazyRow
  .filter(row => row.getField(0).startsWith("A"))
  .collect();
```

### Choose TSV When:
- **Balance of speed and readability** needed
- **Data doesn't contain tabs or newlines**
- **Processing medium-large datasets**
- **Use LazyRow selectively** based on access patterns

```typescript
// TSV with selective LazyRow usage
if (datasetSize > 10000 && accessPattern === "selective") {
  // Use LazyRow for large datasets with selective access
  await read("data.tsv").transform(fromTsvToLazyRows());
} else {
  // Use regular parsing for smaller datasets or full access
  await read("data.tsv").transform(fromTsvToRows());
}
```

### Choose JSON When:
- **Rich object structures** required
- **Nested data** or **arrays** in fields
- **API integration** or **configuration data**
- **Small to medium datasets** (performance degrades on large data)

```typescript
// JSON for complex structures
await read("events.jsonl")
  .transform(fromJsonToRows<EventData>({ 
    schema: EventSchema,
    sampleSize: 1000  // Validate first 1000 rows only
  }))
  .collect();
```

### Choose Record When:
- **Maximum throughput** is critical
- **Internal processing** (not human-readable)
- **Binary-safe data** (any UTF-8 content)
- **Large datasets** with **full field access**

```typescript
// Record for maximum performance
await read("data.record")
  .transform(fromRecordToRows())
  .map(processAllFields)  // Process all fields efficiently
  .collect();
```

## Optimization Strategies

### 1. Streaming Processing

Always use streaming for large datasets:

```typescript
// ✅ Constant memory usage
await read("10gb-file.csv")
  .transform(fromCsvToLazyRows())
  .filter(row => row.getField(0) === "target")
  .transform(toRecord())
  .writeTo("filtered.record");

// ❌ Memory explosion
const allData = await read("10gb-file.csv")
  .transform(fromCsvToRows())
  .collect();  // Loads entire file into memory!
```

### 2. Format Conversion for Repeated Processing

Convert slow formats to fast formats for repeated use:

```typescript
// One-time conversion
await read("data.csv")           // 27 MB/s
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("data.record");

// Subsequent processing is 3x faster
await read("data.record")        // 93 MB/s
  .transform(fromRecordToRows())
  .filter(row => row[1] === "target")
  .collect();
```

### 3. Selective Field Access with LazyRow

Only parse fields you actually use:

```typescript
// ✅ Efficient - only parses field 0 and 5
await read("wide-data.csv")
  .transform(fromCsvToLazyRows())
  .filter(row => {
    const id = row.getField(0);      // Parse field 0
    const status = row.getField(5);  // Parse field 5
    return id.startsWith("A") && status === "active";
    // Fields 1-4, 6+ never parsed
  })
  .collect();

// ❌ Less efficient - parses all fields
await read("wide-data.csv")
  .transform(fromCsvToRows())
  .filter(row => {
    return row[0].startsWith("A") && row[5] === "active";
    // All fields parsed upfront
  })
  .collect();
```

### 4. Early Filtering

Filter data as early as possible in the pipeline:

```typescript
// ✅ Filter first, then process
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .filter(row => row.getField(0) === "target")  // Fast filter
  .map(row => expensiveProcessing(row))         // Expensive operation
  .collect();

// ❌ Process first, then filter  
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .map(row => expensiveProcessing(row))         // Runs on everything
  .filter(result => result.type === "target")  // Then filters
  .collect();
```

### 5. Batch Processing for Memory Control

Process large datasets in controlled batches:

```typescript
const batchSize = 10000;
let batch: LazyRow[] = [];
let processedCount = 0;

await read("huge-dataset.csv")
  .transform(fromCsvToLazyRows())
  .forEach(async (row) => {
    batch.push(row);
    
    if (batch.length >= batchSize) {
      await processBatch(batch);
      processedCount += batch.length;
      console.log(`Processed ${processedCount} rows`);
      batch = [];
    }
  });

// Process remaining rows
if (batch.length > 0) {
  await processBatch(batch);
}
```

## Memory Usage Patterns

### Streaming Memory Usage

All transforms maintain constant memory usage:

```typescript
// Memory usage remains ~128KB regardless of file size
await read("1gb-file.csv")    // ~128KB memory
  .transform(fromCsvToRows())
  .filter(row => row[0] === "A")
  .collect();

await read("100gb-file.csv")  // Still ~128KB memory
  .transform(fromCsvToRows())
  .filter(row => row[0] === "A")
  .collect();
```

### LazyRow Caching Overhead

LazyRow caching adds minimal memory overhead:

```typescript
const lazyRow = LazyRow.fromStringArray(['Alice', '30', 'Engineer']);

// Initial: ~50 bytes (string array)
const binary = lazyRow.toBinary();
// After binary conversion: ~80 bytes (string array + cached binary)

const fields = lazyRow.toStringArray();
// No additional memory (returns original string array)
```

## Benchmark Methodology

### Test Data Characteristics

- **Special characters**: café, naïve, 🚀, 東京, москва
- **Realistic field sizes**: Names, emails, addresses, descriptions
- **Proper UTF-8 encoding**: Multi-byte character handling
- **Various column counts**: 10-column and 100-column datasets
- **Multiple sizes**: 1K, 10K, 50K, 200K rows

### Dataset Configurations

```typescript
// Small datasets (quick tests)
small_10col:   1,000 rows × 10 columns  (~40KB)
small_100col:    100 rows × 100 columns (~40KB)

// Medium datasets (realistic workloads)  
medium_10col:  50,000 rows × 10 columns  (~2MB)
medium_100col: 10,000 rows × 100 columns (~4MB)

// Large datasets (stress tests)
large_10col:  200,000 rows × 10 columns  (~8MB)
```

### Measurement Methodology

- **Throughput**: Measured in MB/s of input data processed
- **Multiple runs**: Each test runs 5 iterations, reports average
- **Warm-up**: First iteration discarded to account for JIT compilation
- **Memory measurement**: Peak memory usage during processing
- **Error handling**: Proper file cleanup and error propagation

## Real-World Performance Examples

### Log Processing Pipeline

```typescript
// Process 1GB of web server logs
const startTime = Date.now();
let errorCount = 0;

await read("access.log.tsv")  // 1GB file
  .transform(fromTsvToLazyRows())
  .filter(row => {
    const status = row.getField(6);
    return status.startsWith("4") || status.startsWith("5");
  })
  .forEach(row => {
    errorCount++;
    // Process error details
  });

const duration = Date.now() - startTime;
const throughput = (1024 / (duration / 1000)).toFixed(2);
console.log(`Processed 1GB in ${duration}ms (${throughput} MB/s)`);
console.log(`Found ${errorCount} errors`);
```

### Data Migration Performance

```typescript
// Migrate 10M records from CSV to Record format
const startTime = Date.now();
let recordCount = 0;

await read("legacy-data.csv")  // 2GB CSV file
  .transform(fromCsvToLazyRows())
  .drop(1)  // Skip header
  .map(row => {
    recordCount++;
    if (recordCount % 100000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (recordCount / elapsed).toFixed(0);
      console.log(`Migrated ${recordCount} records (${rate} records/sec)`);
    }
    return row.toStringArray();
  })
  .transform(toRecord())
  .writeTo("optimized-data.record");

const totalTime = (Date.now() - startTime) / 1000;
console.log(`Migration complete: ${recordCount} records in ${totalTime}s`);
```

## Performance Troubleshooting

### Identifying Bottlenecks

```typescript
// Add timing to identify slow operations
const timings: Record<string, number> = {};

const timeOperation = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  const result = await operation();
  timings[name] = Date.now() - start;
  return result;
};

await timeOperation("parse", () =>
  read("data.csv").transform(fromCsvToRows()).collect()
);

await timeOperation("filter", () =>
  enumerate(data).filter(row => row[0] === "target").collect()
);

await timeOperation("stringify", () =>
  enumerate(filteredData).transform(toCsv()).writeTo("output.csv")
);

console.log("Timings:", timings);
```

### Memory Usage Monitoring

```typescript
// Monitor memory usage during processing
const logMemoryUsage = () => {
  if (typeof Deno !== "undefined" && Deno.memoryUsage) {
    const usage = Deno.memoryUsage();
    console.log(`Memory: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }
};

let processedRows = 0;
await read("large-file.csv")
  .transform(fromCsvToRows())
  .forEach(row => {
    processedRows++;
    if (processedRows % 10000 === 0) {
      logMemoryUsage();
    }
  });
```

## Best Practices Summary

1. **Choose the right format** based on your use case and performance requirements
2. **Use LazyRow with CSV** - it's always faster
3. **Use LazyRow selectively** with TSV/Record based on dataset size and access patterns
4. **Stream large datasets** - never load everything into memory
5. **Filter early** in the pipeline to reduce processing overhead
6. **Convert formats** for repeated processing of the same data
7. **Access fields selectively** with LazyRow to minimize parsing
8. **Monitor performance** in production to identify bottlenecks
9. **Use batching** for memory-constrained environments
10. **Handle errors gracefully** with proper cleanup

## Next Steps

- [CSV Transforms](./csv.md) - Detailed CSV optimization
- [LazyRow Guide](./lazyrow.md) - Advanced LazyRow patterns
- [Record Format](./record.md) - Maximum performance format
- [JSON Transforms](./json.md) - Object structure handling
