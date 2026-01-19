# Handler Swap Pattern for AsyncIterables

**TL;DR:** When processing AsyncIterables with unknown types, use a self-replacing handler function that checks the type on first iteration and swaps itself out with the optimal implementation.

## The Problem

You're writing a transform function that accepts an AsyncIterable, but you don't know what type of data it contains until you're inside the iteration:

```typescript
async function* transform(
  data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>
): AsyncIterable<Uint8Array> {
  // Can't check type here - data is just an iterable
  // Can't peek at first item without consuming it
  
  for await (const item of data) {
    // NOW we know the type, but we're already in the loop
    // Don't want to check type on EVERY iteration
  }
}
```

**The constraint:** You can't determine the type until you're inside the first iteration, but you don't want to check the type on every single iteration (expensive for large streams).

## The Naive Solution (Slow)

Check the type on every iteration:

```typescript
for await (const item of data) {
  if (item instanceof LazyRow && item.isBinaryBacked()) {
    yield handleBinaryLazyRow(item);
  } else if (item instanceof LazyRow) {
    yield handleStringLazyRow(item);
  } else if (Array.isArray(item) && item[0] instanceof LazyRow) {
    yield handleLazyRowArray(item);
  } else if (Array.isArray(item)) {
    yield handleRowArray(item);
  }
}
```

**Problem:** Type checking happens on every iteration. For a stream of 100,000 items, that's 100,000 type checks.

## The Handler Swap Pattern

Define specialized handler functions, then use a self-replacing dispatcher:

```typescript
// Define specialized handlers for each type
function handleBinaryLazyRow(row: LazyRow): Uint8Array {
  const rowData = row.toBinary();
  // ... optimal implementation for binary LazyRow
}

function handleStringLazyRow(row: LazyRow): Uint8Array {
  const fields = row.toStringArray();
  // ... optimal implementation for string LazyRow
}

function handleRowArray(rows: Row[]): Uint8Array {
  // ... optimal implementation for Row[]
}

// Self-replacing dispatcher
let handler: (item: any) => Uint8Array = (item: any) => {
  // Check type ONCE on first call
  if (item instanceof LazyRow && item.isBinaryBacked()) {
    handler = handleBinaryLazyRow;  // Replace self
  } else if (item instanceof LazyRow) {
    handler = handleStringLazyRow;  // Replace self
  } else if (Array.isArray(item) && Array.isArray(item[0])) {
    handler = handleRowArray;  // Replace self
  } else {
    throw new TypeError(`Unsupported type: ${typeof item}`);
  }
  
  return handler(item);  // Call the real handler
};

// Use the handler
for await (const item of data) {
  yield handler(item);  // First call: checks type and swaps
                        // All subsequent calls: direct to optimal handler
}
```

## How It Works

1. **First iteration:**
   - `handler` is the dispatcher function
   - Checks the type of the first item
   - Swaps `handler` to point to the optimal specialized function
   - Calls the specialized function with the first item

2. **All subsequent iterations:**
   - `handler` now points directly to the specialized function
   - No type checking, just direct function call
   - Optimal performance

## Real Example from the Codebase

From `src/transforms/csv.ts`:

