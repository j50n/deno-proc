# Working with Input

Send data to process stdin.

## Choosing Your Approach

**Use `.run()` for process-to-process pipes** (most common):
<!-- NOT TESTED: Illustrative example -->
```typescript
await run("cat", "file.txt").run("grep", "pattern").toStdout();
```

**Use `enumerate()` for in-memory data**:
<!-- NOT TESTED: Illustrative example -->
```typescript
await enumerate(["line1", "line2"]).run("grep", "1").toStdout();
```

**Use `read()` for file input**:
<!-- NOT TESTED: Illustrative example -->
```typescript
await read("input.txt").run("grep", "pattern").toStdout();
```

**Use `range()` for generated sequences**:
<!-- NOT TESTED: Illustrative example -->
```typescript
await range({ to: 100 }).map(n => n.toString()).run("shuf").toStdout();
```

## Piping Between Processes

The most common way to provide input:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

await run("echo", "hello")
  .run("tr", "a-z", "A-Z")  // Receives "hello" as stdin
  .toStdout();
// HELLO
```

## From Enumerable

Pipe any enumerable to a process:

<!-- TESTED: tests/mdbook_examples.test.ts - "input: pipe from enumerable" -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const data = ["line 1", "line 2", "line 3"];

await enumerate(data)
  .run("grep", "2")
  .toStdout();
// line 2
```

## From File

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
