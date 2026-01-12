# LazyRow Guide

Optimized read-only data access with lazy evaluation and caching for maximum performance.

## Overview

LazyRow is a high-performance data structure designed for efficient field access in tabular data. It uses **lazy evaluation** and **caching** to minimize parsing overhead while providing a clean, simple API.

## Key Benefits

- **Zero conversion cost**: Choose optimal backing based on source data
- **Lazy evaluation**: Parse fields only when accessed  
- **Automatic caching**: Repeated access uses cached results
- **Performance**: 1.05-1.7x faster than regular parsing
- **Memory efficient**: Minimal overhead for conversion caching

## Performance Improvements

| Dataset Size | CSV Performance | TSV Performance | Record Performance |
|--------------|----------------|-----------------|-------------------|
| Small (1K)   | **1.51x** faster | **1.45x** faster | **1.72x** faster |
| Medium (10K) | **1.12x** faster | **1.09x** faster | **0.93x** faster |
| Large (50K)  | **1.07x** faster | **1.55x** faster | **0.83x** faster |

> **Best Use Cases**: LazyRow excels with CSV and large TSV datasets. For Record format, benefits vary by dataset size.

## Basic Usage

### Creating LazyRow

```typescript
import { LazyRow } from "jsr:@j50n/proc@{{gitv}}/transforms";

// From string array (zero cost)
const lazyRow1 = LazyRow.fromStringArray(['Alice', '30', 'Engineer']);

// From binary data (zero cost)  
const binaryData = new Uint8Array([...]); // LazyRow binary format
const lazyRow2 = LazyRow.fromBinary(binaryData);
```

### Field Access

```typescript
// Efficient field access
const name = lazyRow.getField(0);     // "Alice"
const age = lazyRow.getField(1);      // "30"
const job = lazyRow.getField(2);      // "Engineer"

// Column count
console.log(lazyRow.columnCount);     // 3
```

### Conversions with Caching

```typescript
// Convert to string array (cached after first call)
const fields1 = lazyRow.toStringArray();  // Converts and caches
const fields2 = lazyRow.toStringArray();  // Returns cached result

// Convert to binary (cached after first call)
const binary1 = lazyRow.toBinary();       // Converts and caches  
const binary2 = lazyRow.toBinary();       // Returns cached result
```

## Parsing with LazyRow

### CSV to LazyRow

```typescript
import { fromCsvToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

const lazyRows = await read("data.csv")
  .transform(fromCsvToLazyRows())
  .collect();

// Process efficiently
for (const row of lazyRows) {
  // Only parse the fields you actually use
  const id = row.getField(0);
  
  if (id.startsWith("USER_")) {
    const name = row.getField(1);    // Parse on demand
    const email = row.getField(2);   // Parse on demand
    console.log(`User: ${name} <${email}>`);
  }
  // Fields 3+ are never parsed if not accessed
}
```

### TSV to LazyRow

```typescript
import { fromTsvToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

const lazyRows = await read("logs.tsv")
  .transform(fromTsvToLazyRows())
  .collect();

// Efficient log processing
for (const row of lazyRows) {
  const level = row.getField(2);     // Parse log level
  
  if (level === "ERROR") {
    const timestamp = row.getField(0);
    const message = row.getField(3);
    console.error(`${timestamp}: ${message}`);
  }
}
```

### Record to LazyRow

```typescript
import { fromRecordToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

const lazyRows = await read("data.record")
  .transform(fromRecordToLazyRows())
  .collect();
```

## Binary Format Specification

LazyRow uses an efficient binary format for storage and transmission:

```
LazyRow Binary Layout:
┌─────────────────┬──────────────────┬─────────────────┐
│ Field Count     │ Field Lengths    │ Field Data      │
│ (4 bytes)       │ (4 * N bytes)    │ (UTF-8 bytes)   │
└─────────────────┴──────────────────┴─────────────────┘

Field Count: int32 - Number of fields (N)
Field Lengths: int32[N] - Byte length of each field  
Field Data: Concatenated UTF-8 encoded field values
```

### Binary Format Example

