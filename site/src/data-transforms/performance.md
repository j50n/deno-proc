# Format Selection Guide

Guidance for choosing the right data format for your use case.

> ⚠️ **Experimental (v0.24.0+)**: Data transforms are under active development.
> API stability is not guaranteed as we improve correctness and streaming
> performance.

## Quick Format Comparison

| Format     | Best For                        | Notes                          |
| ---------- | ------------------------------- | ------------------------------ |
| **CSV**    | Universal compatibility         | Use LazyRow for better speed   |
| **TSV**    | Balance of speed & readability  | Simpler than CSV               |
| **JSON**   | Rich object structures          | Best for small-medium datasets |
| **Record** | Maximum throughput              | Internal processing only       |

## Choosing a Format

### CSV - Universal Compatibility

Use when you need compatibility with Excel, legacy systems, or when human readability matters.

```typescript
// Best practice: Use LazyRow with CSV
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .filter((row) => row.getField(0).startsWith("A"))
  .collect();
```

### TSV - Simple and Fast

Use when you want a balance of speed and readability, and your data doesn't contain tabs or newlines.

```typescript
await read("data.tsv")
  .transform(fromTsvToRows())
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

### Record - Maximum Throughput

Use for internal processing when you need maximum throughput and don't need human readability.

```typescript
await read("data.record")
  .transform(fromRecordToRows())
  .map(processAllFields)
  .collect();
```

## Key Optimization Tips

### 1. Always Stream Large Files

```typescript
// ✅ Good: Constant memory usage
await read("large-file.csv")
  .transform(fromCsvToRows())
  .filter((row) => row[0] === "target")
  .writeTo("filtered.csv");

// ❌ Bad: Loads entire file into memory
const allData = await read("large-file.csv")
  .transform(fromCsvToRows())
  .collect();
```

### 2. Use LazyRow for Selective Field Access

Only parse the fields you actually need:

```typescript
// Only parses fields 0 and 5
await read("wide-data.csv")
  .transform(fromCsvToLazyRows())
  .filter((row) => {
    const id = row.getField(0);
    const status = row.getField(5);
    return id.startsWith("A") && status === "active";
  })
  .collect();
```

### 3. Filter Early in the Pipeline

```typescript
// ✅ Good: Filter before expensive operations
await read("data.csv")
  .transform(fromCsvToRows())
  .filter((row) => row[0] === "target")
  .map((row) => expensiveProcessing(row))
  .collect();
```

### 4. Convert Formats for Repeated Processing

If you're processing the same data multiple times, convert to a faster format first:

```typescript
// One-time conversion
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("data.record");

// Subsequent processing is faster
await read("data.record")
  .transform(fromRecordToRows())
  .filter((row) => row[1] === "target")
  .collect();
```

## See Also

- [CSV Transforms](./csv.md) - CSV parsing and generation
- [TSV Transforms](./tsv.md) - TSV processing
- [JSON Transforms](./json.md) - JSON Lines handling
- [Record Format](./record.md) - High-performance format
- [LazyRow Guide](./lazyrow.md) - Optimized field access
