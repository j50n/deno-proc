# Data Transform Module

This module provides high-performance data transformation utilities for converting between byte-oriented formats (TSV, CSV) and structured data representations optimized for WASM interop.

## StringRow

A high-performance row-based data structure optimized for:

- **WASM Integration**: Works directly with UTF-8 bytes from WebAssembly
- **Selective Access**: Access specific columns without parsing entire rows
- **Change Tracking**: Sparse modification tracking with dirty flag optimization
- **Performance**: 1.5-33x faster than text formats for medium/large datasets

### Key Features

- **Int32Array optimization** for V8's SMI (Small Integer) performance
- **Binary format** eliminates UTF-8 decode overhead
- **Bounds-safe and unsafe access** methods for different use cases
- **Iterator support** and array-like methods
- **Unicode support** with proper UTF-8 handling

### Usage

```typescript
import { StringRow } from "./src/data-transform/string-row.ts";

// Create from array
const row = StringRow.fromArray(["col1", "col2", "col3"]);

// Access columns
const value = row.get(0);        // Safe access with bounds checking
const fast = row.getUnsafe(0);   // Unsafe access for maximum performance

// Modify columns
row.set(1, "modified");

// Convert back to array
const array = row.toArray();

// Serialize to bytes
const bytes = row.toBytes();

// Create from bytes (e.g., from WASM)
const fromBytes = StringRow.fromBytes(bytes);
```

### Performance Characteristics

- **Small datasets (≤10 columns)**: Competitive with text formats
- **Medium datasets (50 columns)**: 2-5x faster than TSV/JSON
- **Large datasets (100+ columns)**: 5-33x faster than text formats
- **Throughput**: Up to 4.7 GB/s processing speed

Perfect for WASM → JavaScript data pipelines where performance matters.
