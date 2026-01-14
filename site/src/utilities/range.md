# Range and Iteration

Generate sequences of numbers lazily, providing a powerful foundation for data
generation and iteration patterns.

## Creating Basic Ranges

The simplest range generates numbers from 0 up to (but not including) a
specified limit:

<!-- TESTED: tests/mdbook_examples.test.ts - "range: basic range" -->

```typescript
import { range } from "jsr:@j50n/proc@{{gitv}}";

const numbers = await range({ to: 5 }).collect();
// [0, 1, 2, 3, 4]
```

## Understanding Exclusive vs Inclusive Bounds

Range provides two ways to specify the upper bound. The `to` parameter is
exclusive, stopping before the specified number:

<!-- NOT TESTED: Illustrative example -->

```typescript
const nums = await range({ to: 3 }).collect();
// [0, 1, 2]
```

The `until` parameter is inclusive, including the specified number in the
result:

<!-- NOT TESTED: Illustrative example -->

```typescript
const nums = await range({ until: 3 }).collect();
// [0, 1, 2, 3]
```

## Customizing Start Points

You can specify where the range begins using the `from` parameter:

<!-- NOT TESTED: Illustrative example -->

```typescript
const nums = await range({ from: 5, to: 10 }).collect();
// [5, 6, 7, 8, 9]
```

## Working with Step Values

The `step` parameter controls the increment between numbers, allowing you to
create sequences like even numbers, multiples, or any regular interval:

<!-- TESTED: tests/mdbook_examples.test.ts - "range: with step" -->

```typescript
const evens = await range({ from: 0, to: 10, step: 2 }).collect();
// [0, 2, 4, 6, 8]
```

## Counting Down

<!-- NOT TESTED: Illustrative example -->

```typescript
const countdown = await range({ from: 5, to: 0, step: -1 }).collect();
// [5, 4, 3, 2, 1]
```

## Real-World Examples

### Repeat N Times

<!-- NOT TESTED: Illustrative example -->

```typescript
await range({ to: 10 }).forEach((i) => {
  console.log(`Iteration ${i}`);
});
```

### Generate Test Data

<!-- NOT TESTED: Illustrative example -->

```typescript
const users = await range({ to: 100 })
  .map((i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
  }))
  .collect();
```

### Batch Processing

<!-- NOT TESTED: Illustrative example -->

```typescript
const batchSize = 10;
const total = 100;

for await (const batch of range({ from: 0, to: total, step: batchSize })) {
  const items = data.slice(batch, batch + batchSize);
  await processBatch(items);
}
```

### Pagination

<!-- NOT TESTED: Illustrative example -->

```typescript
const pages = Math.ceil(total / pageSize);

for await (const page of range({ to: pages })) {
  const items = await fetchPage(page);
  await processItems(items);
}
```

### Retry Logic

<!-- NOT TESTED: Illustrative example -->

```typescript
for await (const attempt of range({ to: 3 })) {
  try {
    await operation();
    break;
  } catch (error) {
    if (attempt === 2) throw error;
    await sleep(1000 * (attempt + 1));
  }
}
```

## Infinite Ranges

**Warning:** Don't collect infinite ranges!

<!-- NOT TESTED: Illustrative example -->

```typescript
// ❌ Never completes
const infinite = await range({ from: 0, to: Infinity }).collect();

// ✅ Use with take()
const first100 = await range({ from: 0, to: Infinity })
  .take(100)
  .collect();
```

## Performance

Ranges are lazy—numbers generated on demand:

<!-- NOT TESTED: Illustrative example -->

```typescript
// Doesn't generate all numbers upfront
const huge = range({ to: 1_000_000_000 });

// Only generates what you use
const first10 = await huge.take(10).collect();
```

## Next Steps

- [Zip and Enumerate](./zip-enumerate.md) - Combine iterables
- [Array-Like Methods](../iterables/array-methods.md) - Transform ranges
