# Record Format

High-performance binary-safe format using ASCII control characters for maximum throughput.

## Overview

Record format is designed for **maximum performance** in data processing pipelines. It uses ASCII control characters (Record Separator and Field Separator) to achieve reliable parsing while supporting any UTF-8 content in field values, including tabs and newlines.

## Performance Characteristics

| Dataset Size | Parsing Speed | Stringify Speed | Best Use Case |
|--------------|---------------|-----------------|---------------|
| Small (1K)   | 59.95 MB/s    | 188.16 MB/s     | Good baseline |
| Medium (10K) | 86.34 MB/s    | 89.86 MB/s      | Excellent scaling |
| Large (50K)  | 93.34 MB/s    | 220.38 MB/s     | **Highest throughput** |

> **Performance Leader**: Record format provides the most consistent high performance across all dataset sizes, making it ideal for high-throughput data processing.

## Format Specification

Record format uses ASCII control characters for reliable field and record separation:

- **Record Separator (RS)**: `\x1E` (ASCII 30) - separates records
- **Field Separator (FS)**: `\x1F` (ASCII 31) - separates fields within records

These characters are defined in `common.ts` and should not appear in actual data, allowing safe processing of tabs, newlines, and other special characters within field values.

### Format Example

```
field1\x1Ffield2\x1Ffield3\x1E
field1\x1Ffield2\x1Ffield3\x1E
```

For data: `[["Alice", "30", "New\nYork"], ["Bob", "25", "London"]]`

```
Alice\x1F30\x1FNew\nYork\x1E
Bob\x1F25\x1FLondon\x1E
```

## Basic Usage

### Parsing Record Format

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromRecordToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse Record format into string arrays
const rows = await read("data.record")
  .transform(fromRecordToRows())
  .collect();

// rows[0] = ["Alice", "30", "New\nYork"]
// rows[1] = ["Bob", "25", "London"]
```

### Parsing Record to LazyRow

```typescript
import { fromRecordToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Parse Record format into optimized LazyRow format
const lazyRows = await read("data.record")
  .transform(fromRecordToLazyRows())
  .collect();

// Efficient field access
for (const row of lazyRows) {
  const name = row.getField(0);
  const age = parseInt(row.getField(1));
  const city = row.getField(2);
  
  console.log(`${name} (${age}) from ${city}`);
}
```

### Generating Record Format

```typescript
import { toRecord } from "jsr:@j50n/proc@{{gitv}}/transforms";

// From string arrays
const data = [
  ["Alice", "30", "New\nYork"],  // Newlines are safe
  ["Bob", "25", "Tab\there"],    // Tabs are safe
  ["Carol", "35", "Quote\"here"] // Quotes are safe
];

await enumerate(data)
  .transform(toRecord())
  .writeTo("output.record");
```

## Key Advantages

### Binary Safety

Record format safely handles any UTF-8 content:

```typescript
// All special characters are preserved safely
const complexData = [
  ["Product", "Description", "Notes"],
  ["Widget A", "Contains\ttabs\nand newlines", "Special chars: \"'`"],
  ["Widget B", "Unicode: café naïve 🚀 東京", "Control chars safe"],
  ["Widget C", "Commas, semicolons; all safe", "No escaping needed"]
];

await enumerate(complexData)
  .transform(toRecord())
  .writeTo("complex.record");

// Perfect round-trip preservation
const restored = await read("complex.record")
  .transform(fromRecordToRows())
  .collect();

// restored === complexData (exact match)
```

### No Escaping Required

Unlike CSV, Record format needs no complex escaping:

```typescript
// CSV requires complex quoting and escaping
const csvProblematic = [
  ["Field with \"quotes\"", "Field with, commas", "Field with\nnewlines"]
];

// Record format handles it naturally
await enumerate(csvProblematic)
  .transform(toRecord())
  .writeTo("no-escaping-needed.record");
```

### Maximum Performance

Record format is optimized for speed:

```typescript
// Fastest format for high-throughput processing
const startTime = Date.now();

await read("large-dataset.record")  // 93 MB/s parsing
  .transform(fromRecordToRows())
  .filter(row => row[0].startsWith("A"))
  .transform(toRecord())            // 220 MB/s stringify
  .writeTo("filtered.record");

const duration = Date.now() - startTime;
console.log(`Processed in ${duration}ms`);
```

## Real-World Examples

### High-Throughput ETL Pipeline

```typescript
// Process millions of records efficiently
let processedCount = 0;

await read("raw-data.record")
  .transform(fromRecordToLazyRows())
  .filter(row => {
    const status = row.getField(5);
    return status === "active";
  })
  .map(row => [
    row.getField(0),                    // ID
    row.getField(1).toUpperCase(),      // Name (normalized)
    row.getField(2).toLowerCase(),      // Email (normalized)
    new Date().toISOString(),           // Processing timestamp
    "processed"                         // Status
  ])
  .transform(toRecord())
  .writeTo("processed-data.record");
```

### Format Conversion for Performance

```typescript
// Convert slow formats to Record for repeated processing
console.log("Converting CSV to Record format...");

await read("slow-data.csv")
  .transform(fromCsvToRows())
  .transform(toRecord())
  .writeTo("fast-data.record");

console.log("Conversion complete. Subsequent processing will be 3-5x faster.");

// Later processing benefits from Record format speed
await read("fast-data.record")
  .transform(fromRecordToRows())
  .filter(row => row[2] === "target")
  .collect();
```

### Streaming Data Processing

```typescript
// Real-time data processing with Record format
interface ProcessingStats {
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  startTime: number;
}

const stats: ProcessingStats = {
  totalRecords: 0,
  validRecords: 0,
  errorRecords: 0,
  startTime: Date.now()
};

await read("streaming-data.record")
  .transform(fromRecordToLazyRows())
  .forEach(row => {
    stats.totalRecords++;
    
    try {
      // Validate and process record
      const id = row.getField(0);
      const value = parseFloat(row.getField(3));
      
      if (id && !isNaN(value)) {
        stats.validRecords++;
        // Process valid record
      } else {
        stats.errorRecords++;
      }
      
      // Report progress
      if (stats.totalRecords % 100000 === 0) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        const rate = (stats.totalRecords / elapsed).toFixed(0);
        console.log(`Processed ${stats.totalRecords} records (${rate} records/sec)`);
      }
      
    } catch (error) {
      stats.errorRecords++;
    }
  });