```typescript
// For data: ["Alice", "30", "Engineer"]
const binary = lazyRow.toBinary();

// Binary layout:
// [0-3]:   0x00000003           // 3 fields
// [4-7]:   0x00000005           // "Alice" = 5 bytes
// [8-11]:  0x00000002           // "30" = 2 bytes  
// [12-15]: 0x00000008           // "Engineer" = 8 bytes
// [16-20]: "Alice"              // UTF-8 data
// [21-22]: "30"                 // UTF-8 data
// [23-30]: "Engineer"           // UTF-8 data
```

## Implementation Details

### Polymorphic Design

LazyRow uses an abstract base class with two concrete implementations:

```typescript
abstract class LazyRow {
  abstract readonly columnCount: number;
  abstract getField(index: number): string;
  abstract toStringArray(): string[];
  abstract toBinary(): Uint8Array;
  
  // Static factory methods
  static fromStringArray(fields: string[]): LazyRow;
  static fromBinary(data: Uint8Array): LazyRow;
}
```

### StringArrayLazyRow

- **Backing**: `string[]` array
- **Best for**: Data parsed from text formats (CSV, TSV)
- **Lazy conversion**: Binary format generated on demand
- **Caching**: Binary result cached after first `toBinary()` call

### BinaryLazyRow  

- **Backing**: `Uint8Array` with field boundaries
- **Best for**: Data from binary sources or network transmission
- **Lazy conversion**: String parsing on demand
- **Caching**: String results cached after field access

## Performance Patterns

### Selective Field Access

```typescript
// ✅ Efficient - only parse needed fields
await read("large.csv")
  .transform(fromCsvToLazyRows())
  .filter(row => {
    const status = row.getField(5);  // Only parse field 5
    return status === "active";
  })
  .map(row => ({
    id: row.getField(0),             // Parse fields 0, 1, 2 on demand
    name: row.getField(1),
    email: row.getField(2)
    // Fields 3, 4, 6+ never parsed
  }))
  .collect();
```

### Avoid Unnecessary Conversions

```typescript
// ✅ Efficient - work with LazyRow directly
const processRow = (row: LazyRow) => {
  const name = row.getField(0);
  const age = parseInt(row.getField(1));
  return age >= 18 ? name : null;
};

// ❌ Less efficient - unnecessary conversion
const processRow = (row: LazyRow) => {
  const fields = row.toStringArray();  // Converts all fields
  const name = fields[0];
  const age = parseInt(fields[1]);
  return age >= 18 ? name : null;
};
```

### Batch Conversions

```typescript
// When you need all fields, convert once
const processAllFields = (row: LazyRow) => {
  const fields = row.toStringArray();  // Convert once
  
  return {
    name: fields[0],
    age: parseInt(fields[1]),
    city: fields[2],
    country: fields[3],
    email: fields[4]
  };
};
```

## Real-World Examples

### Log Analysis

```typescript
// Analyze web server logs efficiently
let errorCount = 0;
let totalRequests = 0;

await read("access.log.tsv")
  .transform(fromTsvToLazyRows())
  .forEach(row => {
    totalRequests++;
    
    const statusCode = row.getField(6);  // Only parse status code
    
    if (statusCode.startsWith("4") || statusCode.startsWith("5")) {
      errorCount++;
      
      // Only parse additional fields for errors
      const timestamp = row.getField(0);
      const path = row.getField(4);
      const userAgent = row.getField(8);
      
      console.error(`${timestamp}: ${statusCode} ${path} - ${userAgent}`);
    }
  });

console.log(`Error rate: ${(errorCount / totalRequests * 100).toFixed(2)}%`);
```

### Data Validation

