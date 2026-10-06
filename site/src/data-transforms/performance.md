# Format Selection Guide

Guidance for choosing the right data format for your use case.

> ⚠️ **Experimental (v0.24.0+)**: Data transforms are under active development.
> API stability is not guaranteed as we improve correctness and streaming
> performance.

## Quick Format Comparison

| Format     | Best For                       | Notes                          |
| ---------- | ------------------------------ | ------------------------------ |
| **CSV**    | Universal compatibility        | Use LazyRow for better speed   |
| **TSV**    | Balance of speed & readability | Simpler than CSV               |
| **JSON**   | Rich object structures         | Best for small-medium datasets |
| **Record** | Any text in fields             | Internal processing only       |

## Measured Speeds

From `benchmarks/transforms-throughput.ts`: 100,000 rows of 20 realistic fields
(UTF-8, about one field in ten quoted, some with newlines), median MB/s on one
machine. Expect your numbers to differ; the ratios are what matter.

| Reading                     | MB/s | Writing and converting | MB/s |
| --------------------------- | ---- | ---------------------- | ---- |
| `fromCsvToRows()`           | 130  | `toCsv()`              | 90   |
| `fromCsvToLazyRows()`       | 350  | `toTsv()`              | 90   |
| filter with `fieldEquals()` | 380  | `toRecord()`           | 85   |
| `fromTsvToRows()`           | 135  | `toJson()`             | 100  |
| `fromTsvToLazyRows()`       | 450  | `csvToTsv()`           | 580  |
| `fromRecordToRows()`        | 95   | `tsvToCsv()`           | 580  |
| `fromJsonToRows()`          | 100  |                        |      |

CSV and TSV are read in WebAssembly; the LazyRow readers are fast because they
don't make strings until asked. Converting between CSV and TSV never makes
strings at all.

## Choosing a Format

### CSV - Universal Compatibility

Use when you need compatibility with Excel, legacy systems, or when human
readability matters.

```typescript
// Best practice: Use LazyRow with CSV
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
  .filter((row) => row.getField(0).startsWith("A"))
  .collect();
```

### TSV - Simple and Fast

Use when you want a balance of speed and readability, and your data doesn't
contain tabs or newlines.

```typescript
await read("data.tsv")
  .transform(fromTsvToRows())
  .flatten()
  .filter((row) => row[0].startsWith("A"))
  .collect();
```

### JSON - Rich Structures

Use when you need full object structures, nested data, or arrays in fields.

```typescript
await read("events.jsonl")
  .transform(fromJsonToRows<EventData>())
  .collect();
```

### Record - Any Text in Fields

Use for internal processing when fields may hold tabs, newlines or quotes and
you don't need human readability. Nothing is ever escaped.

```typescript
await read("data.record")
  .transform(fromRecordToRows())
  .flatten()
  .map(processAllFields)
  .collect();
```

## Key Optimization Tips

### 1. Always Stream Large Files

```typescript
// ✅ Good: Constant memory usage
await read("large-file.csv")
  .transform(fromCsvToRows())
  .flatten()
  .filter((row) => row[0] === "target")
  .writeTo("filtered.csv");

// ❌ Bad: Loads entire file into memory
const allData = await read("large-file.csv")
  .transform(fromCsvToRows())
  .flatten()
  .collect();
```

### 2. Use LazyRow for Selective Field Access

Only parse the fields you actually need:

```typescript
// Decodes only field 0, and only for active rows
await read("wide-data.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
  .filter((row) => row.fieldEquals(5, "active"))
  .filter((row) => row.getField(0).startsWith("A"))
  .collect();
```

### 3. Filter Early in the Pipeline

```typescript
// ✅ Good: Filter before expensive operations
await read("data.csv")
  .transform(fromCsvToRows())
  .flatten()
  .filter((row) => row[0] === "target")
  .map((row) => expensiveProcessing(row))
  .collect();
```

### 4. Convert Between CSV and TSV on the Bytes

`csvToTsv()` and `tsvToCsv()` never make strings, so they run several times
faster than parsing rows and writing them:

```typescript
await read("data.csv").transform(csvToTsv()).writeTo("data.tsv");
```

## See Also

- [CSV Transforms](./csv.md) - CSV parsing and generation
- [TSV Transforms](./tsv.md) - TSV processing
- [JSON Transforms](./json.md) - JSON Lines handling
- [Record Format](./record.md) - High-performance format
- [LazyRow Guide](./lazyrow.md) - Optimized field access
