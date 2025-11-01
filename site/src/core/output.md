# Working with Output

Capture, transform, and process command output.

## Choosing Your Approach

**Use `.lines.collect()`** when you need all output as an array (small outputs only):
<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await run("ls").lines.collect();  // All lines in memory
```

**Use `.lines` with for-await** when processing large outputs line-by-line:
<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const line of run("cat", "huge.log").lines) {
  process(line);  // Constant memory usage
}
```

**Use `.toStdout()`** when you just want to see the output:
<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls", "-la").toStdout();  // Prints directly to console
```

**Use `.first` or `.last`** when you only need one line:
<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await run("git", "rev-parse", "HEAD").lines.first;
```

## Getting Output

### As Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const lines = await run("ls", "-la").lines.collect();
// string[]
```

### As Bytes

<!-- NOT TESTED: Illustrative example -->
```typescript
const bytes = await run("cat", "file.bin").collect();
// Uint8Array[]
```

### First Line

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await run("git", "rev-parse", "HEAD").lines.first;
// Single string
```

### Print to Console

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls", "-la").toStdout();
```

## Transforming Output

### Map Lines

<!-- TESTED: tests/mdbook_examples.test.ts - "output: map lines" -->
```typescript
const uppercase = await run("cat", "file.txt")
  .lines
  .map(line => line.toUpperCase())
  .collect();
```

### Filter Lines

<!-- TESTED: tests/mdbook_examples.test.ts - "output: filter lines" -->
```typescript
const errors = await run("cat", "app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .collect();
```

### Parse Output

<!-- NOT TESTED: Illustrative example -->
```typescript
const commits = await run("git", "log", "--oneline")
  .lines
  .map(line => {
    const [hash, ...message] = line.split(" ");
    return { hash, message: message.join(" ") };
  })
  .collect();
```

## Streaming Output

Process output as it arrives:

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const line of run("tail", "-f", "app.log").lines) {
  if (line.includes("ERROR")) {
    console.error(line);
  }
}
```

## Counting Output

<!-- NOT TESTED: Illustrative example -->
```typescript
const lineCount = await run("ls", "-la").lines.count();
```

## Finding in Output

<!-- NOT TESTED: Illustrative example -->
```typescript
const match = await run("ps", "aux")
  .lines
  .find(line => line.includes("node"));
```

## Real-World Examples

### Parse JSON Output

<!-- NOT TESTED: Illustrative example -->
```typescript
const data = await run("curl", "https://api.example.com/data")
  .lines
  .map(line => JSON.parse(line))
  .collect();
```

### Extract Fields

<!-- NOT TESTED: Illustrative example -->
```typescript
const pids = await run("ps", "aux")
  .lines
  .drop(1)  // Skip header
  .map(line => line.split(/\s+/)[1])
  .collect();
```

### Aggregate Data

<!-- NOT TESTED: Illustrative example -->
```typescript
const total = await run("du", "-sh", "*")
  .lines
  .map(line => {
    const size = line.split("\t")[0];
    return parseInt(size);
  })
  .reduce((sum, size) => sum + size, 0);
```

## Next Steps

- [Process Pipelines](./pipelines.md) - Chain commands
- [Running Processes](./running-processes.md) - More ways to run
- [Array-Like Methods](../iterables/array-methods.md) - Transform output
