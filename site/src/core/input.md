# Working with Input

Sending data to process stdin is fundamental to building effective data processing pipelines. proc provides several approaches depending on your data source and use case.

## Choosing the Right Input Method

The most common approach is using `.run()` to pipe output from one process directly to another, creating efficient process-to-process pipelines:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("cat", "file.txt").run("grep", "pattern").toStdout();
```

When you have in-memory data that you want to send to a process, `enumerate()` wraps your data and makes it pipeable:

<!-- NOT TESTED: Illustrative example -->
```typescript
await enumerate(["line1", "line2"]).run("grep", "1").toStdout();
```

For file input, `read()` creates a stream directly from the file system:

<!-- NOT TESTED: Illustrative example -->
```typescript
await read("input.txt").run("grep", "pattern").toStdout();
```

When you need generated sequences, `range()` creates numeric streams that you can transform and pipe:

<!-- NOT TESTED: Illustrative example -->
```typescript
await range({ to: 100 }).map(n => n.toString()).run("shuf").toStdout();
```

## Piping Between Processes

The most common way to provide input is piping output from one process directly to another. This creates efficient data flows without intermediate storage:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

await run("echo", "hello")
  .run("tr", "a-z", "A-Z")  // Receives "hello" as stdin
  .toStdout();
// HELLO
```

## Working with In-Memory Data

When you have data in memory that you want to send to a process, `enumerate()` makes any iterable pipeable to processes:

<!-- TESTED: tests/mdbook_examples.test.ts - "input: pipe from enumerable" -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const data = ["line 1", "line 2", "line 3"];

await enumerate(data)
  .run("grep", "2")
  .toStdout();
// line 2
```

## Reading from Files

For file input, `read()` creates a stream directly from the file system, allowing you to process files of any size efficiently:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

await read("input.txt")
  .run("grep", "pattern")
  .toStdout();
```

## Real-World Examples

### Filter Data

<!-- NOT TESTED: Illustrative example -->
```typescript
await read("data.txt")
  .run("grep", "ERROR")
  .run("sort")
  .run("uniq")
  .toStdout();
```

### Transform and Process

<!-- NOT TESTED: Illustrative example -->
```typescript
await read("input.txt")
  .lines
  .map(line => line.toUpperCase())
  .run("sort")
  .toStdout();
```

### Generate and Process

<!-- NOT TESTED: Illustrative example -->
```typescript
import { range } from "jsr:@j50n/proc@{{gitv}}";

await range({ to: 100 })
  .map(n => n.toString())
  .run("shuf")  // Shuffle
  .run("head", "-10")
  .toStdout();
```

## Next Steps

- [Process Pipelines](./pipelines.md) - Chain commands
- [Working with Output](./output.md) - Capture results
