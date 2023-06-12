# Utility Functions

## Sleep

Pause for some amount of time (measured in milliseconds) without blocking.

**Example**

Sleep for two seconds:

```typescript
await sleep(2000);
```

## Range

This lazily produces a sequence of numbers in `for...next` fashion.

There are two variants. In the `to` variant, the end number is exclusive. In the
`until` variant, the end number is inclusive. The default starting number is
always 0, and the default step is 1.

This is a lazy operation. It is creating the results one at a time rather than
all at once in memory. Therefore it is perfectly reasonable to do something like
create an infinite range.

### Example 1

Prints the numbers `0`, `1`, and `2`. Using `to` so the end number is exclusive.
Default `from` is `0`.

```typescript
for (const i of range({ to: 3 })) {
  console.log(i);
}
```

### Example 2

Prints the numbers `0`, `1`, `2`, and `3`. Using `from` so the end number is
inclusive. Default `from` is `0`.

```typescript
for (const i of range({ until: 3 })) {
  console.log(i);
}
```

### Example 3

Prints the numbers from `10` to `1`, descending order.

```typescript
for (const i of range({ from: 10, to: 0, step: -1 })) {
  console.log(i);
}
```

### Example 4

Prints the numbers from `0` to `99`.

```typescript
for (const i of range({ to: 10 })) {
  for (const j of range({ to: 10 })) {
    console.log(i * 10 + j);
  }
}
```

### Example 5

An infinite loop that breaks at 20.

```typescript
for await (const n of range({ to: Number.POSITIVE_INFINITY })) {
  if (n > 20) {
    break;
  }
  console.log(n);
}
```
