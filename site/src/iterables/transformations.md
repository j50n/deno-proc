# Transformations

Transform data as it flows through your pipeline using familiar Array-like
methods that work seamlessly with async data streams.

## Understanding map()

The `map()` method transforms each item in your stream, applying a function to
every element and returning a new stream with the transformed values:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const doubled = await enumerate([1, 2, 3])
  .map((n) => n * 2)
  .collect();
// [2, 4, 6]
```

Map works seamlessly with async functions, making it perfect for I/O operations
like API calls:

<!-- TESTED: tests/mdbook_examples.test.ts - "transformations: map with async" -->

```typescript
const results = await enumerate(urls)
  .map(async (url) => {
    const response = await fetch(url);
    return response.json();
  })
  .collect();
```

You can transform data types, converting numbers to strings or restructuring
objects:

<!-- NOT TESTED: Illustrative example -->

```typescript
const strings = await enumerate([1, 2, 3])
  .map((n) => n.toString())
  .collect();
// ["1", "2", "3"]
```

For complex transformations, map can restructure entire objects:

<!-- NOT TESTED: Illustrative example -->

```typescript
const processed = await enumerate(rawData)
  .map((item) => ({
    id: item.id,
    name: item.name.toUpperCase(),
    value: parseFloat(item.value),
    timestamp: new Date(item.timestamp),
  }))
  .collect();
```

})) .collect();

````
## Working with flatMap()

The `flatMap()` method combines mapping and flattening in a single operation, which is perfect when your transformation function returns arrays that you want to merge into a single stream:

<!-- NOT TESTED: Illustrative example -->
```typescript
const words = await enumerate(["hello world", "foo bar"])
  .flatMap(line => line.split(" "))
  .collect();
// ["hello", "world", "foo", "bar"]
````

You can use flatMap to expand items, creating multiple output items from each
input:

<!-- NOT TESTED: Illustrative example -->

```typescript
const expanded = await enumerate([1, 2, 3])
  .flatMap((n) => [n, n * 10])
  .collect();
// [1, 10, 2, 20, 3, 30]
```

FlatMap is also useful for filtering while mapping—return an empty array to skip
items:

<!-- NOT TESTED: Illustrative example -->

```typescript
const valid = await enumerate(data)
  .flatMap((item) => {
    if (item.valid) {
      return [item.value];
    }
    return []; // Skip invalid items
  })
  .collect();
```

## Filtering with filter()

The `filter()` method keeps only items that match your criteria, discarding
everything else:

<!-- NOT TESTED: Illustrative example -->

```typescript
const evens = await enumerate([1, 2, 3, 4, 5])
  .filter((n) => n % 2 === 0)
  .collect();
// [2, 4]
```

You can use complex predicates that check multiple conditions:

<!-- NOT TESTED: Illustrative example -->

```typescript
const active = await enumerate(users)
  .filter((user) =>
    user.active &&
    user.lastLogin > cutoffDate &&
    user.role !== "guest"
  )
  .collect();
```

Filter works well with TypeScript type guards to narrow types:

<!-- NOT TESTED: Illustrative example -->

```typescript
const numbers = await enumerate(mixed)
  .filter((item): item is number => typeof item === "number")
  .collect();
```

## Using transform() with Streams

The `transform()` method lets you apply any TransformStream to your data, which
is particularly useful for built-in transformations like compression:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const decompressed = await read("file.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .collect();
```

You can also create custom TransformStreams for specialized processing:

<!-- NOT TESTED: Illustrative example -->

```typescript
const transformed = await enumerate(data)
  .transform(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk.toUpperCase());
      },
    }),
  )
  .collect();
```

## Chaining Transformations

Combine multiple transformations:

<!-- NOT TESTED: Illustrative example -->

```typescript
const result = await enumerate(data)
  .map((item) => item.trim())
  .filter((item) => item.length > 0)
  .map((item) => item.toUpperCase())
  .filter((item) => item.startsWith("A"))
  .collect();
