# Zip and Enumerate

Combine and index iterables.

## enumerate()

Wrap any iterable for Array-like methods:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const result = await enumerate([1, 2, 3])
  .map(n => n * 2)
  .collect();
// [2, 4, 6]
```

## .enum()

Add indices to items:

<!-- TESTED: tests/mdbook_examples.test.ts - "zip-enumerate: enum" -->
```typescript
const indexed = await enumerate(["a", "b", "c"])
  .enum()
  .collect();
// [["a", 0], ["b", 1], ["c", 2]]
```

### Format with Indices

<!-- NOT TESTED: Illustrative example -->
```typescript
const numbered = await enumerate(["apple", "banana", "cherry"])
  .enum()
  .map(([fruit, i]) => `${i + 1}. ${fruit}`)
  .collect();
// ["1. apple", "2. banana", "3. cherry"]
```

## zip()

Combine two iterables:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { zip } from "jsr:@j50n/proc@{{gitv}}";

const names = ["Alice", "Bob", "Charlie"];
const ages = [25, 30, 35];

const people = await zip(names, ages)
  .map(([name, age]) => ({ name, age }))
  .collect();
// [{ name: "Alice", age: 25 }, ...]
```

### Multiple Iterables

<!-- NOT TESTED: Illustrative example -->
```typescript
const combined = await zip(iter1, iter2)
  .map(([a, b]) => a + b)
  .collect();
```

## Real-World Examples

### Number Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
const numbered = await read("file.txt")
  .lines
  .enum()
  .map(([line, i]) => `${i + 1}: ${line}`)
  .forEach(console.log);
```

### Combine Data Sources

<!-- NOT TESTED: Illustrative example -->
```typescript
const merged = await zip(
  read("names.txt").lines,
  read("emails.txt").lines
)
  .map(([name, email]) => ({ name, email }))
  .collect();
```

### Track Progress

<!-- NOT TESTED: Illustrative example -->
```typescript
const items = [...]; // Large array

await enumerate(items)
  .enum()
  .forEach(([item, i]) => {
    console.log(`Processing ${i + 1}/${items.length}`);
    process(item);
  });
```

## Next Steps

- [Range and Iteration](./range.md) - Generate sequences
- [Array-Like Methods](../iterables/array-methods.md) - Transform data
