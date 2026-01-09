# Data Transformation

The data transformation module provides utilities for working with tabular data in binary formats, particularly when interfacing with WebAssembly or processing large datasets where text parsing becomes a bottleneck.

## StringRow

StringRow is a binary format for tabular data that provides direct column access without full row parsing. It's designed for scenarios where you need to process many rows but only access specific columns from each.

### Key Features

- Direct UTF-8 byte processing without decode overhead
- Selective column access - read only the columns you need
- Sparse change tracking for modifications
- Efficient serialization that reuses original buffers when unchanged

### Performance Characteristics

StringRow performance scales with dataset size due to its binary format:

| Dataset Size | vs TSV | vs JSON | vs CSV Parser |
|--------------|--------|---------|---------------|
| Small (10 cols) | 1.2x faster | 1.7x faster | 7x faster |
| Medium (50 cols) | 4.6x faster | 5.7x faster | 33x faster |
| Large (100+ cols) | 5-6x faster | 6-10x faster | 24-33x faster |

The performance advantage comes from eliminating text parsing and UTF-8 decode steps that text formats require.

### When to Use

StringRow is most effective for:

- Processing data from WebAssembly modules
- Working with wide datasets where you only need specific columns
- High-throughput scenarios where parsing overhead matters
- Cases where you need to track changes to tabular data

For small datasets or simple one-time parsing, standard text formats may be more appropriate due to their simplicity.

### Basic Usage

```typescript
import { StringRow } from "@j50n/proc/data-transform";

// Create from array
const row = StringRow.fromArray(["col1", "col2", "col3"]);

// Create from binary data (e.g., from WASM)
const row = StringRow.fromBytes(binaryData);

// Access columns
const value = row.get(0);        // Safe access with bounds checking
const fast = row.getUnsafe(0);   // Unsafe access for performance

// Selective access
const needed = [row.getUnsafe(0), row.getUnsafe(5), row.getUnsafe(10)];

// Convert back to array when needed
const array = row.toArray();
```

### Binary Format

StringRow uses a compact binary format:

```
[columnCount:int32][positions:int32...][text_data]
```

This format allows direct column access by using the position array to locate column boundaries in the concatenated text data.

## Integration with Transforms

StringRow integrates with the existing transform system by providing efficient data structures for tabular transformations. You can use it in transform pipelines where you need to process structured data efficiently.

## Documentation

- [StringRow API Reference](./stringrow-api.md) - Complete method documentation
- [Performance Guide](./performance.md) - Optimization strategies and benchmarks
- [WASM Integration](./wasm-integration.md) - Working with WebAssembly data sources