console.log(`Final stats: ${stats.validRecords}/${stats.totalRecords} valid records`);
```

### Data Archival and Compression

```typescript
// Record format compresses well due to regular structure
import { gzip } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Archive data with compression
await read("large-dataset.record")
  .transform(gzip)
  .writeTo("archived-data.record.gz");

// Later retrieval with decompression
await read("archived-data.record.gz")
  .transform(gunzip)
  .transform(fromRecordToRows())
  .take(1000)  // Sample first 1000 records
  .collect();
```

## Performance Optimization

### LazyRow Usage with Record

Record format shows mixed LazyRow performance:

```typescript
// ✅ Use LazyRow for selective field access
await read("wide-data.record")
  .transform(fromRecordToLazyRows())
  .filter(row => {
    // Only parse fields 0 and 10
    const id = row.getField(0);
    const status = row.getField(10);
    return id.startsWith("USER_") && status === "active";
  })
  .collect();

// ✅ Use regular parsing for full field processing
await read("data.record")
  .transform(fromRecordToRows())
  .map(row => {
    // Process all fields efficiently
    return processAllFields(row);
  })
  .collect();
```

### Batch Processing

```typescript
// Process large Record files in memory-efficient batches
const batchSize = 10000;
let batch: string[][] = [];

await read("huge-data.record")
  .transform(fromRecordToRows())
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

### Parallel Processing

```typescript
// Process Record data in parallel streams
const inputFiles = ["data1.record", "data2.record", "data3.record"];

const results = await Promise.all(
  inputFiles.map(async (file, index) => {
    return await read(file)
      .transform(fromRecordToRows())
      .filter(row => row[0].startsWith(`BATCH_${index}`))
      .collect();
  })
);

// Combine results
const allResults = results.flat();
```

## Data Validation

### Field Count Validation

```typescript
// Ensure consistent record structure
const expectedFields = 7;
const errors: string[] = [];

await read("data.record")
  .transform(fromRecordToRows())
  .forEach((row, index) => {
    if (row.length !== expectedFields) {
      errors.push(`Record ${index + 1}: Expected ${expectedFields} fields, got ${row.length}`);
    }
  });

if (errors.length > 0) {
  console.error(`Validation failed:\n${errors.join('\n')}`);
}
```

