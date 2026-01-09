# WASM Integration Guide

This guide covers integrating StringRow with WebAssembly for efficient data processing pipelines.

## Overview

StringRow is designed for WASM → JavaScript data pipelines, providing direct UTF-8 byte processing without decode overhead. This makes it particularly suitable for scenarios where WebAssembly modules need to pass structured data to JavaScript efficiently.

## Basic WASM Integration

### WASM Side (Rust Example)

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DataProcessor {
    // Your data processing logic
}

#[wasm_bindgen]
impl DataProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> DataProcessor {
        DataProcessor {}
    }
    
    // Return StringRow-formatted bytes
    #[wasm_bindgen]
    pub fn get_row_data(&self, row_id: u32) -> Vec<u8> {
        let columns = vec![
            format!("id_{}", row_id),
            format!("name_{}", row_id),
            format!("value_{}", row_id * 100),
            // ... more columns
        ];
        
        serialize_string_row(&columns)
    }
    
    // Process multiple rows efficiently
    #[wasm_bindgen]
    pub fn get_batch_data(&self, start_id: u32, count: u32) -> Vec<u8> {
        let mut result = Vec::new();
        
        for i in start_id..start_id + count {
            let row_bytes = self.get_row_data(i);
            result.extend_from_slice(&(row_bytes.len() as u32).to_le_bytes());
            result.extend_from_slice(&row_bytes);
        }
        
        result
    }
}

// StringRow serialization in Rust
fn serialize_string_row(columns: &[String]) -> Vec<u8> {
    let mut result = Vec::new();
    
    // Column count (4 bytes, little-endian)
    result.extend_from_slice(&(columns.len() as u32).to_le_bytes());
    
    // Calculate positions
    let mut positions = Vec::new();
    let mut char_pos = 0u32;
    
    for col in columns {
        positions.push(char_pos);
        char_pos += col.len() as u32;
    }
    positions.push(char_pos); // Final position
    
    // Write positions (4 bytes each, little-endian)
    for pos in positions {
        result.extend_from_slice(&pos.to_le_bytes());
    }
    
    // Write text data (UTF-8)
    for col in columns {
        result.extend_from_slice(col.as_bytes());
    }
    
    result
}
```

### JavaScript Side

```typescript
import { StringRow } from "@j50n/proc/data-transform";

// Initialize WASM module
const wasmModule = await import("./pkg/your_wasm_module.js");
const processor = new wasmModule.DataProcessor();

// Single row processing
function processRow(rowId: number) {
  const bytes = processor.get_row_data(rowId);
  const row = StringRow.fromBytes(new Uint8Array(bytes));
  
  // Access only needed columns
  const id = row.getUnsafe(0);
  const name = row.getUnsafe(1);
  const value = row.getUnsafe(2);
  
  return { id, name, value: parseInt(value) };
}

// Batch processing
function processBatch(startId: number, count: number) {
  const batchBytes = processor.get_batch_data(startId, count);
  const results = [];
  
  let offset = 0;
  const view = new DataView(batchBytes.buffer);
  
  for (let i = 0; i < count; i++) {
    // Read row length
    const rowLength = view.getUint32(offset, true);
    offset += 4;
    
    // Extract row bytes
    const rowBytes = new Uint8Array(batchBytes.buffer, offset, rowLength);
    offset += rowLength;
    
    // Process row
    const row = StringRow.fromBytes(rowBytes);
    results.push({
      id: row.getUnsafe(0),
      name: row.getUnsafe(1),
      value: parseInt(row.getUnsafe(2))
    });
  }
  
  return results;
}
```

## Advanced Patterns

### Streaming Data Processing

```typescript
class WASMDataStream {
  private processor: any;
  private batchSize: number;
  
  constructor(wasmModule: any, batchSize = 1000) {
    this.processor = new wasmModule.DataProcessor();
    this.batchSize = batchSize;
  }
  
  async* processStream(totalRows: number) {
    for (let start = 0; start < totalRows; start += this.batchSize) {
      const count = Math.min(this.batchSize, totalRows - start);
      const batchBytes = this.processor.get_batch_data(start, count);
      
      yield* this.parseBatch(batchBytes, count);
    }
  }
  
  private* parseBatch(batchBytes: Uint8Array, count: number) {
    let offset = 0;
    const view = new DataView(batchBytes.buffer);
    
    for (let i = 0; i < count; i++) {
      const rowLength = view.getUint32(offset, true);
      offset += 4;
      
      const rowBytes = new Uint8Array(batchBytes.buffer, offset, rowLength);
      offset += rowLength;
      
      yield StringRow.fromBytes(rowBytes);
    }
  }
}

// Usage
const stream = new WASMDataStream(wasmModule);

