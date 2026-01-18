# Key Concepts

A few patterns that will make everything click.

## Properties vs Methods

Some APIs are properties (no parentheses), some are methods (with parentheses):

```typescript
// Properties - no parentheses
.lines
.status
.first
.last

// Methods - with parentheses
.collect()
.map()
.filter()
.count()
```

Properties return new objects or promises. Methods are functions you call. Your
IDE will guide you.

## Error Propagation

Errors flow through pipelines like data. One try-catch handles everything:

```typescript
try {
  await run("command1")
    .run("command2")
    .run("command3")
    .lines
    .forEach(process);
} catch (error) {
  // Process errors, transform errors, your errors—all caught here
}
```

**Important**: Errors occur in sync with the data stream. If a process fails on
line 100, you'll successfully process lines 1-99 first. This makes error
handling predictable and eliminates race conditions common in traditional
streams.

See [Error Handling](../core/error-handling.md) for the full story.

## Resource Management

Always consume process output. Unconsumed output keeps the process handle open.

```typescript
// ✅ Good - output consumed
await run("ls").lines.collect();
await run("ls").lines.forEach(console.log);

// ❌ Bad - resource leak
const p = run("ls"); // Output never consumed
```

## The enumerate() Pattern

`enumerate()` wraps an iterable to add Array-like methods. Call `.enum()` to add
indices:

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

// Without indices
const doubled = await enumerate([1, 2, 3])
  .map((n) => n * 2)
  .collect();
// [2, 4, 6]

// With indices
const numbered = await enumerate(["a", "b", "c"])
  .enum()
  .map(([item, i]) => `${i}: ${item}`)
  .collect();
// ["0: a", "1: b", "2: c"]
```

## Lazy Evaluation

Pipelines are lazy. Nothing executes until you consume the output:

```typescript
// This doesn't run anything yet
const pipeline = run("cat", "huge-file.txt")
  .run("grep", "error")
  .lines
  .map((line) => line.toUpperCase());

// Now it runs, one line at a time
for await (const line of pipeline) {
  console.log(line);
}
```

This enables processing files larger than memory—data flows through without
loading everything at once.

## Type Safety

proc is fully typed. TypeScript knows what you're working with:

```typescript
const lines: string[] = await run("ls").lines.collect();
const count: number = await run("ls").lines.count();
```

Type errors usually mean you're using the API incorrectly.

## See Also

- [Running Processes](../core/running-processes.md) — Execute commands and
  capture output
- [Error Handling](../core/error-handling.md) — How errors propagate through
  pipelines
- [Understanding Enumerable](../iterables/enumerable.md) — Deep dive into async
  iterables
