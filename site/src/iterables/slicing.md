# Slicing and Sampling

Take portions of your data stream.

## take()

Take first N items:

<!-- TESTED: tests/mdbook_examples.test.ts - "slicing: take" -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const first3 = await enumerate([1, 2, 3, 4, 5])
  .take(3)
  .collect();
// [1, 2, 3]
```

### Early Exit

Stops reading after N items:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Only reads first 10 lines
const preview = await read("huge-file.txt")
  .lines
  .take(10)
  .collect();
```

### With Filter

<!-- NOT TESTED: Illustrative example -->
```typescript
// First 5 errors
const errors = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .take(5)
  .collect();
```

## drop()

Skip first N items:

<!-- TESTED: tests/mdbook_examples.test.ts - "slicing: drop" -->
```typescript
const rest = await enumerate([1, 2, 3, 4, 5])
  .drop(2)
  .collect();
// [3, 4, 5]
```

### Skip Header

<!-- NOT TESTED: Illustrative example -->
```typescript
const data = await read("data.csv")
  .lines
  .drop(1)  // Skip header row
  .collect();
```

## Combining drop() and take()

Get a range of items by combining drop and take:

<!-- TESTED: tests/mdbook_examples.test.ts - "slicing: slice with drop and take" -->
```typescript
const middle = await enumerate([1, 2, 3, 4, 5])
  .drop(1)
  .take(3)
  .collect();
// [2, 3, 4]
```

### Pagination

<!-- NOT TESTED: Illustrative example -->
```typescript
const page = 2;
const pageSize = 10;

const items = await enumerate(allItems)
  .drop(page * pageSize)
  .take(pageSize)
  .collect();
```

## first

Get first item:

<!-- NOT TESTED: Illustrative example -->
```typescript
const first = await enumerate([1, 2, 3]).first;
// 1
```

### With Pipeline

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await run("ls", "-la")
  .lines
  .first;
```

## last

Get last item:

<!-- NOT TESTED: Illustrative example -->
```typescript
const last = await enumerate([1, 2, 3]).last;
// 3
```

**Note:** Reads entire stream to find last item.

## nth()

Get item at index:

<!-- NOT TESTED: Illustrative example -->
```typescript
const third = await enumerate([1, 2, 3, 4, 5]).nth(2);
// 3 (zero-indexed)
```

## Real-World Examples

### Preview File

<!-- NOT TESTED: Illustrative example -->
```typescript
console.log("First 10 lines:");
await read("file.txt")
  .lines
  .take(10)
  .forEach(line => console.log(line));
```

### Skip and Take

<!-- NOT TESTED: Illustrative example -->
```typescript
// Lines 11-20
const batch = await read("file.txt")
  .lines
  .drop(10)
  .take(10)
  .collect();
```

### Sample Data

<!-- NOT TESTED: Illustrative example -->
```typescript
// Every 10th item
const sample = await enumerate(data)
  .filter((_, i) => i % 10 === 0)
  .collect();
```

### Find Nth Match

<!-- NOT TESTED: Illustrative example -->
```typescript
// 5th error
const fifthError = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .nth(4);  // Zero-indexed
```

## Performance Tips

### Use take() for Limits

<!-- NOT TESTED: Illustrative example -->
```typescript
// ✅ Stops early
const first100 = await enumerate(huge)
  .take(100)
  .collect();

// ❌ Reads everything
const all = await enumerate(huge).collect();
const first100 = all.slice(0, 100);  // Array slice, not Enumerable
```

### Combine with Filter

<!-- NOT TESTED: Illustrative example -->
```typescript
// Efficient: stops after 10 matches
const matches = await enumerate(data)
  .filter(predicate)
  .take(10)
  .collect();
```

## Next Steps

- [Array-Like Methods](./array-methods.md) - All available methods
- [Transformations](./transformations.md) - Transform items
- [Streaming Large Files](../advanced/streaming.md) - Work with huge files