for await (const row of stream.processStream(100000)) {
  // Process each row efficiently
  const key = row.getUnsafe(0);
  const data = row.getUnsafe(1);
  
  await processRowData(key, data);
}
```

### Memory Pool Pattern

```typescript
class StringRowPool {
  private pool: StringRow[] = [];
  private maxSize: number;
  
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }
  
  acquire(bytes: Uint8Array): StringRow {
    // Try to reuse from pool (if structure is compatible)
    const pooled = this.pool.pop();
    if (pooled && this.isCompatible(pooled, bytes)) {
      // Update pooled instance with new data
      return this.updateRow(pooled, bytes);
    }
    
    // Create new instance
    return StringRow.fromBytes(bytes);
  }
  
  release(row: StringRow) {
    if (this.pool.length < this.maxSize && !row.isDirty) {
      row.resetChanges();
      this.pool.push(row);
    }
  }
  
  private isCompatible(row: StringRow, bytes: Uint8Array): boolean {
    // Check if row structure matches new data
    // This is application-specific logic
    return row.columnCount === this.getColumnCount(bytes);
  }
  
  private getColumnCount(bytes: Uint8Array): number {
    const view = new DataView(bytes.buffer);
    return view.getUint32(0, true);
  }
  
  private updateRow(row: StringRow, bytes: Uint8Array): StringRow {
    // This would require extending StringRow with update capability
    // For now, create new instance
    return StringRow.fromBytes(bytes);
  }
}
```

### Error Handling

```typescript
function safeProcessWASMData(wasmBytes: Uint8Array): ProcessedData | null {
  try {
    const row = StringRow.fromBytes(wasmBytes);
    
    // Validate expected structure
    if (row.columnCount < 3) {
      console.warn("Insufficient columns in WASM data");
      return null;
    }
    
    // Safe access with validation
    const id = row.get(0);  // Use safe access for validation
    const name = row.get(1);
    const value = row.get(2);
    
    if (!id || !name) {
      console.warn("Missing required data in WASM row");
      return null;
    }
    
    // Switch to unsafe access for performance after validation
    return {
      id: row.getUnsafe(0),
      name: row.getUnsafe(1),
      value: parseInt(row.getUnsafe(2)) || 0
    };
    
  } catch (error) {
    console.error("Failed to process WASM data:", error);
    return null;
  }
}
```

## Performance Optimization

### JIT Warmup for WASM Integration

```typescript
async function initializeWASMProcessor(wasmModule: any) {
  const processor = new wasmModule.DataProcessor();
  
  // Warm up the JIT with representative data
  console.log("Warming up JIT compiler...");
  
  for (let i = 0; i < 1000; i++) {
    const bytes = processor.get_row_data(i);
    const row = StringRow.fromBytes(new Uint8Array(bytes));
    
    // Access patterns that will be used in production
    row.getUnsafe(0);
    row.getUnsafe(1);
    row.getUnsafe(2);
  }
  
  console.log("JIT warmup complete");
  return processor;
}
```

### Batch Size Optimization

```typescript
function findOptimalBatchSize(processor: any): number {
  const testSizes = [100, 500, 1000, 2000, 5000];
  let bestSize = 1000;
  let bestTime = Infinity;
  
  for (const size of testSizes) {
    const start = performance.now();
    
    // Test batch processing
    for (let i = 0; i < 10; i++) {
      const bytes = processor.get_batch_data(i * size, size);
      // Process the batch...
    }
    
    const time = performance.now() - start;
    if (time < bestTime) {
      bestTime = time;
      bestSize = size;
    }
  }
  
  return bestSize;
}
```

## Common Patterns

### CSV-like Data from WASM

```typescript
// WASM returns CSV-formatted StringRow data
function processCSVFromWASM(wasmBytes: Uint8Array) {
  const row = StringRow.fromBytes(wasmBytes);
  
  // Map to typed object
  return {
    timestamp: new Date(row.getUnsafe(0)),
    userId: parseInt(row.getUnsafe(1)),
    action: row.getUnsafe(2),
    metadata: JSON.parse(row.getUnsafe(3) || '{}')
  };
}
```

### Database-like Queries

```typescript
class WASMQueryProcessor {
  private processor: any;
  
  constructor(wasmModule: any) {
    this.processor = new wasmModule.DataProcessor();
  }
  
  async query(filter: (row: StringRow) => boolean): Promise<StringRow[]> {
    const results: StringRow[] = [];
    const batchSize = 1000;
    let offset = 0;
    
    while (true) {
      const batchBytes = this.processor.get_batch_data(offset, batchSize);
      if (batchBytes.length === 0) break;
      
      for (const row of this.parseBatch(batchBytes)) {
        if (filter(row)) {
          results.push(row);
        }
      }
      
      offset += batchSize;
    }
    
    return results;
  }
  
  private* parseBatch(batchBytes: Uint8Array) {
    // Batch parsing logic...
  }
}

// Usage
const queryProcessor = new WASMQueryProcessor(wasmModule);

const activeUsers = await queryProcessor.query(row => 
  row.getUnsafe(2) === "active" && 
  parseInt(row.getUnsafe(3)) > 1000
);
```

## Best Practices

1. **Validate WASM data structure** before switching to unsafe access
2. **Use batch processing** to amortize WASM call overhead
3. **Warm up the JIT** with representative data patterns
4. **Pool StringRow instances** when possible for memory efficiency
5. **Handle errors gracefully** - WASM data may be malformed
6. **Monitor memory usage** - large batches can consume significant memory
7. **Profile your specific use case** - optimal patterns vary by application

## Troubleshooting

### Common Issues

- **Endianness mismatches** - Ensure consistent byte order between WASM and JavaScript
- **UTF-8 encoding issues** - Validate text encoding in WASM
- **Memory alignment** - Some WASM runtimes require aligned memory access
- **Performance degradation** - Check for JIT deoptimization with inconsistent data

### Debugging Tips

```typescript
// Add validation for WASM data
function validateStringRowBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false; // Minimum size
  
  const view = new DataView(bytes.buffer);
  const columnCount = view.getUint32(0, true);
  
  if (columnCount > 10000) return false; // Sanity check
  
  const expectedHeaderSize = 4 + (columnCount + 1) * 4;
  return bytes.length >= expectedHeaderSize;
}
```
