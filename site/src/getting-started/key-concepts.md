# Key Concepts

Before you dive deep, let's cover a few concepts that will make everything click.

## Properties vs Methods

This trips up everyone at first. Some APIs are **properties** (no parentheses), some are **methods** (with parentheses).

**Properties:**
<!-- NOT TESTED: Illustrative example -->
```typescript
.lines    // Not .lines()
.status   // Not .status()
.first    // Not .first()
.last     // Not .last()
```

**Methods:**
<!-- NOT TESTED: Illustrative example -->
```typescript
.collect()
.map()
.filter()
.count()
```

**Why?** Properties are getters that return new objects or promises. Methods are functions you call. Your IDE will help, but when in doubt, check the docs.

## Error Propagation

Errors flow through pipelines like data—no need to check at every step:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("command1")
    .run("command2")
    .run("command3")
    .lines
    .forEach(process);
} catch (error) {
  // All errors caught here
  handle(error);
}
```

Errors from processes, transformations, or your own code all propagate to the same place. For details, see [Error Handling](../core/error-handling.md).

## Resource Management

**Golden rule:** Always consume process output.

**Good:**
<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls").lines.collect();  // ✅ Output consumed
await run("ls").lines.forEach(console.log);  // ✅ Output consumed
```

**Bad:**
<!-- NOT TESTED: Illustrative example -->
```typescript
const p = run("ls");  // ❌ Output never consumed = resource leak
```

**Why?** Unconsumed output keeps the process handle open. Always use `.collect()`, `.forEach()`, or iterate through the output.

## Enumeration Pattern

`enumerate()` wraps an iterable to give it Array-like methods. To add indices, call `.enum()` on the result:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

// enumerate() wraps the iterable, .enum() adds indices
const numbered = await enumerate(["a", "b", "c"])
  .enum()  // Returns [item, index] tuples
  .map(([item, i]) => `${i}: ${item}`)
  .collect();
// ["0: a", "1: b", "2: c"]
```

**Why two steps?** `enumerate()` gives you the methods (map, filter, etc.), while `.enum()` is just one of many operations you can perform. You might not always need indices:

<!-- TESTED: tests/mdbook_examples.test.ts - "key-concepts: enumerate without indices" -->
```typescript
// Use enumerate() without .enum() for other operations
const doubled = await enumerate([1, 2, 3])
  .map(n => n * 2)  // No indices needed
  .collect();
```

## Streaming Everything

proc is **lazy** and **streaming** by default. Nothing happens until you consume the output.

<!-- TESTED: tests/mdbook_examples.test.ts - "key-concepts: streaming" -->
```typescript
// This doesn't run anything yet
const pipeline = run("cat", "huge-file.txt")
  .run("grep", "error")
  .lines
  .map(line => line.toUpperCase());

// Now it runs, one line at a time
for await (const line of pipeline) {
  console.log(line);  // Processes one line at a time
}
```

This means you can process files larger than memory. The data flows through, never all loaded at once.

## Type Safety

proc is fully typed. Your IDE will guide you:

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines: string[] = await run("ls").lines.collect();
//    ^-- TypeScript knows this is string[]

const count: number = await run("ls").lines.count();
//    ^-- TypeScript knows this is number
```

If you see a type error, you're probably using the API wrong. Check the docs!

## Next Steps

Now that you understand the concepts, dive into:

- [Error Handling](../core/error-handling.md) - Deep dive into the killer feature
- [Running Processes](../core/running-processes.md) - All the ways to run commands
- [Array-Like Methods](../iterables/array-methods.md) - map, filter, reduce, and more
