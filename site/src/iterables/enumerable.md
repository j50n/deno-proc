# Understanding Enumerable

Enumerable is the core of proc's async iterable support. It wraps any iterable and provides Array-like methods for working with async data streams.

## What is Enumerable?

Think of Enumerable as an Array, but for async data. It gives you familiar methods like `map`, `filter`, and `reduce`—but for data that arrives over time rather than all at once:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

// Wrap any iterable
const nums = enumerate([1, 2, 3, 4, 5]);

// Use Array methods
const doubled = await nums
  .map(n => n * 2)
  .filter(n => n > 5)
  .collect();

console.log(doubled); // [6, 8, 10]
```

## The Problem with Traditional Streams

JavaScript has Arrays for sync data and Streams for async data, but Streams are awkward to work with. They require verbose transformation chains and complex error handling:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Streams are verbose
const stream = readableStream
  .pipeThrough(new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk * 2);
    }
  }))
  .pipeThrough(new TransformStream({
    transform(chunk, controller) {
      if (chunk > 5) controller.enqueue(chunk);
    }
  }));
```

Enumerable makes the same operations clean and readable:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Enumerable is clean
const result = await enumerate(asyncIterable)
  .map(n => n * 2)
  .filter(n => n > 5)
  .collect();
```

## Creating Enumerables

### From Arrays

<!-- NOT TESTED: Illustrative example -->
```typescript
const nums = enumerate([1, 2, 3]);
```

### From Async Generators

<!-- NOT TESTED: Illustrative example -->
```typescript
async function* generate() {
  yield 1;
  yield 2;
  yield 3;
}

const nums = enumerate(generate());
```

### From Process Output

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const lines = run("ls", "-la").lines;
// lines is already an Enumerable<string>
```

### From Files

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const bytes = read("file.txt");
// bytes is Enumerable<Uint8Array>

const lines = read("file.txt").lines;
// lines is Enumerable<string>
```

## Consuming Enumerables

### Collect to Array

<!-- NOT TESTED: Illustrative example -->
```typescript
const array = await enumerate([1, 2, 3]).collect();
// [1, 2, 3]
```

### Iterate with for-await

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const item of enumerate([1, 2, 3])) {
  console.log(item);
}
```

### Process Each Item

<!-- NOT TESTED: Illustrative example -->
```typescript
await enumerate([1, 2, 3]).forEach(item => {
  console.log(item);
});
```

### Get First or Last

<!-- NOT TESTED: Illustrative example -->
```typescript
const first = await enumerate([1, 2, 3]).first;
const last = await enumerate([1, 2, 3]).last;
```

## Lazy Evaluation

Enumerables are **lazy**—nothing happens until you consume them:

<!-- NOT TESTED: Illustrative example -->
```typescript
// This doesn't run anything yet
const pipeline = enumerate([1, 2, 3])
  .map(n => {
    console.log(`Processing ${n}`);
    return n * 2;
  });

// Now it runs
const result = await pipeline.collect();
// Logs: Processing 1, Processing 2, Processing 3
```

This is powerful for large datasets:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Processes one line at a time, never loads entire file
for await (const line of read("huge-file.txt").lines) {
  process(line);
}
```

## Chaining Operations

Chain as many operations as you want:

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await enumerate([1, 2, 3, 4, 5])
  .map(n => n * 2)        // [2, 4, 6, 8, 10]
  .filter(n => n > 5)     // [6, 8, 10]
  .map(n => n.toString()) // ["6", "8", "10"]
  .collect();
```

Each operation returns a new Enumerable, so you can keep chaining.

## Type Safety

Enumerable is fully typed:

<!-- NOT TESTED: Illustrative example -->
```typescript
const nums: Enumerable<number> = enumerate([1, 2, 3]);

const strings: Enumerable<string> = nums.map(n => n.toString());
//    ^-- TypeScript knows this is Enumerable<string>

const result: string[] = await strings.collect();
//    ^-- TypeScript knows this is string[]
```

Your IDE will guide you with autocomplete and type errors.

## Common Patterns

### Transform and Collect

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await enumerate(data)
  .map(transform)
  .collect();
```

### Filter and Count

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await enumerate(data)
  .filter(predicate)
  .count();
```

### Find First Match

<!-- NOT TESTED: Illustrative example -->
```typescript
const match = await enumerate(data)
  .find(predicate);
```

### Check if Any/All

<!-- NOT TESTED: Illustrative example -->
```typescript
const hasMatch = await enumerate(data).some(predicate);
const allMatch = await enumerate(data).every(predicate);
```

## Performance Characteristics

Enumerable is designed for efficiency and scalability. It processes data in a streaming fashion, handling one item at a time rather than loading everything into memory. This lazy evaluation means operations only run when you actually consume the results, making it possible to work with datasets larger than available RAM:

<!-- NOT TESTED: Illustrative example -->
```typescript
// This processes a 10GB file using constant memory
await read("huge-file.txt")
  .lines
  .filter(line => line.includes("ERROR"))
  .forEach(console.log);
```

## Enumerable vs Array Comparison

Understanding when to use each approach helps you choose the right tool:

| Feature | Array | Enumerable |
|---------|-------|------------|
| Data | Sync | Async |
| Memory | All in memory | Streaming |
| Size | Limited by RAM | Unlimited |
| Methods | map, filter, etc. | map, filter, etc. |
| Lazy | No | Yes |

Use Arrays for small, synchronous data that fits comfortably in memory. Use Enumerable for large datasets, async data sources, or when you need streaming processing capabilities.

## Caching Iterables

Sometimes you need to reuse an iterable's results multiple times. Use `cache()` to store results for replay, which is particularly useful for expensive computations or when you need to iterate over the same data multiple times:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { cache, enumerate } from "jsr:@j50n/proc@{{gitv}}";

const expensive = enumerate(data)
  .map(expensiveOperation);

const cached = cache(expensive);

// First time - runs the operations
const result1 = await cached.collect();

// Second time - uses cached results, doesn't re-run
const result2 = await cached.collect();
```

Caching is ideal for reusing expensive computations, replaying iterables multiple times, or sharing results across operations. However, be mindful that caching stores all results in memory, so only use it when the dataset is small enough to fit in memory, you need to iterate multiple times, and the computation is expensive enough to justify the memory usage.

## Writable Iterables

Create async iterables you can write to programmatically, which bridges the gap between push-based and pull-based data models:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable } from "jsr:@j50n/proc@{{gitv}}";

const writable = new WritableIterable<string>();

// Write to it
await writable.write("item1");
await writable.write("item2");
await writable.write("item3");
await writable.close();

// Read from it
const items = await writable.collect();
// ["item1", "item2", "item3"]
```

WritableIterable is perfect for generating data programmatically, bridging between push and pull models, creating custom data sources, or implementing producer-consumer patterns. Here's an example of event-driven data processing:

<!-- NOT TESTED: Illustrative example -->
```typescript
const events = new WritableIterable<Event>();

// Producer: write events as they occur
eventEmitter.on("data", async (event) => {
  await events.write(event);
});

eventEmitter.on("end", async () => {
  await events.close();
});

// Consumer: process events as they arrive
for await (const event of events) {
  processEvent(event);
}
```

## Next Steps

- [Array-Like Methods](./array-methods.md) - All the methods available
- [Transformations](./transformations.md) - map, flatMap, transform
- [Aggregations](./aggregations.md) - reduce, count, sum
