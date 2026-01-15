# Converting Data Formats

Transform data between CSV, TSV, JSON, and Record formats with streaming support.

## CSV to TSV

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toTsv())
  .writeTo("data.tsv");
```

## CSV to JSON Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toJson } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("sales.csv")
  .transform(fromCsvToRows())
  .map(row => ({
    id: row[0],
    customer: row[1],
    amount: parseFloat(row[2])
  }))
  .transform(toJson())
  .writeTo("sales.jsonl");
```

## JSON Lines to CSV

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromJsonToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.jsonl")
  .transform(fromJsonToRows())
  .map(obj => [obj.id, obj.name, obj.email])
  .transform(toCsv())
  .writeTo("data.csv");
```

## TSV to JSON

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromTsvToRows, toJson } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.tsv")
  .transform(fromTsvToRows())
  .map(row => ({
    name: row[0],
    age: parseInt(row[1]),
    city: row[2]
  }))
  .transform(toJson())
  .writeTo("data.jsonl");
```

## Using LazyRow for Performance

For better performance when you only need some fields:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToLazyRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("large.csv")
  .transform(fromCsvToLazyRows())
  .filter(row => row.get(3) === "active")  // Only parse field 3
  .map(row => row.toRow())  // Convert to array
  .transform(toTsv())
  .writeTo("active.tsv");
```

**Performance gain:** 1.05-1.7x faster than regular rows when filtering.

## Convert with Filtering

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toJson } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("orders.csv")
  .transform(fromCsvToRows())
  .filter(row => parseFloat(row[3]) > 1000)  // High-value orders
  .map(row => ({
    orderId: row[0],
    customer: row[1],
    amount: parseFloat(row[3])
  }))
  .transform(toJson())
  .writeTo("high-value-orders.jsonl");
```

## Convert Compressed Files

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.csv.gz")
  .transform(new DecompressionStream("gzip"))
  .transform(fromCsvToRows())
  .transform(toTsv())
  .transform(new CompressionStream("gzip"))
  .writeTo("data.tsv.gz");
```

## Batch Convert Multiple Files

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate, read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toJson } from "jsr:@j50n/proc@{{gitv}}/transforms";

const files = ["data1.csv", "data2.csv", "data3.csv"];

await enumerate(files)
  .concurrentMap(async (file) => {
    const outFile = file.replace(".csv", ".jsonl");
    await read(file)
      .transform(fromCsvToRows())
      .map(row => ({ id: row[0], value: row[1] }))
      .transform(toJson())
      .writeTo(outFile);
    return outFile;
  }, { concurrency: 3 })
  .forEach(file => console.log(`Converted: ${file}`));
```

## Using Record Format (Fastest)

For maximum performance between proc scripts:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toRecord, fromRecordToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// CSV → Record (60-93 MB/s)
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("data.record");

// Record → process → TSV
await read("data.record")
  .transform(fromRecordToRows())
  .filter(row => row[0].startsWith("A"))
  .transform(toTsv())
  .writeTo("filtered.tsv");
```

**Record format is 2-3x faster than CSV for intermediate data.**

## Format Selection Guide

| Format     | Use When                                      | Speed      |
|------------|-----------------------------------------------|------------|
| **CSV**    | Human readable, universal compatibility       | 10-27 MB/s |
| **TSV**    | Simple, fast, human readable                  | 57-72 MB/s |
| **JSON**   | Need object structure, nested data            | 70-98 MB/s |
| **Record** | Intermediate format between proc scripts      | 60-93 MB/s |

## Custom Separators

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Read pipe-delimited
await read("data.psv")
  .transform(fromCsvToRows({ separator: "|" }))
  .transform(toCsv())  // Output as standard CSV
  .writeTo("data.csv");

// Write semicolon-delimited
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toCsv({ separator: ";" }))
  .writeTo("data-semicolon.csv");
```

## Next Steps

- [Writing Custom Transforms](custom-transforms.md) - Create your own transforms
- [Data Cleaning Pipeline](data-cleaning.md) - Practical data processing
- [Performance Guide](../data-transforms/performance.md) - Optimization tips
