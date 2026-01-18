# String Concatenation Performance Analysis

## Summary

Iterative `String.concat()` is **2.3x faster** than `Array.join()` for building delimited strings in V8/Deno.

**Benchmark Results:**
- `string.concat()` (iterative): **1138 MB/s** ✅
- `map().join().join()`: 544 MB/s
- Single `join()` + `concat()`: 769 MB/s
- Array + `push()` + `join()`: 214 MB/s

## Why String.concat() is So Fast

### ConsString (Rope Strings)

V8 uses a lazy data structure called **ConsString** for concatenation:

```javascript
// Each concat creates a tree node, not a copy
result = result.concat(FIELD_SEPARATOR);  // → ConsString(result, FIELD_SEPARATOR)
result = result.concat(row[i]);            // → ConsString(prev, row[i])
```

**Key characteristics:**
- Concatenation is **O(1)** - just creates a pointer node
- Forms a tree structure: `(a + b) + c` → `((a, b), c)`
- No data copying during concatenation
- Strings remain immutable, but tree structure grows

### Deferred Flattening

V8 only "flattens" (copies to contiguous memory) when necessary:
- Indexing: `str[i]` or `str.charAt()`
- Regular expressions
- Encoding to bytes (our use case)
- Native code operations

**Our optimization:**
```javascript
// Build lazy tree
for (const row of rows) {
  for (let i = 0; i < row.length; i++) {
    if (i > 0) result = result.concat(fieldSep);
    result = result.concat(row[i]);
  }
  result = result.concat(lineSep);
}
// Flatten happens once during encoding
return encoder.encode(result);
```

The ConsString tree is flattened **once** when encoding to `Uint8Array`, writing directly to the byte buffer.

### Why join() is Slower

**Array.join() approach:**
```javascript
rows.map(row => row.join(FS) + RS).join('')
```

1. Creates intermediate string for each row: `row.join(FS) + RS`
2. Copies data into each intermediate string
3. Creates array of intermediate strings
4. Joins array (more copying)

**String.concat() approach:**
1. Builds ConsString tree (just pointers)
2. Defers all copying until final encoding
3. Single optimized flatten operation

## Performance Comparison

| Strategy | Throughput | vs Best |
|----------|-----------|---------|
| concat only (iterative) | 1138 MB/s | **1.0x** |
| join + concat | 769 MB/s | 0.68x |
| map + join + join | 544 MB/s | 0.48x |
| array + push + join | 214 MB/s | 0.19x |

## Implementation

See `src/transforms/common.ts`:
- `rowsToRecord()` - Record format conversion
- `joinRows()` - Generic row joining helper

Used in:
- `src/transforms/csv.ts`
- `src/transforms/tsv.ts`
- `src/transforms/json.ts`

## References

- [Exploring V8's strings: implementation and optimizations](https://iliazeus.lol/articles/js-string-optimizations-en/)
- [V8 ConsString explanation by Vyacheslav Egorov](https://gist.github.com/mraleph/3397008)
- Benchmarks: `string_concat_bench.ts`, `single_join_bench.ts`

## Date

2026-01-17
