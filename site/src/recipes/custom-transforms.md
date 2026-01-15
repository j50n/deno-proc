# Writing Custom Transforms

Create your own transforms to process data in ways the built-in transforms don't support.

## Transform Signature

A transform is a function that takes an async iterable and returns an async iterable:

```typescript
function myTransform<T, U>(iterable: AsyncIterable<T>): AsyncIterable<U> {
  // Your logic here
}
```

Use it with `.transform()`:

```typescript
await read("data.txt")
  .lines
  .transform(myTransform)
  .forEach(item => console.log(item));
```

## Simple Transform: Uppercase Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

async function* uppercase(lines: AsyncIterable<string>) {
  for await (const line of lines) {
    yield line.toUpperCase();
  }
}

await read("data.txt")
  .lines
  .transform(uppercase)
  .writeTo("data-upper.txt");
```

## Transform with Options

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

function addPrefix(prefix: string) {
  return async function* (lines: AsyncIterable<string>) {
    for await (const line of lines) {
      yield `${prefix}${line}`;
    }
  };
}

await read("data.txt")
  .lines
  .transform(addPrefix(">> "))
  .toStdout();
```

## Data Cleaning Transform

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* cleanRows(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    yield row.map(field => 
      field.trim()                    // Remove whitespace
           .replace(/\s+/g, " ")      // Normalize spaces
           .toLowerCase()              // Lowercase
    );
  }
}

await read("messy.csv")
  .transform(fromCsvToRows())
  .transform(cleanRows)
  .transform(toCsv())
  .writeTo("clean.csv");
```

## Adding Computed Columns

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* addProfit(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    const revenue = parseFloat(row[2]);
    const cost = parseFloat(row[3]);
    const profit = revenue - cost;
    const margin = (profit / revenue * 100).toFixed(1);
    
    yield [...row, profit.toFixed(2), `${margin}%`];
  }
}

await read("sales.csv")
  .transform(fromCsvToRows())
  .transform(addProfit)
  .transform(toCsv())
  .writeTo("sales-with-profit.csv");
```

## Filtering with State

Track state across rows:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

async function* deduplicateConsecutive(lines: AsyncIterable<string>) {
  let previous: string | undefined;
  
  for await (const line of lines) {
    if (line !== previous) {
      yield line;
      previous = line;
    }
  }
}

await read("log.txt")
  .lines
  .transform(deduplicateConsecutive)
  .writeTo("log-deduped.txt");
```

## Batching Transform

Group items into batches:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

function batch<T>(size: number) {
  return async function* (items: AsyncIterable<T>) {
    let batch: T[] = [];
    
    for await (const item of items) {
      batch.push(item);
      if (batch.length === size) {
        yield batch;
        batch = [];
      }
    }
    
    if (batch.length > 0) {
      yield batch;
    }
  };
}

await enumerate([1, 2, 3, 4, 5, 6, 7, 8, 9])
  .transform(batch(3))
  .forEach(batch => console.log(batch));
// Output: [1,2,3], [4,5,6], [7,8,9]
```

## Validation Transform

Filter out invalid rows and log errors:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* validateRows(rows: AsyncIterable<string[]>) {
  let lineNum = 0;
  
  for await (const row of rows) {
    lineNum++;
    
    // Validate: must have 4 columns, column 3 must be a number
    if (row.length !== 4) {
      console.error(`Line ${lineNum}: Expected 4 columns, got ${row.length}`);
      continue;
    }
    
    if (isNaN(parseFloat(row[2]))) {
      console.error(`Line ${lineNum}: Column 3 is not a number: ${row[2]}`);
      continue;
    }
    
    yield row;
  }
}

await read("data.csv")
  .transform(fromCsvToRows())
  .transform(validateRows)
  .transform(toCsv())
  .writeTo("valid-data.csv");
```

## Expanding Rows (1:N)

One input row becomes multiple output rows:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* expandDateRange(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    const [id, startDate, endDate] = row;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate one row per day in range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      yield [id, d.toISOString().split('T')[0]];
    }
  }
}

await read("date-ranges.csv")
  .transform(fromCsvToRows())
  .transform(expandDateRange)
  .transform(toCsv())
  .writeTo("daily-records.csv");
```

## When to Use Custom Transforms vs .map()

**Use `.map()` when:**
- Simple 1:1 transformation
- No state needed
- One-liner logic

```typescript
.map(row => row.map(field => field.trim()))
```

**Use custom transform when:**
- Need to maintain state across items
- Complex multi-step logic
- Want to reuse the transform
- Need to yield 0 or multiple items per input (filtering/expanding)

```typescript
.transform(myComplexTransform)
```

## Composing Transforms

Chain multiple custom transforms:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("data.csv")
  .transform(fromCsvToRows())
  .transform(cleanRows)        // Custom: clean data
  .transform(validateRows)     // Custom: validate
  .transform(addProfit)        // Custom: add columns
  .transform(toCsv())
  .writeTo("processed.csv");
```

## Error Handling in Transforms

<!-- NOT TESTED: Illustrative example -->
```typescript
async function* safeTransform(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    try {
      // Your processing logic
      const processed = processRow(row);
      yield processed;
    } catch (error) {
      console.error(`Error processing row: ${error.message}`);
      // Skip bad row or yield error marker
      continue;
    }
  }
}
```

## Performance Tips

1. **Avoid unnecessary conversions** — Work with the data type you have
2. **Use LazyRow for CSV/TSV** — Only parse fields you need
3. **Batch operations** — Process multiple items together when possible
4. **Keep transforms simple** — Complex logic in transforms is hard to debug

## Real-World Example: Log Enrichment

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

async function* enrichLogs(lines: AsyncIterable<string>) {
  let requestId = 0;
  
  for await (const line of lines) {
    const timestamp = new Date().toISOString();
    
    // Add timestamp and request ID to each log line
    if (line.includes("REQUEST")) {
      requestId++;
    }
    
    yield `[${timestamp}] [req:${requestId}] ${line}`;
  }
}

await read("app.log")
  .lines
  .transform(enrichLogs)
  .writeTo("app-enriched.log");
```

## Next Steps

- [Data Conversion](data-conversion.md) - Built-in format transforms
- [Data Cleaning Pipeline](data-cleaning.md) - Practical examples
- [Performance Guide](../data-transforms/performance.md) - Optimization
