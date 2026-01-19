# String Concatenation vs Join

When building delimited strings from arrays (like CSV or TSV rows), the choice between `Array.join()` and `String.concat()` has a dramatic performance impact.

**TL;DR:** Iterative `String.concat()` is **2.2x faster** than `Array.join()` for hierarchical string building.

## The Problem

Converting rows of data to delimited text requires joining fields with separators and rows with line terminators:

```typescript
// Input: array of rows, each row is an array of fields
const rows = [
  ["Alice", "30", "Engineer"],
  ["Bob", "25", "Designer"],
  // ... thousands more
];

// Output: TSV format
// Alice\t30\tEngineer\n
// Bob\t25\tDesigner\n
```

The naive approach uses nested `join()` calls:

```typescript
const result = rows.map(row => row.join('\t') + '\n').join('');
```

This creates intermediate strings at each level - one for each row, then one final string. For large datasets, this copying overhead adds up.

## Benchmark Results

Testing on 10,000 rows × 10 columns (1000 iterations):

| Strategy | Throughput | vs Best |
|----------|-----------|---------|
| `string.concat()` (iterative) | **1197 MB/s** | **1.0x** ✅ |
| `map().join().join()` | 535 MB/s | 0.45x |
| `array.push().join()` | 219 MB/s | 0.18x |

The concat approach is over 2x faster than the "obvious" solution.

## Why String.concat() Wins

### V8's ConsString Optimization

V8 (the JavaScript engine in Deno/Chrome) uses a clever data structure called **ConsString** (concatenation string) for string concatenation:

```typescript
// Each concat creates a tree node, NOT a copy
let result = "";
result = result.concat("field1");  // → ConsString("", "field1")
result = result.concat("\t");      // → ConsString(prev, "\t")
result = result.concat("field2");  // → ConsString(prev, "field2")
```

**Key insight:** Concatenation is O(1) - it just creates a pointer node in a tree structure. No data is copied during concatenation.

### Deferred Flattening

The ConsString tree only gets "flattened" (copied to contiguous memory) when necessary:
- Indexing: `str[i]` or `str.charAt()`
- Regular expressions
- **Encoding to bytes** (our use case)
- Native operations

Our optimization builds a lazy tree structure, then flattens it once during encoding:

```typescript
// Build ConsString tree (just pointers, no copying)
let result = "";
for (const row of rows) {
  for (let i = 0; i < row.length; i++) {
    if (i > 0) result = result.concat('\t');
    result = result.concat(row[i]);
  }
  result = result.concat('\n');
}

// Flatten happens ONCE here, writing directly to byte buffer
return encoder.encode(result);
```

### Why join() is Slower

The `Array.join()` approach creates intermediate strings:

```typescript
rows.map(row => row.join('\t') + '\n').join('')
```

1. `row.join('\t')` - Creates and copies string for each row
2. `+ '\n'` - Creates another string with newline
3. `.map()` - Creates array of intermediate strings
4. `.join('')` - Copies all strings again into final result

That's multiple copy operations per row, versus one final flatten with concat.

## Production Implementation

See `src/transforms/common.ts`:

```typescript
/**
 * Join multiple rows with field and line separators.
 * Optimized using string.concat() for better performance.
 */
export function joinRows(
  rows: string[][],
  fieldSep: string,
  lineSep: string,
): string {
  let result = "";
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) result = result.concat(fieldSep);
      result = result.concat(row[i]);
    }
    result = result.concat(lineSep);
  }
  return result;
}
```

This pattern is used throughout the transform pipeline:
- `src/transforms/csv.ts` - CSV output
- `src/transforms/tsv.ts` - TSV output  
- `src/transforms/json.ts` - JSON Lines output

## When This Matters

This optimization shines when:
- **Hierarchical joining** - Multiple levels of delimiters (fields → rows → batches)
- **Large datasets** - The overhead compounds with data size
- **Hot paths** - Code that runs frequently in tight loops
- **Streaming** - Processing data in chunks where encoding happens repeatedly

For small strings or one-time operations, the difference is negligible. But in a data processing pipeline handling gigabytes, 2x throughput improvement is significant.

## Testing Notes

Benchmarks run on Intel Core Ultra 5 115U (Chromebook, Crostini, battery power). Absolute numbers will vary by hardware, but relative performance should be consistent across V8-based runtimes.

Run the benchmarks yourself:
```bash
cd labs/performance
deno bench string_concat_bench.ts
```

## References

- [Exploring V8's strings: implementation and optimizations](https://iliazeus.lol/articles/js-string-optimizations-en/)
- [V8 ConsString explanation by Vyacheslav Egorov](https://gist.github.com/mraleph/3397008)
- Full analysis: `labs/performance/string_concat_analysis.md`
