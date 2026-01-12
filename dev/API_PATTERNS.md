# deno-proc API Patterns and Common Gotchas

## Critical API Distinctions

**Properties vs Methods:**
- Properties (no parentheses): `.lines`, `.status`, `.first`, `.last`
- Methods (with parentheses): `.collect()`, `.map()`, `.filter()`, `.count()`

**Common Mistakes:**
- ❌ `.lines()` → ✅ `.lines`
- ❌ `.status()` → ✅ `.status`
- ❌ `.toArray()` → ✅ `.collect()`
- ❌ `readLines(path)` → ✅ `read(path).lines`
- ❌ `.slice(1, 4)` → ✅ `.drop(1).take(3)` (slice doesn't exist on Enumerable)

## Error Handling

**Key Principle:** Errors propagate through pipelines naturally like data.

- Processes that exit with non-zero codes throw `ExitCodeError` when output is consumed
- Handle errors once at the end with try-catch, not at each transformation step
- No separate error channels or callbacks needed
- This is a PRIMARY selling point - "JavaScript streaming is fast, but error handling shouldn't break your brain"

**Example:**
```typescript
try {
  await run("command")
    .lines
    .map(transform)
    .filter(predicate)
    .forEach(process);
} catch (error) {
  // Handle all errors here
}
```

## Resource Management

**Critical:** Always consume process output or resources will leak.

- Use `.lines.collect()`, `.lines.forEach()`, or similar
- Unconsumed stdout causes resource leaks
- The `.status` property should be checked after consuming output

## Enumeration Pattern

**Common Confusion:** `enumerate()` wraps iterables but does NOT add indices.

- `enumerate(iterable)` - wraps an iterable in Enumerable
- `.enum()` - adds `[item, index]` tuples

**Example:**
```typescript
const result = await enumerate(["a", "b", "c"])
  .enum()  // This adds the indices!
  .map(([item, i]) => `${i}: ${item}`)
  .collect();
// ["0: a", "1: b", "2: c"]
```

## Process Chaining

- Use `.run()` method to chain processes (not `.pipe()`)
- Each `.run()` pipes the previous output to the next process's stdin

**Example:**
```typescript
await run("echo", "HELLO")
  .run("tr", "A-Z", "a-z")  // Pipes output
  .lines.first;
```

## Streaming with TransformStream

- Use `.transform()` method to apply TransformStream
- Works with Web Streams API (e.g., DecompressionStream)

**Example:**
```typescript
await read("file.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count();
```

## Concurrent Operations

- Method names: `concurrentMap`, `concurrentUnorderedMap` (not `mapAsync`)
- `concurrentMap` - preserves order
- `concurrentUnorderedMap` - better performance, no order guarantee

## File Reading

- Use `read(path)` to read files as Enumerable<Uint8Array>
- Use `.lines` property to convert to text lines
- No separate `readLines()` or `readBytes()` functions

## Test Requirements

- All README examples must have corresponding tests
- Tests should use `--no-check` flag for DecompressionStream compatibility
- Current test count: 136 tests
- Test file: tests/readme_examples.test.ts

## Documentation Standards

- JSDoc must clarify properties vs methods
- Include examples showing correct usage
- Highlight error propagation patterns
- Explain resource management requirements
- Show integration with Web Streams API
