# Common Patterns

This guide shows typical usage patterns to help you understand how proc works in
practice.

## Pattern: Run and Collect

The most basic pattern—run a command and get all output:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const lines = await run("ls", "-la").lines.collect();
// lines is string[]
```

**Key points:**

- `.lines` is a property (no parentheses) that returns an Enumerable
- `.collect()` is a method that consumes the stream and returns an array
- Always consume output to avoid resource leaks

## Pattern: Process Pipeline

Chain commands like shell pipes:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const count = await run("cat", "data.txt")
  .run("grep", "error")
  .run("wc", "-l")
  .lines.first;
```

**Key points:**

- Each `.run()` pipes the previous command's stdout to the next command's stdin
- `.first` is a property that returns a Promise<string | undefined>
- Errors from any command in the chain propagate to the catch block

## Pattern: Transform and Filter

Process output with Array methods:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const errors = await run("cat", "app.log")
  .lines
  .filter((line) => line.includes("ERROR"))
  .map((line) => line.trim())
  .take(10)
  .collect();
```

**Key points:**

- `.lines` converts byte stream to line stream
- Methods like `.filter()`, `.map()`, `.take()` work on the stream
- Nothing executes until you call a terminal operation like `.collect()`

## Pattern: Error Handling

Catch errors at the end of the pipeline:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("npm", "test")
    .lines
    .forEach((line) => console.log(line));
} catch (error) {
  if (error.code) {
    console.error(`Process exited with code ${error.code}`);
  } else {
    console.error(`Error: ${error.message}`);
  }
}
```

**Key points:**

- Processes that exit with non-zero codes throw `ExitCodeError`
- The error has a `.code` property with the exit code
- All errors (process, transform, your code) propagate to the same catch block

## Pattern: Check Status Without Throwing

Get exit status without throwing an error:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const p = run("some-command");
await p.lines.collect(); // Consume output first
const status = await p.status; // .status is a property

if (status.code !== 0) {
  console.error(`Command failed with code ${status.code}`);
}
```

**Key points:**

- `.status` is a property that returns `Promise<CommandStatus>`
- You must consume output before checking status
- This doesn't throw on non-zero exit codes

## Pattern: Enumerate with Indices

Add indices to any iterable:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const numbered = await enumerate(["a", "b", "c"])
  .enum() // Adds [item, index] tuples
  .map(([item, i]) => `${i + 1}. ${item}`)
  .collect();
// ["1. a", "2. b", "3. c"]
```

**Key points:**

- `enumerate()` wraps an iterable to add Array-like methods
- `.enum()` is a method that transforms items to `[item, index]` tuples
- This is a two-step process: wrap, then enumerate

## Pattern: Enumerate Without Indices

Use Array methods without adding indices:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const filtered = await enumerate(["a", "b", "c"])
  .filter((item) => item !== "b")
  .map((item) => item.toUpperCase())
  .collect();
// ["A", "C"]
```

**Key points:**

- You don't need to call `.enum()` if you don't need indices
- `enumerate()` just adds Array-like methods to any iterable

## Pattern: Stream Large Files

Process files without loading into memory:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const errorCount = await read("huge-log.txt")
  .lines
  .filter((line) => line.includes("ERROR"))
  .count();
```

**Key points:**

- `read()` returns an Enumerable of bytes
- `.lines` converts to line stream
- Everything streams—no memory spike for large files

## Pattern: Decompress and Process

Handle compressed files:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const lines = await read("data.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .collect();
```

**Key points:**

- `.transform()` applies a TransformStream
- `DecompressionStream` is built into Deno
- Everything streams—no temp files needed

## Pattern: Concurrent Processing

Process items in parallel with concurrency control:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const urls = ["url1", "url2", "url3"];

await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetch(url);
    return { url, status: response.status };
  }, { concurrency: 5 })
  .forEach((result) => console.log(result));
```

**Key points:**

- `.concurrentMap()` processes items in parallel
- `concurrency` option limits how many run at once
- Results maintain input order (use `.concurrentUnorderedMap()` for faster
  unordered results)

## Pattern: Build Objects with Reduce

Aggregate data into a single value:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const wordCount = await run("cat", "data.txt")
  .lines
  .reduce((acc, line) => {
    const words = line.split(/\s+/);
    for (const word of words) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
```

**Key points:**

- `.reduce()` works like Array.reduce()
- Provide an initial value (second argument)
- The accumulator can be any type

## Pattern: Split Stream with Tee

Process the same stream multiple ways:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const [errors, warnings] = run("cat", "app.log")
  .lines
  .tee(2);

const errorCount = errors.filter((line) => line.includes("ERROR")).count();
const warningCount = warnings.filter((line) => line.includes("WARN")).count();

console.log(`Errors: ${await errorCount}, Warnings: ${await warningCount}`);
```

**Key points:**

- `.tee(n)` splits a stream into n identical streams
- Each stream can be processed independently
- All streams must be consumed

## Anti-Pattern: Not Consuming Output

**Don't do this:**

<!-- NOT TESTED: Illustrative example -->

```typescript
const p = run("ls"); // ❌ Output never consumed
```

**Why it's bad:** Unconsumed output keeps the process handle open, causing
resource leaks.

**Do this instead:**

<!-- NOT TESTED: Illustrative example -->

```typescript
await run("ls").lines.collect(); // ✅ Output consumed
```

## Anti-Pattern: Mixing Sync and Async

**Don't do this:**

<!-- NOT TESTED: Illustrative example -->

```typescript
const lines = run("ls").lines; // ❌ Not awaited
lines.forEach((line) => console.log(line)); // ❌ Won't work
```

**Why it's bad:** `.lines` returns an Enumerable, but you need to await the
terminal operation.

**Do this instead:**

<!-- NOT TESTED: Illustrative example -->

```typescript
await run("ls").lines.forEach((line) => console.log(line)); // ✅ Awaited
```