```

## Real-World Examples

### Parse CSV

<!-- NOT TESTED: Illustrative example -->

```typescript
const data = await read("data.csv")
  .lines
  .drop(1) // Skip header
  .map((line) => line.split(","))
  .map(([name, age, city]) => ({
    name,
    age: parseInt(age),
    city,
  }))
  .filter((row) => row.age >= 18)
  .collect();
```

### Extract URLs

<!-- NOT TESTED: Illustrative example -->

```typescript
const urls = await read("page.html")
  .lines
  .flatMap((line) => {
    const matches = line.match(/https?:\/\/[^\s"']+/g);
    return matches || [];
  })
  .collect();
```

### Clean Data

<!-- NOT TESTED: Illustrative example -->

```typescript
const cleaned = await enumerate(rawData)
  .map((item) => item.trim())
  .filter((item) => item.length > 0)
  .map((item) => item.toLowerCase())
  .filter((item) => !item.startsWith("#"))
  .collect();
```

### Transform JSON Lines

<!-- NOT TESTED: Illustrative example -->

```typescript
const objects = await read("data.jsonl")
  .lines
  .map((line) => JSON.parse(line))
  .filter((obj) => obj.status === "active")
  .map((obj) => ({
    id: obj.id,
    name: obj.name,
    value: obj.value * 1.1, // Apply 10% increase
  }))
  .collect();
```

## Performance Optimization

Understanding how transformations work can help you build more efficient
pipelines. Transformations use lazy evaluation, meaning nothing actually runs
until you consume the results:

<!-- NOT TESTED: Illustrative example -->

```typescript
// Nothing happens yet
const pipeline = enumerate(data)
  .map(expensive)
  .filter(predicate);

// Now it runs
const result = await pipeline.collect();
```

For better performance, filter before expensive operations to reduce the amount
of data that needs processing:

<!-- NOT TESTED: Illustrative example -->

```typescript
// ✅ Filter first
const result = await enumerate(data)
  .filter(cheap) // Fast filter
  .map(expensive) // Expensive operation
  .collect();

// ❌ Map first
const result = await enumerate(data)
  .map(expensive) // Runs on everything
  .filter(cheap) // Then filters
  .collect();
```

Use `take()` to limit processing when you only need a subset of results:

<!-- NOT TESTED: Illustrative example -->

```typescript
// Stop after 10 matches
const first10 = await enumerate(huge)
  .filter(predicate)
  .take(10)
  .collect();
```

## Common Patterns

### Normalize Data

<!-- NOT TESTED: Illustrative example -->

```typescript
const normalized = await enumerate(data)
  .map((item) => ({
    ...item,
    name: item.name.trim().toLowerCase(),
    email: item.email.toLowerCase(),
    phone: item.phone.replace(/\D/g, ""),
  }))
  .collect();
```

### Extract Fields

<!-- NOT TESTED: Illustrative example -->

```typescript
const names = await enumerate(users)
  .map((user) => user.name)
  .collect();
```

### Conditional Transform

<!-- NOT TESTED: Illustrative example -->

```typescript
const processed = await enumerate(items)
  .map((item) => {
    if (item.type === "A") {
      return processTypeA(item);
    } else {
      return processTypeB(item);
    }
  })
  .collect();
```

### Batch Transform

<!-- NOT TESTED: Illustrative example -->

```typescript
const batched = await enumerate(items)
  .map((item, i) => ({
    ...item,
    batch: Math.floor(i / 100),
  }))
  .collect();
```

## Error Handling

Errors in transformations propagate:

<!-- NOT TESTED: Illustrative example -->

```typescript
try {
  await enumerate(data)
    .map((item) => {
      if (!item.valid) {
        throw new Error(`Invalid item: ${item.id}`);
      }
      return item.value;
    })
    .collect();
} catch (error) {
  console.error(`Transform failed: ${error.message}`);
}
```

## Next Steps

- [Aggregations](./aggregations.md) - Combine items into single values
- [Array-Like Methods](./array-methods.md) - All available methods
- [Concurrent Processing](../advanced/concurrent.md) - Transform in parallel
