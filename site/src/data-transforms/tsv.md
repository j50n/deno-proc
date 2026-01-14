# TSV Transforms

Fast, simple tab-separated value processing with excellent performance characteristics.

> ⚠️ **Experimental (v0.24.0+)**: TSV transforms are under active development. API may change as we improve correctness and streaming performance. Test thoroughly with your data patterns.

## Overview

TSV (Tab-Separated Values) provides a good balance between human readability and processing speed. With no complex quoting rules like CSV, TSV parsing is significantly faster while remaining easy to read and edit.

## Performance Characteristics

| Dataset Size | Regular Parsing | LazyRow Parsing | Improvement |
|--------------|----------------|-----------------|-------------|
| Small (1K)   | 71.61 MB/s     | 104.09 MB/s     | **+45%** |
| Medium (10K) | 116.00 MB/s    | 81.59 MB/s      | **-30%** |
| Large (50K)  | 56.88 MB/s     | 88.25 MB/s      | **+55%** |

> **Performance Note**: LazyRow shows mixed results with TSV - excellent for small and large datasets, but regular parsing can be faster for medium datasets with full field access.

## Basic Usage

### Parsing TSV to Rows

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromTsvToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse TSV into string arrays
const rows = await read("data.tsv")
  .transform(fromTsvToRows())
  .collect();

// rows[0] = ["Name", "Age", "City"]        // Header
// rows[1] = ["Alice", "30", "New York"]    // Data row
// rows[2] = ["Bob", "25", "London"]        // Data row
```

### Parsing TSV to LazyRow

```typescript
import { fromTsvToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse TSV into optimized LazyRow format
const lazyRows = await read("data.tsv")
  .transform(fromTsvToLazyRows())
  .collect();

// Efficient field access
for (const row of lazyRows) {
  const name = row.getField(0);
  const age = parseInt(row.getField(1));
  const city = row.getField(2);
  
  console.log(`${name} (${age}) lives in ${city}`);
}
```

### Generating TSV

```typescript
import { toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

// From string arrays
const data = [
  ["Name", "Age", "City"],
  ["Alice", "30", "New York"],
  ["Bob", "25", "London"]
];

await enumerate(data)
  .transform(toTsv())
  .writeTo("output.tsv");
```

## Format Characteristics

### Advantages
- **Fast parsing**: No complex quoting rules
- **Human readable**: Easy to view and edit
- **Simple format**: Minimal edge cases
- **Good performance**: 2-10x faster than CSV

### Limitations
- **No tabs in data**: Fields cannot contain tab characters
- **No newlines in data**: Fields cannot contain line breaks
- **Limited escaping**: No standard way to include tabs/newlines

### When to Use TSV
- Data doesn't contain tabs or newlines
- Performance is important but readability matters
- Processing log files or structured data
- Need faster alternative to CSV

## Real-World Examples

### Log File Processing

```typescript
// Process web server access logs
await read("access.log")
  .transform(fromTsvToLazyRows())
  .filter(row => {
    const statusCode = row.getField(6);
    return statusCode.startsWith("4") || statusCode.startsWith("5");
  })
  .map(row => ({
    timestamp: row.getField(0),
    method: row.getField(3),
    path: row.getField(4),
    status: row.getField(6),
    userAgent: row.getField(8)
  }))
  .transform(toJson())
  .writeTo("errors.jsonl");
```

### Data Pipeline

```typescript
// ETL pipeline: TSV → filter → transform → TSV
await read("raw-data.tsv")
  .transform(fromTsvToLazyRows())
  .drop(1)  // Skip header
  .filter(row => {
    const score = parseFloat(row.getField(3));
    return score >= 0.8;  // High-quality records only
  })
  .map(row => [
    row.getField(0),                    // ID
    row.getField(1).toUpperCase(),      // Name (normalized)
    row.getField(2).toLowerCase(),      // Email (normalized)
    (parseFloat(row.getField(3)) * 100).toFixed(1)  // Score as percentage
  ])
  .transform(toTsv())
  .writeTo("processed-data.tsv");
```

### Format Conversion

```typescript
// Convert CSV to TSV (faster processing)
await read("data.csv")
  .transform(fromCsvToRows())
  .transform(toTsv())
  .writeTo("data.tsv");

// Later processing is faster
await read("data.tsv")
  .transform(fromTsvToRows())
  .filter(row => row[0].startsWith("A"))
  .collect();
```

### Streaming Analytics

```typescript
// Real-time log analysis
let requestCount = 0;
let errorCount = 0;
const statusCodes = new Map<string, number>();

await read("live-access.log")
  .transform(fromTsvToLazyRows())
  .forEach(row => {
    requestCount++;
    
    const statusCode = row.getField(6);
    statusCodes.set(statusCode, (statusCodes.get(statusCode) || 0) + 1);
    
    if (statusCode.startsWith("4") || statusCode.startsWith("5")) {
      errorCount++;
    }
    
    if (requestCount % 1000 === 0) {
      const errorRate = (errorCount / requestCount * 100).toFixed(2);
      console.log(`Processed ${requestCount} requests, error rate: ${errorRate}%`);
    }
  });
```

## Performance Optimization

### Choose LazyRow Based on Access Pattern

```typescript
// ✅ Use LazyRow for selective field access
await read("wide-data.tsv")
  .transform(fromTsvToLazyRows())
  .filter(row => {
    // Only parse fields 0 and 5
    const id = row.getField(0);
    const status = row.getField(5);
    return id.startsWith("USER_") && status === "active";
  })
  .collect();

// ✅ Use regular parsing for full field access
await read("data.tsv")
  .transform(fromTsvToRows())
  .map(row => {
    // Process all fields
    return processAllFields(row);
  })
  .collect();
```

### Batch Processing for Large Files

```typescript
// Process large TSV files in batches
const batchSize = 5000;
let batch: string[][] = [];

await read("huge-data.tsv")
  .transform(fromTsvToRows())
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

## Data Validation

### Field Count Validation

```typescript
// Ensure consistent field counts
const expectedFields = 5;
const errors: string[] = [];

await read("data.tsv")
  .transform(fromTsvToRows())
  .forEach((row, index) => {
    if (row.length !== expectedFields) {
      errors.push(`Row ${index + 1}: Expected ${expectedFields} fields, got ${row.length}`);
    }
  });

if (errors.length > 0) {
  console.error(`Validation failed:\n${errors.join('\n')}`);
}
```

### Data Type Validation

```typescript
// Validate data types during processing
await read("metrics.tsv")
  .transform(fromTsvToLazyRows())
  .drop(1)  // Skip header
  .map((row, index) => {
    const rowNum = index + 2;
    
    // Validate timestamp
    const timestamp = row.getField(0);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
      throw new Error(`Row ${rowNum}: Invalid timestamp format: ${timestamp}`);
    }
    
    // Validate numeric value
    const value = parseFloat(row.getField(2));
    if (isNaN(value)) {
      throw new Error(`Row ${rowNum}: Invalid numeric value: ${row.getField(2)}`);
    }
    
    return {
      timestamp: new Date(timestamp),
      metric: row.getField(1),
      value: value
    };
  })
  .transform(toJson())
  .writeTo("validated-metrics.jsonl");
```

## Integration Examples

### TSV to Database

```typescript
// Load TSV data into database
const insertBatch = async (rows: string[][]) => {
  const values = rows.map(row => `('${row[0]}', '${row[1]}', ${row[2]})`).join(',');
  await db.execute(`INSERT INTO users (name, email, age) VALUES ${values}`);
};

let batch: string[][] = [];
const batchSize = 1000;

await read("users.tsv")
  .transform(fromTsvToRows())
  .drop(1)  // Skip header
  .forEach(async (row) => {
    batch.push(row);
    
    if (batch.length >= batchSize) {
      await insertBatch(batch);
      batch = [];
    }
  });

if (batch.length > 0) {
  await insertBatch(batch);
}
```

### TSV to API

```typescript
// Send TSV data to REST API
await read("events.tsv")
  .transform(fromTsvToLazyRows())
  .drop(1)  // Skip header
  .map(row => ({
    eventId: row.getField(0),
    timestamp: row.getField(1),
    userId: row.getField(2),
    action: row.getField(3),
    metadata: JSON.parse(row.getField(4) || '{}')
  }))
  .concurrentMap(async (event) => {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send event ${event.eventId}: ${response.statusText}`);
    }
    
    return response.json();
  }, { concurrency: 10 })
  .forEach(result => console.log('Sent:', result.id));