```typescript
// Validate CSV data with detailed error reporting
const errors: string[] = [];

await read("users.csv")
  .transform(fromCsvToLazyRows())
  .drop(1)  // Skip header
  .forEach((row, index) => {
    const rowNum = index + 2;  // Account for header and 0-based index
    
    // Validate required fields exist
    if (row.columnCount < 4) {
      errors.push(`Row ${rowNum}: Missing required fields`);
      return;
    }
    
    // Validate email format (only parse if needed)
    const email = row.getField(2);
    if (!email.includes("@")) {
      errors.push(`Row ${rowNum}: Invalid email format: ${email}`);
    }
    
    // Validate age (only parse if needed)
    const ageStr = row.getField(1);
    const age = parseInt(ageStr);
    if (isNaN(age) || age < 0 || age > 150) {
      errors.push(`Row ${rowNum}: Invalid age: ${ageStr}`);
    }
  });

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} errors:`);
  errors.forEach(error => console.error(`  ${error}`));
}
```

### Format Conversion with Filtering

```typescript
// Convert CSV to JSON, filtering and transforming data
await read("products.csv")
  .transform(fromCsvToLazyRows())
  .drop(1)  // Skip header
  .filter(row => {
    const price = parseFloat(row.getField(3));
    return price > 10.00;  // Only expensive products
  })
  .map(row => ({
    id: row.getField(0),
    name: row.getField(1),
    category: row.getField(2),
    price: parseFloat(row.getField(3)),
    inStock: row.getField(4) === "true",
    lastUpdated: new Date().toISOString()
  }))
  .transform(toJson())
  .writeTo("expensive-products.jsonl");
```

### Streaming Aggregation

```typescript
// Calculate statistics without loading all data
const stats = {
  totalRows: 0,
  totalSales: 0,
  avgAge: 0,
  ageSum: 0
};

await read("sales-data.csv")
  .transform(fromCsvToLazyRows())
  .drop(1)  // Skip header
  .forEach(row => {
    stats.totalRows++;
    
    // Only parse fields we need for calculations
    const saleAmount = parseFloat(row.getField(4));
    const customerAge = parseInt(row.getField(2));
    
    stats.totalSales += saleAmount;
    stats.ageSum += customerAge;
  });

stats.avgAge = stats.ageSum / stats.totalRows;

console.log(`Processed ${stats.totalRows} sales`);
console.log(`Total revenue: $${stats.totalSales.toFixed(2)}`);
console.log(`Average customer age: ${stats.avgAge.toFixed(1)}`);
```

## Error Handling

### Field Access Errors

```typescript
try {
  const value = row.getField(10);  // Index out of bounds
} catch (error) {
  console.error(`Field access error: ${error.message}`);
}

// Safe field access
const safeGetField = (row: LazyRow, index: number): string | null => {
  if (index >= 0 && index < row.columnCount) {
    return row.getField(index);
  }
  return null;
};
```

### Conversion Errors

```typescript
try {
  const binary = row.toBinary();
} catch (error) {
  if (error.message.includes("UTF-8")) {
    console.error("Invalid UTF-8 in field data");
  } else {
    console.error(`Binary conversion failed: ${error.message}`);
  }
}
```

## Best Practices

1. **Use selective field access** - only parse fields you actually need
2. **Cache conversions** - let LazyRow handle caching automatically  
3. **Prefer LazyRow over string arrays** for large datasets
4. **Validate field counts** before accessing fields by index
5. **Handle encoding errors** when working with binary data
6. **Use appropriate factory methods** based on your data source

## Integration Examples

### With Other Transforms

```typescript
// LazyRow → other formats
await read("data.csv")
  .transform(fromCsvToLazyRows())
  .map(row => row.toStringArray())  // Convert when needed
  .transform(toTsv())
  .writeTo("data.tsv");
```

### With Validation Libraries

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0).max(150),
  email: z.string().email()
});

await read("users.csv")
  .transform(fromCsvToLazyRows())
  .drop(1)
  .map(row => {
    const user = {
      name: row.getField(0),
      age: parseInt(row.getField(1)),
      email: row.getField(2)
    };
    
    return UserSchema.parse(user);  // Validates and throws on error
  })
  .transform(toJson())
  .writeTo("validated-users.jsonl");
```

## Next Steps

- [CSV Transforms](./csv.md) - Using LazyRow with CSV data
- [TSV Transforms](./tsv.md) - Using LazyRow with TSV data  
- [Performance Guide](./performance.md) - Optimization strategies
- [Record Format](./record.md) - Binary format for maximum speed
