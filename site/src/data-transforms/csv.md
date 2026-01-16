# CSV Transforms

Parse and generate CSV (Comma-Separated Values) files with RFC 4180 compliance
and LazyRow optimization.

> ⚠️ **Experimental (v0.24.0+)**: CSV transforms are under active development.
> API may change as we improve correctness and streaming performance. Test
> thoroughly with your data patterns.

> **⚡ Need more speed?** Use `fromCsvToRowsFast()` for significantly better performance.
> It uses the same WASM parser as flatdata CLI. See
> [Fast CSV Parsing](#fast-csv-parsing-wasm) below.

## Overview

CSV transforms provide robust parsing and generation of CSV files with proper
handling of quoted fields, escaping, and edge cases.

**Tip**: Use LazyRow (`fromCsvToLazyRows()`) for better performance, especially when you only need to access a few fields from each row.

## Basic Usage

### Parsing CSV to Rows

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse CSV into string arrays
const rows = await read("data.csv")
  .transform(fromCsvToRows())
  .collect();

// rows[0] = ["Name", "Age", "City"]        // Header
// rows[1] = ["Alice", "30", "New York"]    // Data row
// rows[2] = ["Bob", "25", "London"]        // Data row
```

### Parsing CSV to LazyRow (Recommended)

```typescript
import { fromCsvToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse CSV into optimized LazyRow format
const lazyRows = await read("data.csv")
  .transform(fromCsvToLazyRows())
  .collect();

// Efficient field access
for (const row of lazyRows) {
  const name = row.getField(0);
  const age = parseInt(row.getField(1));
  const city = row.getField(2);

  if (age >= 18) {
    console.log(`${name} from ${city} is an adult`);
  }
}
```

### Generating CSV

```typescript
import { toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

// From string arrays
const data = [
  ["Name", "Age", "City"],
  ["Alice", "30", "New York"],
  ["Bob", "25", "London"],
];

await enumerate(data)
  .transform(toCsv())
  .writeTo("output.csv");
```

## Advanced Parsing Options

### Custom Separators

```typescript
// Parse semicolon-separated values
const rows = await read("european.csv")
  .transform(fromCsvToRows({ separator: ";" }))
  .collect();
```

### Handling Comments

```typescript
// Skip lines starting with #
const rows = await read("data-with-comments.csv")
  .transform(fromCsvToRows({ comment: "#" }))
  .collect();
```

### Flexible Field Counts

```typescript
// Allow variable number of fields per row
const rows = await read("irregular.csv")
  .transform(fromCsvToRows({ fieldsPerRecord: -1 }))
  .collect();
```

### Complete Options

```typescript
interface CsvParseOptions {
  separator?: string; // Field separator (default: ",")
  comment?: string; // Comment character to ignore lines
  trimLeadingSpace?: boolean; // Trim leading whitespace
  lazyQuotes?: boolean; // Allow lazy quotes
  fieldsPerRecord?: number; // Expected fields per record (-1 for variable)
}

const rows = await read("complex.csv")
  .transform(fromCsvToRows({
    separator: ",",
    comment: "#",
    trimLeadingSpace: true,
    lazyQuotes: false,
    fieldsPerRecord: 5,
  }))
  .collect();
```

## Advanced Generation Options

### Custom Output Format

```typescript
interface CsvStringifyOptions {
  separator?: string; // Field separator (default: ",")
  crlf?: boolean; // Use CRLF line endings (default: true)
  quote?: string; // Quote character (default: '"')
  quotedFields?: boolean; // Quote all fields (default: false)
}

await enumerate(data)
  .transform(toCsv({
    separator: ";",
    crlf: false, // Use LF only
    quotedFields: true, // Quote all fields
  }))
  .writeTo("european.csv");
```

### Handling Special Characters

```typescript
// Data with commas, quotes, and newlines
const complexData = [
  ["Product", "Description", "Price"],
  ["Widget A", 'A "premium" widget, very nice', "$19.99"],
  ["Widget B", "Contains commas, and\nnewlines", "$29.99"],
];

// Automatically handles quoting and escaping
await enumerate(complexData)
  .transform(toCsv())
  .writeTo("products.csv");

// Output:
// Product,Description,Price
// Widget A,"A ""premium"" widget, very nice",$19.99
// "Widget B","Contains commas, and
// newlines",$29.99
```

## Real-World Examples

### Data Cleaning Pipeline

```typescript
// Clean and validate CSV data
await read("messy-data.csv")
  .transform(fromCsvToLazyRows())
  .drop(1) // Skip header
  .filter((row) => row.columnCount >= 3) // Ensure minimum columns
  .map((row) => [
    row.getField(0).trim(), // Clean name
    row.getField(1).replace(/[^\d]/g, ""), // Extract digits only
    row.getField(2).toLowerCase(), // Normalize city
  ])
  .filter((row) => row[1].length > 0) // Remove invalid ages
  .transform(toCsv())
  .writeTo("cleaned-data.csv");
```

### CSV to JSON Conversion

```typescript
import { toJson } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Convert CSV to JSON with headers
const csvData = await read("employees.csv")
  .transform(fromCsvToLazyRows())
  .collect();

const headers = csvData[0].toStringArray();
const dataRows = csvData.slice(1);

await enumerate(dataRows)
  .map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row.getField(i);
    }
    return obj;
  })
  .transform(toJson())
  .writeTo("employees.jsonl");