```

## Error Handling

### Malformed Data

```typescript
try {
  await read("data.tsv")
    .transform(fromTsvToRows())
    .collect();
} catch (error) {
  if (error.message.includes("UTF-8")) {
    console.error("Invalid character encoding in TSV file");
  } else {
    console.error(`TSV parsing failed: ${error.message}`);
  }
}
```

### Graceful Error Recovery

```typescript
// Continue processing despite individual row errors
const errors: Array<{row: number, error: string}> = [];
let successCount = 0;

await read("data.tsv")
  .transform(fromTsvToLazyRows())
  .drop(1)
  .forEach((row, index) => {
    try {
      const processed = processRow(row);
      successCount++;
    } catch (error) {
      errors.push({
        row: index + 2,  // Account for header and 0-based index
        error: error.message
      });
    }
  });

console.log(`Successfully processed ${successCount} rows`);
if (errors.length > 0) {
  console.error(`${errors.length} rows had errors:`);
  errors.forEach(({row, error}) => {
    console.error(`  Row ${row}: ${error}`);
  });
}
```

## Best Practices

1. **Use LazyRow selectively** - great for small/large datasets with selective access
2. **Validate field counts** if your data requires consistent structure
3. **Avoid tabs and newlines** in your data fields
4. **Use TSV for logs** and structured data without complex formatting needs
5. **Convert from CSV** to TSV for faster repeated processing
6. **Handle encoding properly** - ensure UTF-8 compatibility
7. **Batch large datasets** to control memory usage
8. **Validate data types** during processing for early error detection

## Comparison with Other Formats

### TSV vs CSV
- **Speed**: TSV is 2-10x faster than CSV
- **Simplicity**: No complex quoting/escaping rules
- **Limitations**: Cannot handle tabs or newlines in data
- **Compatibility**: Less universal than CSV

### TSV vs Record
- **Readability**: TSV is human-readable, Record is binary
- **Speed**: Record is faster for large datasets
- **Portability**: TSV works with any text editor
- **Safety**: Record handles any UTF-8 content safely

### TSV vs JSON
- **Structure**: JSON supports nested objects, TSV is flat
- **Speed**: TSV is faster for tabular data
- **Size**: TSV is more compact for simple data
- **Flexibility**: JSON is more flexible for complex structures

## Next Steps

- [CSV Transforms](./csv.md) - When you need CSV compatibility
- [Record Format](./record.md) - For maximum performance
- [LazyRow Guide](./lazyrow.md) - Advanced optimization patterns
- [Performance Guide](./performance.md) - Detailed benchmarks and optimization