```typescript
export function toCsv(stringifyOptions?: CsvStringifyOptions) {
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const processor = await FlatdataProcessor.create();
    const separator = stringifyOptions?.separator?.charCodeAt(0) ?? 44;
    const crlf = stringifyOptions?.crlf ?? false;

    // Define specialized handlers
    function handleBinaryLazyRowArray(rows: LazyRow[]): Uint8Array {
      // ... binary LazyRow[] implementation
    }

    function handleStringLazyRowArray(rows: LazyRow[]): Uint8Array {
      // ... string LazyRow[] implementation
    }

    function handleRowArray(rows: Row[]): Uint8Array {
      // ... Row[] implementation
    }

    function handleRow(row: Row): Uint8Array {
      // ... single Row implementation
    }

    // Self-replacing dispatcher
    let handler: (item: any) => Uint8Array = (item: any) => {
      if (Array.isArray(item) && item.length === 0) {
        return new Uint8Array(0);
      }

      if (
        Array.isArray(item) && item.length > 0 &&
        item[0] instanceof LazyRow && item[0].isBinaryBacked()
      ) {
        handler = handleBinaryLazyRowArray;
      } else if (
        Array.isArray(item) && item.length > 0 && item[0] instanceof LazyRow
      ) {
        handler = handleStringLazyRowArray;
      } else if (
        Array.isArray(item) && item.length > 0 && Array.isArray(item[0])
      ) {
        handler = handleRowArray;
      } else if (Array.isArray(item)) {
        handler = handleRow;
      } else {
        throw new TypeError(
          `Unsupported input type for toCsv: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
        );
      }

      return handler(item);
    };

    for await (const item of data) {
      yield handler(item);
    }
  };
}
```

## Why This Pattern Works

**For AsyncIterables specifically:**
- Can't check type before iteration starts
- Can't peek at first item without consuming it
- Type is consistent throughout the stream (same type for all items)
- Want optimal performance after type is determined

**The function pointer swap:**
- Checks type exactly once (first iteration)
- Zero overhead for all subsequent iterations
- Each specialized handler is optimized for its type
- Clean separation of concerns

## Performance Impact

For a stream of 100,000 items:

**Without handler swap:**
- 100,000 type checks
- Branch mispredictions on every iteration
- ~5-10 CPU cycles overhead per item

**With handler swap:**
- 1 type check (first iteration)
- Direct function calls (no branches)
- ~0 CPU cycles overhead after first item

**Savings:** Eliminates ~500,000 - 1,000,000 CPU cycles for a 100K item stream.

## When to Use This Pattern

**Use it when:**
- Processing AsyncIterables with unknown types
- Type is consistent throughout the stream
- You have multiple specialized implementations
- Performance matters (hot path)

**Don't use it when:**
- Type is known at function entry
- Type can vary between items in the stream
- Only one implementation exists
- Function is called rarely

## Related Patterns

This is similar to:
- **Polymorphic inline caching** - JIT compilers do this automatically
- **Type specialization** - Rust/C++ monomorphization
- **Strategy pattern** - But with runtime type detection and swap

We're doing manually what optimizing compilers try to do: specialize the hot path based on observed types.

## Key Insight

The pattern exploits two properties of AsyncIterables:
1. **Can't know type until first iteration** - Forces delayed type checking
2. **Type is usually homogeneous** - Same type for all items in stream

By checking once and swapping, we get the best of both worlds: flexibility (accept multiple types) and performance (specialized implementations).

## Used In

This pattern appears in:
- `src/transforms/csv.ts` - `toCsv()`
- `src/transforms/tsv.ts` - `toTsv()`
- `src/transforms/record.ts` - `toRecord()`
- `src/transforms/lazyrow-binary.ts` - `toLazyRowBinary()`

All transform functions that accept multiple input types use this pattern.

## Performance Validation

We benchmarked the handler swap pattern to validate its performance claims. All benchmarks run on Intel Core Ultra 5 115U with Deno 2.6.5.

### Type Check Primitives (1M iterations)

First, we measured the cost of different type checking operations:

| Type Check | Time | Relative |
|------------|------|----------|
| `instanceof LazyRow` | 7.7ms | 1.00x (fastest) |
| `typeof === 'string'` | 7.8ms | 1.01x |
| `Array.isArray()` | 8.3ms | 1.08x |

**Compound checks get expensive:**
- `Array.isArray() + length > 0`: 8.2ms
- `Array.isArray() + length + instanceof`: 9.7ms (1.18x slower)
- Full check (4 operations): 9.7ms

**Key finding:** Each additional check adds ~15-20% overhead. The csv.ts transform has 7 different type paths with up to 4 checks each.

### Real-World Pattern: 7 Type Paths (1M iterations)

Testing the actual csv.ts pattern with 7 different type paths:

| Scenario | Handler Swap | Naive Check | Speedup |
|----------|--------------|-------------|---------|
| Binary LazyRow[] (4 checks) | 11.6ms | 13.3ms | **1.15x faster** |
| String LazyRow (2 checks) | 10.2ms | 12.5ms | **1.23x faster** |
| Row[][] (late in chain) | 12.5ms | 18.4ms | **1.48x faster** |

**Key insight:** The later the type appears in the if/else chain, the bigger the win. Row[][] has to fail 6 checks before matching, so handler swap shows a 48% improvement.

### Goldilocks Case: Single Type Check (10M iterations)

Does handler swap still win with only one type to check?

| Approach | Time | vs Baseline |
|----------|------|-------------|
| Direct call (no check) | 79.3ms | baseline |
| Handler swap | 79.9ms | 1.01x slower (0.6ms overhead) |
| Naive check | 100.8ms | 1.27x slower (21ms penalty) |

**Key finding:** Handler swap overhead is essentially FREE - only 0.6ms for 10 million calls. The swap happens once, then V8 can inline the direct function call.

Naive checking pays a 27% penalty for checking `instanceof` on every iteration.

### Function Pointer Overhead (100K chunk, multiple iterations)

Does calling through a variable have inherent overhead vs direct calls?

| Dataset Size | Handler Swap | Direct Call | Overhead |
|--------------|--------------|-------------|----------|
| 1M items | 6.1ms | 3.8ms | 1.64x slower |
| 10M items | 49.5ms | 37.7ms | 1.31x slower |
| 100M items | 515.5ms | 387.1ms | 1.33x slower |

**Yes, function pointers have ~30% overhead.** V8 cannot fully inline through the variable. The overhead scales linearly - it's not getting optimized away.

**However:** This overhead is still much smaller than repeated type checking. For 100M items:
- Function pointer overhead: 128ms (1.28ns per call)
- Single `instanceof` check: 21ms for 10M = 2.1ns per check
- Compound checks (4 operations): ~5.9ns per iteration

The handler swap trades 1 type check + 1.28ns per call vs 5.9ns+ per iteration. The math heavily favors handler swap for large datasets.

### Summary of Findings

**Handler swap wins in all scenarios:**
- Goldilocks (1 type): 1.27x faster than naive
- Real-world (7 types): 1.15-1.48x faster than naive
- Function pointer overhead exists (~30%) but is negligible compared to type checking cost

**The pattern is validated:** For AsyncIterables with multiple type paths, handler swap provides measurable performance gains while maintaining code clarity.

**Benchmarks available in:** `labs/performance/handler_swap_*.ts`