```

### Large File Processing

```typescript
// Process 10GB CSV file with constant memory usage
let processedCount = 0;

await read("huge-dataset.csv")
  .transform(fromCsvToLazyRows())
  .drop(1) // Skip header
  .filter((row) => {
    const status = row.getField(3);
    return status === "active";
  })
  .map((row) => {
    processedCount++;
    if (processedCount % 100000 === 0) {
      console.log(`Processed ${processedCount} rows`);
    }

    return [
      row.getField(0), // ID
      row.getField(1), // Name
      new Date().toISOString(), // Processing timestamp
    ];
  })
  .transform(toCsv())
  .writeTo("active-users.csv");
```

### Excel-Compatible Output

```typescript
// Generate CSV that opens correctly in Excel
const salesData = [
  ["Date", "Product", "Amount", "Currency"],
  ["2024-01-15", "Widget A", "1,234.56", "USD"],
  ["2024-01-16", "Widget B", "2,345.67", "EUR"],
];

await enumerate(salesData)
  .transform(toCsv({
    crlf: true, // Windows line endings
    quotedFields: true, // Quote all fields for safety
  }))
  .writeTo("sales-report.csv");
```

## Error Handling

### Common CSV Errors

```typescript
try {
  await read("problematic.csv")
    .transform(fromCsvToRows())
    .collect();
} catch (error) {
  if (error.message.includes("quote")) {
    console.error("Malformed quotes in CSV");
  } else if (error.message.includes("field")) {
    console.error("Inconsistent field count");
  } else if (error.message.includes("UTF-8")) {
    console.error("Invalid character encoding");
  }
}
```

### Validation During Processing

```typescript
// Validate data during parsing
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .drop(1) // Skip header
  .map((row, index) => {
    if (row.columnCount !== 3) {
      throw new Error(
        `Row ${index + 2} has ${row.columnCount} fields, expected 3`,
      );
    }

    const age = parseInt(row.getField(1));
    if (isNaN(age) || age < 0 || age > 150) {
      throw new Error(`Row ${index + 2} has invalid age: ${row.getField(1)}`);
    }

    return row.toStringArray();
  })
  .transform(toCsv())
  .writeTo("validated.csv");
```

## Performance Tips

### Use LazyRow for Large Files

```typescript
// ✅ Efficient - only parse fields you need
await read("large.csv")
  .transform(fromCsvToLazyRows())
  .filter((row) => row.getField(0).startsWith("A")) // Only parse field 0
  .collect();

// ❌ Less efficient - parses all fields upfront
await read("large.csv")
  .transform(fromCsvToRows())
  .filter((row) => row[0].startsWith("A"))
  .collect();
```

### Batch Processing

```typescript
// Process in batches for memory efficiency
const batchSize = 1000;
let batch: string[][] = [];

await read("huge.csv")
  .transform(fromCsvToRows())
  .forEach(async (row) => {
    batch.push(row);

    if (batch.length >= batchSize) {
      await processBatch(batch);
      batch = [];
    }
  });

// Process remaining rows
if (batch.length > 0) {
  await processBatch(batch);
}
```

### Convert to Faster Formats

```typescript
// Convert CSV to Record format for faster subsequent processing
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("data.record");

// Later processing is 3-10x faster
await read("data.record")
  .transform(fromRecordToRows())
  .filter((row) => row[1] === "target")
  .collect();
```

## Integration with Other Formats

### CSV → TSV

```typescript
import { toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toTsv())
  .writeTo("data.tsv");
```

### CSV → Record

```typescript
import { toRecord } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("data.record");
```

## Best Practices

1. **Use `fromCsvToRowsFast()` for large files** — 10x faster than the standard
   parser
2. **Use LazyRow** for CSV processing when you don't need all fields
3. **Handle headers explicitly** — they're treated as regular data rows
4. **Validate field counts** if your data requires consistent structure
5. **Use streaming processing** for large files to maintain constant memory
   usage
6. **Convert to faster formats** for repeated processing of the same data

## Fast CSV Parsing (WASM)

For maximum in-process performance, use the WASM-powered transforms:

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import {
  fromCsvToLazyRowsFast,
  fromCsvToRowsFast,
} from "jsr:@j50n/proc@{{gitv}}/transforms";

// ~10x faster than fromCsvToRows()
const rows = await read("large-file.csv")
  .transform(fromCsvToRowsFast())
  .flatMap((batch) => batch) // Flatten batches
  .collect();

// Or with LazyRow
const lazyRows = await read("large-file.csv")
  .transform(fromCsvToLazyRowsFast())
  .flatMap((batch) => batch)
  .collect();
```

**Key differences from standard parser:**

- Returns batches of rows (`string[][]`) instead of individual rows
- Uses the same WASM engine as flatdata CLI
- Same RFC 4180 compliance and options

**When to use which:**

| Parser                | Performance | Use Case                            |
| --------------------- | ----------- | ----------------------------------- |
| `fromCsvToRows()`     | Moderate    | Small files, simple scripts         |
| `fromCsvToRowsFast()` | Fast        | Large files, performance-critical   |
| `flatdata` CLI        | Fastest     | Maximum throughput, batch pipelines |

## See Also

- [TSV Transforms](./tsv.md) — Faster tab-separated processing
- [LazyRow Guide](./lazyrow.md) — Detailed LazyRow usage patterns
- [Performance Guide](./performance.md) — Optimization strategies
- [flatdata CLI](../utilities/flatdata.md) — Maximum throughput via subprocess
