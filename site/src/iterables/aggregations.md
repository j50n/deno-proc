# Aggregations

Combine many items into one result.

## reduce()

The Swiss Army knife of aggregations:

<!-- TESTED: tests/mdbook_examples.test.ts - "enumerable: reduce" -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const sum = await enumerate([1, 2, 3, 4])
  .reduce((acc, n) => acc + n, 0);
// 10
```

### How It Works

<!-- NOT TESTED: Illustrative example -->
```typescript
// Start with initial value: 0
// Step 1: 0 + 1 = 1
// Step 2: 1 + 2 = 3
// Step 3: 3 + 3 = 6
// Step 4: 6 + 4 = 10
```

### Building Objects

<!-- NOT TESTED: Illustrative example -->
```typescript
const grouped = await enumerate(items)
  .reduce((acc, item) => {
    const key = item.category;
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
```

### Calculating Statistics

<!-- NOT TESTED: Illustrative example -->
```typescript
const stats = await enumerate(numbers)
  .reduce((acc, n) => ({
    sum: acc.sum + n,
    count: acc.count + 1,
    min: Math.min(acc.min, n),
    max: Math.max(acc.max, n)
  }), { sum: 0, count: 0, min: Infinity, max: -Infinity });

const average = stats.sum / stats.count;
```

## count()

Count items:

<!-- NOT TESTED: Illustrative example -->
```typescript
const total = await enumerate([1, 2, 3, 4, 5]).count();
// 5
```

### Count Matches

<!-- NOT TESTED: Illustrative example -->
```typescript
const errorCount = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .count();
```

## some()

Check if any item matches:

<!-- NOT TESTED: Illustrative example -->
```typescript
const hasError = await enumerate(lines)
  .some(line => line.includes("ERROR"));
// true or false
```

### Early Exit

Stops as soon as it finds a match:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Stops reading after first match
const hasLargeFile = await enumerate(files)
  .some(file => file.size > 1_000_000_000);
```

## every()

Check if all items match:

<!-- NOT TESTED: Illustrative example -->
```typescript
const allPositive = await enumerate([1, 2, 3, 4])
  .every(n => n > 0);
// true
```

### Validation

<!-- NOT TESTED: Illustrative example -->
```typescript
const allValid = await enumerate(records)
  .every(record => 
    record.name && 
    record.email && 
    record.age >= 0
  );
```

## find()

Find first matching item:

<!-- NOT TESTED: Illustrative example -->
```typescript
const firstError = await enumerate(lines)
  .find(line => line.includes("ERROR"));
// First line with ERROR, or undefined
```

### With Complex Predicate

<!-- NOT TESTED: Illustrative example -->
```typescript
const admin = await enumerate(users)
  .find(user => 
    user.role === "admin" && 
    user.active
  );
```

## Real-World Examples

### Sum Values

<!-- NOT TESTED: Illustrative example -->
```typescript
const total = await enumerate(orders)
  .map(order => order.amount)
  .reduce((sum, amount) => sum + amount, 0);
```

### Count by Category

<!-- TESTED: tests/mdbook_examples.test.ts - "aggregations: build object" -->
```typescript
const counts = await enumerate(items)
  .reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
```

### Find Maximum

<!-- NOT TESTED: Illustrative example -->
```typescript
const max = await enumerate(numbers)
  .reduce((max, n) => Math.max(max, n), -Infinity);
```

### Build Index

<!-- NOT TESTED: Illustrative example -->
```typescript
const index = await enumerate(items)
  .reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
```

### Concatenate Strings

<!-- NOT TESTED: Illustrative example -->
```typescript
const combined = await enumerate(words)
  .reduce((acc, word) => acc + " " + word, "");
```

### Collect Unique Values

<!-- NOT TESTED: Illustrative example -->
```typescript
const unique = await enumerate(items)
  .reduce((acc, item) => {
    acc.add(item);
    return acc;
  }, new Set());
```

## Advanced Patterns

### Running Average

<!-- NOT TESTED: Illustrative example -->
```typescript
const runningAvg = await enumerate(numbers)
  .reduce((acc, n) => {
    acc.sum += n;
    acc.count += 1;
    acc.average = acc.sum / acc.count;
    return acc;
  }, { sum: 0, count: 0, average: 0 });
```

### Nested Grouping

<!-- NOT TESTED: Illustrative example -->
```typescript
const grouped = await enumerate(items)
  .reduce((acc, item) => {
    const cat = item.category;
    const type = item.type;
    
    acc[cat] = acc[cat] || {};
    acc[cat][type] = acc[cat][type] || [];
    acc[cat][type].push(item);
    
    return acc;
  }, {});
```

### Frequency Map

<!-- NOT TESTED: Illustrative example -->
```typescript
const frequency = await enumerate(words)
  .reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

// Find most common
const mostCommon = Object.entries(frequency)
  .sort((a, b) => b[1] - a[1])[0];
```

### Accumulate with Transform

<!-- NOT TESTED: Illustrative example -->
```typescript
const processed = await enumerate(data)
  .reduce((acc, item) => {
    const transformed = transform(item);
    if (transformed.valid) {
      acc.push(transformed);
    }
    return acc;
  }, []);
```

## Performance Tips

### Use Specific Methods

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Slower
const count = await enumerate(items)
  .reduce((acc) => acc + 1, 0);

// ✅ Faster
const count = await enumerate(items).count();
```

### Early Exit with some/every

<!-- NOT TESTED: Illustrative example -->
```typescript
// Stops at first match
const hasMatch = await enumerate(huge)
  .some(predicate);

// Better than
const matches = await enumerate(huge)
  .filter(predicate)
  .count();
```

### Combine Operations

<!-- NOT TESTED: Illustrative example -->
```typescript
// ✅ One pass
const stats = await enumerate(numbers)
  .reduce((acc, n) => ({
    sum: acc.sum + n,
    count: acc.count + 1
  }), { sum: 0, count: 0 });

// ❌ Two passes
const sum = await enumerate(numbers).reduce((a, b) => a + b, 0);
const count = await enumerate(numbers).count();
```

## Common Mistakes

### Forgetting Initial Value

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Error with empty array
const sum = await enumerate([]).reduce((a, b) => a + b);

// ✅ Works with empty array
const sum = await enumerate([]).reduce((a, b) => a + b, 0);
```

### Not Returning Accumulator

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Returns undefined
const result = await enumerate(items)
  .reduce((acc, item) => {
    acc.push(item);
    // Missing return!
  }, []);

// ✅ Returns accumulator
const result = await enumerate(items)
  .reduce((acc, item) => {
    acc.push(item);
    return acc;
  }, []);
```

## Next Steps

- [Transformations](./transformations.md) - Transform items
- [Array-Like Methods](./array-methods.md) - All available methods
- [Streaming Large Files](../advanced/streaming.md) - Aggregate huge datasets
