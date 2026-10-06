# CSV Transforms

Parse and generate CSV (Comma-Separated Values) files with RFC 4180 compliance
and LazyRow optimization.

> ⚠️ **Experimental (v0.24.0+)**: CSV transforms are under active development.
> API may change as we improve correctness and streaming performance. Test
> thoroughly with your data patterns.

> **⚡ WASM-powered**: CSV parsing, and conversion between CSV and TSV, run in
> WebAssembly with SIMD. See [How Fast](#how-fast) below.

## Overview

CSV transforms provide robust parsing and generation of CSV files with proper
handling of quoted fields, escaping, and edge cases.

**Tip**: Use LazyRow (`fromCsvToLazyRows()`) for better performance, especially
when you only need to access a few fields from each row.

## Basic Usage

### Parsing CSV to Rows

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse CSV into string arrays
const rows = await read("data.csv")
  .transform(fromCsvToRows())
  .flatten()
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
  .flatten()
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
  .flatten()
  .collect();
```

### Rows of Different Lengths

Rows don't have to have the same number of fields. Each comes back as it is in
the file, so check `row.length` if your data needs a fixed width.

### Complete Options

These are all the options there are:

```typescript
interface CsvParseOptions {
  separator?: string; // Field separator (default: ",")
}

interface CsvStringifyOptions {
  separator?: string; // Field separator (default: ",")
  crlf?: boolean; // End lines with CRLF instead of LF (default: false)
}
```

The separator must be one ASCII character other than a quote, CR, or LF;
anything else throws a `RangeError` when the transform is created. Lines that
start with `#` are data like any other, and fields keep their spaces.

## Advanced Generation Options

### Custom Output Format

```typescript
await enumerate(data)
  .transform(toCsv({
    separator: ";",
    crlf: true, // For tools that expect Windows line endings
  }))
  .writeTo("european.csv");
```

Fields are quoted only when they need it: when they hold the separator, a quote,
CR, or LF.

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
// Widget B,"Contains commas, and
// newlines",$29.99
```

## Real-World Examples

### Data Cleaning Pipeline

```typescript
// Clean and validate CSV data
await read("messy-data.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
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
  .flatten()
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
  .flatten()
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
  .transform(toCsv({ crlf: true })) // Windows line endings
  .writeTo("sales-report.csv");
```

## Error Handling

### What the Parser Accepts

The parser is lenient. It doesn't throw on rows of different lengths, on a stray
quote inside an unquoted field, or on a quoted field left open at the end of the
input; it keeps what it read. A quote opens a quoted field only at the start of
a field, and text after a closing quote is kept (`"a"b` reads as `ab`). Lines
end in LF or CRLF; blank lines are skipped; a UTF-8 byte order mark at the start
is dropped.

It rejects two things. A CR outside quotes that isn't the CR of a CRLF, as in a
file with old Mac CR-only line ends, throws an `Error` such as
`Invalid character (CR) in CSV data at row 1, field 2`; inside quotes a CR is
kept. Invalid UTF-8 throws a `TypeError`. Either way, rows of earlier batches
have already gone down the pipeline.

```typescript
try {
  await read("problematic.csv")
    .transform(fromCsvToRows())
    .flatten()
    .collect();
} catch (error) {
  if (error instanceof TypeError) {
    console.error("Invalid character encoding");
  } else {
    throw error;
  }
}
```

Check field counts and values yourself, as below.

### Validation During Processing

```typescript
// Validate data during parsing
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
  .drop(1) // Skip header
  .enum()
  .map(([row, index]) => {
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
  .flatten()
  .filter((row) => row.getField(0).startsWith("A")) // Only parse field 0
  .collect();

// ❌ Less efficient - parses all fields upfront
await read("large.csv")
  .transform(fromCsvToRows())
  .flatten()
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
  .flatten()
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

### Convert to Other Formats

```typescript
// Convert CSV to Record format for efficient processing
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("data.record");

// Later processing uses the optimized format
await read("data.record")
  .transform(fromRecordToRows())
  .flatten()
  .filter((row) => row[1] === "target")
  .collect();
```

## Integration with Other Formats

### CSV → TSV

`csvToTsv()` converts bytes to bytes without making strings, several times
faster than parsing rows and writing them. TSV can't hold a tab, CR or LF in a
field, so a CSV field holding one is an error, as with `toTsv()`:

```typescript
import { csvToTsv, tsvToCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.csv").transform(csvToTsv()).writeTo("data.tsv");

// And back, quoting fields as toCsv() does.
await read("data.tsv").transform(tsvToCsv()).writeTo("data.csv");
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

1. **Use LazyRow** for CSV processing when you don't need all fields
2. **Validate field counts** if your data requires consistent structure
3. **Use streaming processing** for large files to maintain constant memory
   usage
4. **Convert to other formats** for repeated processing of the same data

## How Fast

The CSV reader is WebAssembly built from Swift, finding quotes, separators and
line ends 64 bytes at a time with SIMD. Each batch holds the rows of about 128
KB of input. On realistic data (UTF-8, about one field in ten quoted, some with
newlines), roughly:

| Transform                      | MB/s |
| ------------------------------ | ---- |
| `fromCsvToRows()`              | 130  |
| `fromCsvToLazyRows()` + filter | 380  |
| `csvToTsv()`, `tsvToCsv()`     | 580  |
| `toCsv()`                      | 90   |

`benchmarks/transforms-throughput.ts` measures these on your machine.

## See Also

- [TSV Transforms](./tsv.md) — Tab-separated processing
- [LazyRow Guide](./lazyrow.md) — Detailed LazyRow usage patterns
- [Performance Guide](./performance.md) — Optimization strategies
- [flatdata CLI](../utilities/flatdata.md) — Multi-process streaming
