# Data Transforms

Transform structured data between formats with streaming support and high
performance.

> ⚠️ **Experimental API (v0.24.0+)**: Data transforms are new and under active
> development. While tests pass and performance is reasonable, expect API
> changes and edge cases as we improve correctness and streaming performance.
> Production use should include thorough testing of your specific data patterns.

## Choosing Your Approach

proc offers several ways to process data. Here's how to choose:

| Approach              | Best For                                     | Performance    |
| --------------------- | -------------------------------------------- | -------------- |
| **flatdata CLI**      | Large files (100MB+), batch processing       | Highest        |
| **Data Transforms**   | In-process conversion, filtering, enrichment | Good to High   |
| **Process Pipelines** | Shell-like operations, text processing       | Varies         |
| **Async Iterables**   | Custom logic, API data, any async source     | Varies         |

**Decision guide:**

- Converting CSV/TSV/JSON files? → **Data Transforms** (this chapter)
- Processing 100MB+ files for maximum speed? →
  [flatdata CLI](../utilities/flatdata.md)
- Running shell commands and piping output? →
  [Process Pipelines](../core/pipelines.md)
- Working with API responses or custom data? →
  [Async Iterables](../iterables/enumerable.md)

## Overview

The data transforms module converts between CSV, TSV, JSON, and Record formats.
All transforms stream data without loading everything into memory.

## Import

Data transforms are a separate import to keep the core library lightweight:

```typescript
// Core library
import { enumerate, read, run } from "jsr:@j50n/proc";

// Data transforms (separate import)
import {
  fromCsvToRows,
  fromJsonToRows,
  fromTsvToRows,
  toJson,
  toRecord,
  toTsv,
} from "jsr:@j50n/proc/transforms";
```

## Quick Start

```typescript
import { read } from "jsr:@j50n/proc";
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc/transforms";

// Convert CSV to TSV
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toTsv())
  .writeTo("data.tsv");
```

## Key Benefits

### 🚀 **Streaming & Performance**

- **Streaming design**: Constant memory usage regardless of file size
- **LazyRow optimization**: Faster parsing for CSV/TSV when accessing selective fields
- **flatdata CLI**: WASM-powered tool for very large files

### 📊 **Format Support**

- **CSV**: Universal compatibility with proper RFC 4180 compliance
- **TSV**: Fast, simple tab-separated format
- **JSON Lines**: Full object structure preservation
- **Record**: High-performance binary-safe format

### 🔄 **Flexible Data Types**

- **Row arrays**: `string[][]` for simple tabular data
- **LazyRow**: Optimized read-only access with lazy conversion
- **Objects**: Full JSON object support with optional validation

## When to Use Each Format

### CSV - Universal Compatibility

```typescript
// Best for: Compatibility, Excel integration, legacy systems
await read("legacy-data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord()) // Convert to faster format
  .writeTo("optimized.record");
```

### TSV - Speed + Readability

```typescript
// Best for: Fast processing, human-readable data
await read("logs.tsv")
  .transform(fromTsvToRows())
  .filter((row) => row[2] === "ERROR")
  .transform(toTsv())
  .writeTo("errors.tsv");
```

### JSON Lines - Rich Objects

```typescript
// Best for: Complex nested data, APIs, configuration
await read("events.jsonl")
  .transform(fromJsonToRows())
  .filter((event) => event.severity === "high")
  .transform(toJson())
  .writeTo("alerts.jsonl");
```

### Record - Maximum Performance

```typescript
// Best for: High-throughput processing, internal formats
await read("big-data.record")
  .transform(fromRecordToRows())
  .map((row) => [row[0], processValue(row[1]), row[2]])
  .transform(toRecord())
  .writeTo("processed.record");
```

## LazyRow: Optimized Data Access

LazyRow provides a read-only interface optimized for field access without
upfront parsing costs:

```typescript
import { fromCsvToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse CSV into LazyRow format
const lazyRows = await read("data.csv")
  .transform(fromCsvToLazyRows())
  .collect();

// Efficient field access
for (const row of lazyRows) {
  const name = row.getField(0); // Fast field access
  const age = row.getField(1); // No parsing until needed

  if (parseInt(age) > 18) {
    console.log(`Adult: ${name}`);
  }
}
```

### LazyRow Benefits

- **Zero conversion cost**: Choose optimal backing based on source
- **Lazy evaluation**: Parse fields only when accessed
- **Caching**: Repeated access uses cached results

## Real-World Examples

### Data Pipeline

```typescript
// Process sales data: CSV → filter → enrich → JSON
await read("sales.csv")
  .transform(fromCsvToLazyRows())
  .filter((row) => parseFloat(row.getField(3)) > 1000) // Amount > $1000
  .map((row) => ({
    id: row.getField(0),
    customer: row.getField(1),
    amount: parseFloat(row.getField(3)),
    processed: new Date().toISOString(),
  }))
  .transform(toJson())
  .writeTo("high-value-sales.jsonl");
```

### Format Conversion

```typescript
// Convert legacy CSV to Record format for efficient processing
await read("legacy.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("optimized.record");
```

### Log Processing

```typescript
// Parse structured logs and extract errors
await read("app.log.tsv")
  .transform(fromTsvToRows())
  .filter((row) => row[2] === "ERROR")
  .map((row) => ({
    timestamp: row[0],
    service: row[1],
    level: row[2],
    message: row[3],
  }))
  .transform(toJson())
  .writeTo("errors.jsonl");
```

## Memory Efficiency

All transforms use streaming processing:

```typescript
// ✅ Processes 10GB file with constant ~128KB memory usage
await read("huge-dataset.csv")
  .transform(fromCsvToRows())
  .filter((row) => row[0].startsWith("2024"))
  .transform(toTsv())
  .writeTo("filtered.tsv");

// ❌ Don't do this - loads everything into memory
const allRows = await read("huge-dataset.csv")
  .transform(fromCsvToRows())
  .collect(); // Memory explosion!
```

## Error Handling

Transforms use strict error handling:

```typescript
try {
  await read("data.csv")
    .transform(fromCsvToRows())
    .transform(toJson())
    .writeTo("output.jsonl");
} catch (error) {
  if (error.message.includes("Invalid UTF-8")) {
    console.error("File encoding issue");
  } else if (error.message.includes("CSV")) {
    console.error("Malformed CSV data");
  }
}
```

## See Also

- [CSV Transforms](./csv.md) — Detailed CSV parsing and generation
- [TSV Transforms](./tsv.md) — Tab-separated value processing
- [JSON Transforms](./json.md) — JSON Lines with validation
- [Record Format](./record.md) — High-performance binary format
- [LazyRow Optimization](./lazyrow.md) — Optimized data access patterns
- [Performance Guide](./performance.md) — Benchmarks and optimization tips
- [flatdata CLI](../utilities/flatdata.md) — WASM-powered processing at 330 MB/s
