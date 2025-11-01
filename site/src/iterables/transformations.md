# Transformations

Change data as it flows through your pipeline.

## map()

Transform each item:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const doubled = await enumerate([1, 2, 3])
  .map(n => n * 2)
  .collect();
// [2, 4, 6]
```

### With Async Functions

<!-- TESTED: tests/mdbook_examples.test.ts - "transformations: map with async" -->
```typescript
const results = await enumerate(urls)
  .map(async (url) => {
    const response = await fetch(url);
    return response.json();
  })
  .collect();
```

### Type Transformations

<!-- NOT TESTED: Illustrative example -->
```typescript
const strings = await enumerate([1, 2, 3])
  .map(n => n.toString())
  .collect();
// ["1", "2", "3"]
```

### Complex Transformations

<!-- NOT TESTED: Illustrative example -->
```typescript
const processed = await enumerate(rawData)
  .map(item => ({
    id: item.id,
    name: item.name.toUpperCase(),
    value: parseFloat(item.value),
    timestamp: new Date(item.timestamp)
  }))
  .collect();
```

## flatMap()

Map and flatten in one step:

<!-- NOT TESTED: Illustrative example -->
```typescript
const words = await enumerate(["hello world", "foo bar"])
  .flatMap(line => line.split(" "))
  .collect();
// ["hello", "world", "foo", "bar"]
```

### Expanding Items

<!-- NOT TESTED: Illustrative example -->
```typescript
const expanded = await enumerate([1, 2, 3])
  .flatMap(n => [n, n * 10])
  .collect();
// [1, 10, 2, 20, 3, 30]
```

### Filtering While Mapping

<!-- NOT TESTED: Illustrative example -->
```typescript
const valid = await enumerate(data)
  .flatMap(item => {
    if (item.valid) {
      return [item.value];
    }
    return [];  // Skip invalid items
  })
  .collect();
```

## filter()

Keep only matching items:

<!-- NOT TESTED: Illustrative example -->
```typescript
const evens = await enumerate([1, 2, 3, 4, 5])
  .filter(n => n % 2 === 0)
  .collect();
// [2, 4]
```

### Complex Predicates

<!-- NOT TESTED: Illustrative example -->
```typescript
const active = await enumerate(users)
  .filter(user => 
    user.active && 
    user.lastLogin > cutoffDate &&
    user.role !== "guest"
  )
  .collect();
```

### With Type Guards

<!-- NOT TESTED: Illustrative example -->
```typescript
const numbers = await enumerate(mixed)
  .filter((item): item is number => typeof item === "number")
  .collect();
```

## transform()

Apply a TransformStream:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const decompressed = await read("file.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .collect();
```

### Custom Transform

<!-- NOT TESTED: Illustrative example -->
```typescript
const transformed = await enumerate(data)
  .transform(new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk.toUpperCase());
    }
  }))
  .collect();
```

## Chaining Transformations

Combine multiple transformations:

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await enumerate(data)
  .map(item => item.trim())
  .filter(item => item.length > 0)
  .map(item => item.toUpperCase())
  .filter(item => item.startsWith("A"))
  .collect();
```

## Real-World Examples

### Parse CSV

<!-- NOT TESTED: Illustrative example -->
```typescript
const data = await read("data.csv")
  .lines
  .drop(1)  // Skip header
  .map(line => line.split(","))
  .map(([name, age, city]) => ({
    name,
    age: parseInt(age),
    city
  }))
  .filter(row => row.age >= 18)
  .collect();
```

### Extract URLs

<!-- NOT TESTED: Illustrative example -->
```typescript
const urls = await read("page.html")
  .lines
  .flatMap(line => {
    const matches = line.match(/https?:\/\/[^\s"']+/g);
    return matches || [];
  })
  .collect();
```

### Clean Data

<!-- NOT TESTED: Illustrative example -->
```typescript
const cleaned = await enumerate(rawData)
  .map(item => item.trim())
  .filter(item => item.length > 0)
  .map(item => item.toLowerCase())
  .filter(item => !item.startsWith("#"))
  .collect();
```

### Transform JSON Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
const objects = await read("data.jsonl")
  .lines
  .map(line => JSON.parse(line))
  .filter(obj => obj.status === "active")
  .map(obj => ({
    id: obj.id,
    name: obj.name,
    value: obj.value * 1.1  // Apply 10% increase
  }))
  .collect();
```

## Performance Tips

### Lazy Evaluation

Transformations don't run until you consume:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Nothing happens yet
const pipeline = enumerate(data)
  .map(expensive)
  .filter(predicate);

// Now it runs
const result = await pipeline.collect();
```

### Early Filtering

Filter before expensive operations:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ✅ Filter first
const result = await enumerate(data)
  .filter(cheap)      // Fast filter
  .map(expensive)     // Expensive operation
  .collect();

// ❌ Map first
const result = await enumerate(data)
  .map(expensive)     // Runs on everything
  .filter(cheap)      // Then filters
  .collect();
```

### Use take() to Limit

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
  .map(item => ({
    ...item,
    name: item.name.trim().toLowerCase(),
    email: item.email.toLowerCase(),
    phone: item.phone.replace(/\D/g, "")
  }))
  .collect();
```

### Extract Fields

<!-- NOT TESTED: Illustrative example -->
```typescript
const names = await enumerate(users)
  .map(user => user.name)
  .collect();
```

### Conditional Transform

<!-- NOT TESTED: Illustrative example -->
```typescript
const processed = await enumerate(items)
  .map(item => {
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
    batch: Math.floor(i / 100)
  }))
  .collect();
```

## Error Handling

Errors in transformations propagate:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await enumerate(data)
    .map(item => {
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