### Data Integrity Checks

```typescript
// Validate data during processing
await read("transactions.record")
  .transform(fromRecordToLazyRows())
  .map((row, index) => {
    const recordNum = index + 1;
    
    // Validate transaction ID format
    const txId = row.getField(0);
    if (!/^TX_\d{8}$/.test(txId)) {
      throw new Error(`Record ${recordNum}: Invalid transaction ID: ${txId}`);
    }
    
    // Validate amount
    const amount = parseFloat(row.getField(3));
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Record ${recordNum}: Invalid amount: ${row.getField(3)}`);
    }
    
    return {
      id: txId,
      amount: amount,
      timestamp: row.getField(1),
      description: row.getField(2)
    };
  })
  .transform(toJson())
  .writeTo("validated-transactions.jsonl");
```

## Integration Examples

### Record to Database

```typescript
// Bulk load Record data into database
const insertBatch = async (rows: string[][]) => {
  const values = rows.map(row => 
    `(${row.map(field => `'${field.replace(/'/g, "''")}'`).join(', ')})`
  ).join(', ');
  
  await db.execute(`
    INSERT INTO users (id, name, email, created_at, status) 
    VALUES ${values}
  `);
};

let batch: string[][] = [];
const batchSize = 5000;

await read("users.record")
  .transform(fromRecordToRows())
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

### Record to API

```typescript
// Stream Record data to REST API
await read("events.record")
  .transform(fromRecordToLazyRows())
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
      throw new Error(`API error for event ${event.eventId}: ${response.statusText}`);
    }
    
    return response.json();
  }, { concurrency: 20 })  // Higher concurrency due to Record format speed
  .forEach(result => console.log('Processed:', result.id));
```

## Error Handling

### Malformed Records

```typescript
try {
  await read("data.record")
    .transform(fromRecordToRows())
    .collect();
} catch (error) {
  if (error.message.includes("UTF-8")) {
    console.error("Invalid character encoding in Record file");
  } else if (error.message.includes("separator")) {
    console.error("Malformed Record format - invalid separators");
  }
}
```

### Graceful Error Recovery

```typescript
// Continue processing despite individual record errors
const errors: Array<{record: number, error: string}> = [];
let successCount = 0;

await read("data.record")
  .transform(fromRecordToLazyRows())
  .forEach((row, index) => {
    try {
      const processed = processRecord(row);
      successCount++;
    } catch (error) {
      errors.push({
        record: index + 1,
        error: error.message
      });
    }
  });

console.log(`Successfully processed ${successCount} records`);
if (errors.length > 0) {
  console.error(`${errors.length} records had errors:`);
  errors.slice(0, 10).forEach(({record, error}) => {
    console.error(`  Record ${record}: ${error}`);
  });
}
```

## Best Practices

1. **Use for internal processing** - Record format is not human-readable
2. **Leverage binary safety** - no need to escape special characters
3. **Choose LazyRow based on access patterns** - selective vs full field access
4. **Validate field counts** if your data requires consistent structure
5. **Use for high-throughput pipelines** - fastest format for large datasets
6. **Convert from other formats** for repeated processing performance gains
7. **Handle UTF-8 properly** - ensure proper encoding throughout pipeline
8. **Batch large datasets** to control memory usage in processing

## Comparison with Other Formats

### Record vs CSV
- **Speed**: Record is 3-5x faster than CSV
- **Safety**: No escaping needed for special characters
- **Readability**: CSV is human-readable, Record is binary
- **Compatibility**: CSV is universal, Record is specialized

### Record vs TSV
- **Speed**: Record is consistently faster, especially for large data
- **Content**: Record handles tabs/newlines safely, TSV cannot
- **Simplicity**: TSV is simpler and human-readable
- **Performance**: Record scales better with dataset size

### Record vs JSON
- **Structure**: JSON supports nested objects, Record is flat tabular
- **Speed**: Record is faster for large tabular datasets
- **Flexibility**: JSON is more flexible for complex structures
- **Size**: Record is more compact for simple tabular data

## Next Steps

- [Performance Guide](./performance.md) - Detailed benchmarks and optimization
- [LazyRow Guide](./lazyrow.md) - Optimization patterns for Record format
- [CSV Transforms](./csv.md) - When you need human-readable compatibility
- [JSON Transforms](./json.md) - When you need rich object structures
