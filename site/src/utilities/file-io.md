# File I/O

Read and write files with streaming efficiency.

## Reading Files

### Read as Bytes

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const bytes = await read("file.bin").collect();
// Uint8Array[]
```

### Read as Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await read("file.txt").lines.collect();
// string[]
```

### Stream Large Files

Process files larger than memory:

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const line of read("huge-file.txt").lines) {
  process(line);  // One line at a time
}
```

## File Paths

### Relative Paths

<!-- NOT TESTED: Illustrative example -->
```typescript
read("data.txt")  // Relative to current directory
```

### Absolute Paths

<!-- NOT TESTED: Illustrative example -->
```typescript
read("/var/log/app.log")
```

### URLs

<!-- NOT TESTED: Illustrative example -->
```typescript
const path = new URL("./data.txt", import.meta.url);
read(path)
```

## Common Patterns

### Count Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
const lineCount = await read("file.txt").lines.count();
```

### Find Pattern

<!-- TESTED: tests/mdbook_examples.test.ts - "file-io: read and filter" -->
```typescript
const matches = await read("file.txt")
  .lines
  .filter(line => line.includes("ERROR"))
  .collect();
```

### Transform Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
const processed = await read("input.txt")
  .lines
  .map(line => line.toUpperCase())
  .collect();
```

### Parse CSV

<!-- NOT TESTED: Illustrative example -->
```typescript
const data = await read("data.csv")
  .lines
  .drop(1)  // Skip header
  .map(line => {
    const [name, age, city] = line.split(",");
    return { name, age: parseInt(age), city };
  })
  .collect();
```

## Writing Files

### Write Array to File

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = ["line 1", "line 2", "line 3"];
const content = lines.join("\n");
await Deno.writeTextFile("output.txt", content);
```

### Stream to File

<!-- NOT TESTED: Illustrative example -->
```typescript
import { concat } from "jsr:@j50n/proc@{{gitv}}";

const bytes = await read("input.txt")
  .lines
  .map(line => new TextEncoder().encode(line + "\n"))
  .collect();

await Deno.writeFile("output.txt", concat(bytes));
```

## Working with Binary Files

### Read Binary

<!-- NOT TESTED: Illustrative example -->
```typescript
const bytes = await read("image.png").collect();
const data = concat(bytes);
```

### Process Binary

<!-- NOT TESTED: Illustrative example -->
```typescript
const processed = await read("data.bin")
  .map(chunk => {
    // Process each chunk
    return transform(chunk);
  })
  .collect();
```

## Compressed Files

### Read Compressed

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await read("file.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .collect();
```

See [Decompressing Files](../recipes/decompression.md) for more.

## Multiple Files

### Process Multiple Files

<!-- NOT TESTED: Illustrative example -->
```typescript
const files = ["log1.txt", "log2.txt", "log3.txt"];

for (const file of files) {
  const errors = await read(file)
    .lines
    .filter(line => line.includes("ERROR"))
    .count();
  console.log(`${file}: ${errors} errors`);
}
```

### Concurrent Processing

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const results = await enumerate(files)
  .concurrentMap(async (file) => {
    const lines = await read(file).lines.count();
    return { file, lines };
  }, { concurrency: 3 })
  .collect();
```

## Error Handling

### File Not Found

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  const lines = await read("missing.txt").lines.collect();
} catch (error) {
  console.error(`Failed to read file: ${error.message}`);
}
```

### Permission Denied

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  const lines = await read("/root/secret.txt").lines.collect();
} catch (error) {
  if (error instanceof Deno.errors.PermissionDenied) {
    console.error("Permission denied");
  }
}
```

## Performance Tips

### Stream Don't Collect

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Loads entire file into memory
const lines = await read("huge.txt").lines.collect();

// ✅ Processes one line at a time
for await (const line of read("huge.txt").lines) {
  process(line);
}
```

### Use Chunked Lines for Performance

For files with many small lines:

<!-- NOT TESTED: Illustrative example -->
```typescript
const chunks = await read("file.txt").chunkedLines.collect();
// Array of string arrays
```

## Real-World Examples

### Log Analysis

<!-- NOT TESTED: Illustrative example -->
```typescript
const errorsByType = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .reduce((acc, line) => {
    const type = line.match(/ERROR: (\w+)/)?.[1] || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
```

### Data Extraction

<!-- NOT TESTED: Illustrative example -->
```typescript
const emails = await read("contacts.txt")
  .lines
  .map(line => line.match(/[\w.-]+@[\w.-]+\.\w+/))
  .filter(match => match !== null)
  .map(match => match[0])
  .collect();
```

### File Conversion

<!-- NOT TESTED: Illustrative example -->
```typescript
const jsonLines = await read("data.csv")
  .lines
  .drop(1)  // Skip header
  .map(line => {
    const [name, age] = line.split(",");
    return JSON.stringify({ name, age: parseInt(age) });
  })
  .collect();

await Deno.writeTextFile("data.jsonl", jsonLines.join("\n"));
```

## Next Steps

- [Decompressing Files](../recipes/decompression.md) - Work with compressed files
- [Streaming Large Files](../advanced/streaming.md) - Handle huge files
- [Log Processing](../recipes/log-processing.md) - Analyze logs
