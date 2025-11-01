# Array-Like Methods

Enumerable gives you the Array methods you know and love, but for async data.

## Transformations

### map()

Transform each item:

<!-- NOT TESTED: Illustrative example -->
```typescript
const doubled = await enumerate([1, 2, 3])
  .map(n => n * 2)
  .collect();
// [2, 4, 6]
```

Works with async functions:

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await enumerate(urls)
  .map(async (url) => {
    const response = await fetch(url);
    return response.json();
  })
  .collect();
```

### filter()

Keep only items that match:

<!-- NOT TESTED: Illustrative example -->
```typescript
const evens = await enumerate([1, 2, 3, 4])
  .filter(n => n % 2 === 0)
  .collect();
// [2, 4]
```

### flatMap()

Map and flatten in one step:

<!-- TESTED: tests/mdbook_examples.test.ts - "array-methods: flatMap" -->
```typescript
const words = await enumerate(["hello world", "foo bar"])
  .flatMap(line => line.split(" "))
  .collect();
// ["hello", "world", "foo", "bar"]
```

## Aggregations

### reduce()

Combine items into a single value:

<!-- NOT TESTED: Illustrative example -->
```typescript
const sum = await enumerate([1, 2, 3, 4])
  .reduce((acc, n) => acc + n, 0);
// 10
```

Build complex objects:

<!-- NOT TESTED: Illustrative example -->
```typescript
const grouped = await enumerate(items)
  .reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});
```

### count()

Count items:

<!-- TESTED: tests/mdbook_examples.test.ts - "array-methods: count" -->
```typescript
const total = await enumerate([1, 2, 3]).count();
// 3
```

### some()

Check if any item matches:

<!-- TESTED: tests/mdbook_examples.test.ts - "array-methods: some" -->
```typescript
const hasError = await enumerate(lines)
  .some(line => line.includes("ERROR"));
```

### every()

Check if all items match:

<!-- TESTED: tests/mdbook_examples.test.ts - "array-methods: every" -->
```typescript
const allPositive = await enumerate([1, 2, 3])
  .every(n => n > 0);
```

## Finding Items

### find()

Find first match:

<!-- TESTED: tests/mdbook_examples.test.ts - "array-methods: find" -->
```typescript
const match = await enumerate([1, 2, 3, 4])
  .find(n => n > 2);
// 3
```

### first

Get first item:

<!-- NOT TESTED: Illustrative example -->
```typescript
const first = await enumerate([1, 2, 3]).first;
// 1
```

### last

Get last item:

<!-- NOT TESTED: Illustrative example -->
```typescript
const last = await enumerate([1, 2, 3]).last;
// 3
```

### nth()

Get item at index:

<!-- NOT TESTED: Illustrative example -->
```typescript
const third = await enumerate([1, 2, 3, 4]).nth(2);
// 3 (zero-indexed)
```

## Slicing

### take()

Take first N items:

<!-- NOT TESTED: Illustrative example -->
```typescript
const first3 = await enumerate([1, 2, 3, 4, 5])
  .take(3)
  .collect();
// [1, 2, 3]
```

### drop()

Skip first N items:

<!-- NOT TESTED: Illustrative example -->
```typescript
const rest = await enumerate([1, 2, 3, 4, 5])
  .drop(2)
  .collect();
// [3, 4, 5]
```

### slice()

Get a range:

<!-- NOT TESTED: Illustrative example -->
```typescript
const middle = await enumerate([1, 2, 3, 4, 5])
  .slice(1, 4)
  .collect();
// [2, 3, 4]
```

## Iteration

### forEach()

Process each item:

<!-- NOT TESTED: Illustrative example -->
```typescript
await enumerate([1, 2, 3]).forEach(n => {
  console.log(n);
});
```

### for-await

Use standard JavaScript iteration:

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const item of enumerate([1, 2, 3])) {
  console.log(item);
}
```

## Collecting

### collect()

Gather all items into an array:

<!-- NOT TESTED: Illustrative example -->
```typescript
const array = await enumerate([1, 2, 3]).collect();
// [1, 2, 3]
```

### toArray()

Alias for collect():

<!-- NOT TESTED: Illustrative example -->
```typescript
const array = await enumerate([1, 2, 3]).toArray();
```

## Utilities

### enum()

Add indices to items:

<!-- NOT TESTED: Illustrative example -->
```typescript
const indexed = await enumerate(["a", "b", "c"])
  .enum()
  .collect();
// [["a", 0], ["b", 1], ["c", 2]]
```

Use with map:

<!-- NOT TESTED: Illustrative example -->
```typescript
const numbered = await enumerate(["a", "b", "c"])
  .enum()
  .map(([item, i]) => `${i + 1}. ${item}`)
  .collect();
// ["1. a", "2. b", "3. c"]
```

### tee()

Split into multiple streams:

<!-- NOT TESTED: Illustrative example -->
```typescript
const [stream1, stream2] = enumerate([1, 2, 3]).tee();

const [sum, product] = await Promise.all([
  stream1.reduce((a, b) => a + b, 0),
  stream2.reduce((a, b) => a * b, 1),
]);
```

### flatten()

Flatten nested iterables:

<!-- NOT TESTED: Illustrative example -->
```typescript
const flat = await enumerate([[1, 2], [3, 4]])
  .flatten()
  .collect();
// [1, 2, 3, 4]
```

## Concurrent Operations

### concurrentMap()

Map with controlled concurrency:

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    return await fetch(url);
  }, { concurrency: 5 })
  .collect();
```

Results are returned in order.

### concurrentUnorderedMap()

Map with maximum concurrency:

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await enumerate(urls)
  .concurrentUnorderedMap(async (url) => {
    return await fetch(url);
  }, { concurrency: 5 })
  .collect();
```

Results are returned as they complete (faster).

## Chaining Examples

### Complex Pipeline

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await enumerate(data)
  .filter(item => item.active)
  .map(item => item.value)
  .filter(value => value > 0)
  .map(value => value * 2)
  .take(10)
  .collect();
```

### Real-World Example

<!-- NOT TESTED: Illustrative example -->
```typescript
const topErrors = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .map(line => {
    const match = line.match(/ERROR: (.+)/);
    return match ? match[1] : line;
  })
  .reduce((acc, error) => {
    acc[error] = (acc[error] || 0) + 1;
    return acc;
  }, {});
```

## Performance Tips

### Use Streaming

Don't collect if you don't need to:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Loads everything
const items = await enumerate(huge).collect();
for (const item of items) process(item);

// ✅ Streams
for await (const item of enumerate(huge)) {
  process(item);
}
```

### Use take() for Limits

<!-- NOT TESTED: Illustrative example -->
```typescript
// Get first 10 matches
const matches = await enumerate(data)
  .filter(predicate)
  .take(10)
  .collect();
```

### Use concurrentMap() for I/O

<!-- NOT TESTED: Illustrative example -->
```typescript
// Process 5 URLs at a time
const results = await enumerate(urls)
  .concurrentMap(fetch, { concurrency: 5 })
  .collect();
```

## Next Steps

- [Transformations](./transformations.md) - Deep dive into map, flatMap, transform
- [Aggregations](./aggregations.md) - Deep dive into reduce, count, sum
- [Slicing and Sampling](./slicing.md) - Deep dive into take, drop, slice
