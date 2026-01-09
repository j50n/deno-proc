# Performance Guide

This guide covers StringRow's performance characteristics, optimization strategies, and benchmarking methodology.

## Performance Overview

StringRow achieves performance gains through several architectural decisions:

- Binary format eliminates UTF-8 decode overhead
- Int32Array positions leverage V8's SMI (Small Integer) optimization  
- Selective access avoids parsing unused columns
- Sparse change tracking minimizes memory usage
- Clean/dirty optimization avoids unnecessary serialization

## Benchmark Methodology

All benchmarks use UTF-8 byte input with 1000-cycle JIT warmup to ensure fair comparison. Tests measure the complete pipeline from UTF-8 bytes to accessing the first column value.

### Results

**Small Datasets (10 columns, 1000 iterations):**
```
StringRow:  0.35ms - 849 KB/ms
TSV:        0.40ms - 633 KB/ms  (1.16x slower)
JSON:       0.60ms - 467 KB/ms  (1.72x slower)
Deno CSV:   5.34ms - 52 KB/ms   (6.95x slower)
```

**Medium Datasets (50 columns, 200 iterations):**
```
StringRow:  0.08ms - 3.8 GB/s
TSV:        0.35ms - 756 KB/ms  (4.55x slower)
JSON:       0.42ms - 675 KB/ms  (5.67x slower)
Deno CSV:   3.03ms - 94 KB/ms   (32.88x slower)
```

**Large Datasets (100 columns, 100 iterations):**
```
StringRow:  0.06ms - 4.7 GB/s
TSV:        0.31ms - 847 KB/ms  (5.0x slower)
JSON:       0.38ms - 756 KB/ms  (6.0x slower)
Deno CSV:   3.25ms - 88 KB/ms   (24.29x slower)
```

## Performance Scaling

StringRow performance improves with dataset size because:

1. Fixed construction overhead is amortized over more data
2. Binary format efficiency becomes more apparent with larger datasets
3. V8 optimizations work better with consistent access patterns
4. UTF-8 decode overhead elimination scales with text size

## Optimization Techniques

### Use Unsafe Access for Known Valid Indices

```typescript
// Slower - bounds checking on every access
const values = [row.get(0), row.get(1), row.get(2)];

// Faster - no bounds checking
const values = [row.getUnsafe(0), row.getUnsafe(1), row.getUnsafe(2)];
```

Performance gain: 3-4x faster for column access.

### Selective Column Access

```typescript
// Inefficient - parses all columns
const allData = row.toArray();
const needed = [allData[0], allData[5], allData[10]];

// Efficient - only accesses needed columns
const needed = [row.getUnsafe(0), row.getUnsafe(5), row.getUnsafe(10)];
```

Performance scales with the ratio of unused columns.

### Batch Modifications

```typescript
// Inefficient - multiple serializations
row.set(0, "new1");
const bytes1 = row.toBytes();
row.set(1, "new2");
const bytes2 = row.toBytes();

// Efficient - single serialization
row.set(0, "new1");
row.set(1, "new2");
const bytes = row.toBytes();
```

### Check Dirty State Before Serialization

```typescript
// Always serializes
const bytes = row.toBytes();

// Only serializes if changed (142x faster for unchanged rows)
if (row.isDirty) {
  const bytes = row.toBytes();
}
```

## Memory Characteristics

StringRow's memory footprint consists of:

- Original buffer (shared, not copied)
- Position array: (columns + 2) × 4 bytes
- Decoded text (shared with V8)
- Change map (only allocated when modifications occur)

The sparse change tracking means modifications only store the changed values, not the entire row.

## V8 Optimization Details

### SMI (Small Integer) Optimization

StringRow uses Int32Array for position storage because:

- SMI range: -2,147,483,648 to 2,147,483,647
- All reasonable position values fit in SMI range
- No boxing overhead - values stored directly in 64-bit words
- Faster arithmetic operations

This is why StringRow uses Int32Array instead of Uint32Array, despite the smaller positive range.

### JIT Compilation Considerations

For optimal performance:

1. Warm up the JIT with representative data
2. Use consistent access patterns
3. Avoid polymorphic operations that confuse the optimizer

## Comparison with Text Formats

| Aspect | StringRow | TSV/JSON/CSV |
|--------|-----------|--------------|
| UTF-8 Decode | Not needed | Required |
| Parsing | Selective | Full |
| Memory Layout | Optimized | String-based |
| Column Access | O(1) | O(n) search |
| Change Tracking | Built-in | Manual |

Text formats may be faster for very small datasets (≤10 columns) due to lower setup overhead, but StringRow scales better with data size.

## Performance Monitoring

To measure performance in your specific use case:

```typescript
console.time("StringRow Processing");
for (let i = 0; i < 10000; i++) {
  const row = StringRow.fromBytes(testData);
  const result = row.getUnsafe(0);
}
console.timeEnd("StringRow Processing");
```

Use browser dev tools or Deno's profiling for detailed analysis:

```bash
deno run --allow-hrtime --v8-flags=--prof your-script.ts
```

## Common Performance Issues

1. **Cold JIT compilation** - First runs are slower until V8 optimizes
2. **Bounds checking overhead** - Use `getUnsafe()` for hot paths
3. **Unnecessary `toArray()` calls** - Access columns directly when possible
4. **Frequent serialization** - Batch modifications before calling `toBytes()`
5. **Memory pressure** - Monitor change map growth in long-lived instances
