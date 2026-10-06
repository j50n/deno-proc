# Zip and Enumerate

Combine and index iterables.

## enumerate()

Wrap any iterable for Array-like methods:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const result = await enumerate([1, 2, 3])
  .map((n) => n * 2)
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

Pair the items of two async iterables, stopping at the end of the shorter one:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const names = ["Alice", "Bob", "Charlie"];
const ages = [25, 30, 35];

const people = await enumerate(names)
  .zip(enumerate(ages))
  .map(([name, age]) => ({ name, age }))
  .collect();
// [{ name: "Alice", age: 25 }, ...]
```

`zip` pairs exactly two; zip again to add a third, then flatten the pairs.

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
const merged = await read("names.txt").lines
  .zip(read("emails.txt").lines)
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
