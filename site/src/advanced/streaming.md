# Streaming Large Files

Process files bigger than your RAM. It's easier than you think.

## When to Stream vs Collect

**Always stream when:**
- File is larger than available RAM (or even close to it)
- You don't need all data at once
- Processing can be done incrementally (line-by-line, record-by-record)
- You want to start processing immediately without waiting for full download/read
- Memory efficiency is important

**Consider collecting when:**
- File is small (< 100MB) and fits comfortably in memory
- You need random access to data
- You need to process data multiple times
- You need to sort or aggregate all data before processing
- Memory is not a concern

**Memory/Speed Tradeoffs:**
- **Streaming**: Constant memory (~64KB buffer), processes as data arrives, can't random access
- **Collecting**: Memory = file size, all data available immediately, can random access, must wait for full load

**Example decision:**
<!-- NOT TESTED: Illustrative example -->
```typescript
// 10GB log file - MUST stream
for await (const line of read("huge.log").lines) {
  if (line.includes("ERROR")) console.log(line);
}

// 1MB config file - can collect
const config = await read("config.json").lines.collect();
const parsed = JSON.parse(config.join("\n"));

// 500MB data file - stream if processing once
const sum = await read("numbers.txt")
  .lines
  .map(line => parseFloat(line))
  .reduce((a, b) => a + b, 0);
```

## The Problem

You have a 10GB log file. Loading it into memory crashes your program:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Crashes with large files
const content = await Deno.readTextFile("huge.log");
const lines = content.split("\n");
```

## The Solution

Stream it, one line at a time:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

// ✅ Constant memory, any file size
for await (const line of read("huge.log").lines) {
  if (line.includes("ERROR")) {
    console.log(line);
  }
}
```

## How Streaming Works

Instead of loading everything:
1. Read a chunk (buffer)
2. Process it
3. Discard it
4. Repeat

Memory usage stays constant, no matter how big the file.

## Real Examples

### Count Lines in Huge File

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await read("10gb-file.txt").lines.count();
console.log(`${count} lines`);
```

Uses ~constant memory, even for 10GB.

### Find Pattern in Large File

<!-- NOT TESTED: Illustrative example -->
```typescript
const matches = await read("huge.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .take(10)  // Stop after 10 matches
  .collect();
```

Stops reading once it finds 10 matches. Efficient!

### Process CSV File

<!-- NOT TESTED: Illustrative example -->
```typescript
const data = await read("huge-data.csv")
  .lines
  .drop(1)  // Skip header
  .map(line => {
    const [id, name, value] = line.split(",");
    return { id, name, value: parseFloat(value) };
  })
  .filter(row => row.value > 100)
  .collect();
```

### Aggregate Large Dataset

<!-- NOT TESTED: Illustrative example -->
```typescript
const sum = await read("numbers.txt")
  .lines
  .map(line => parseFloat(line))
  .reduce((acc, n) => acc + n, 0);
```

## Compressed Files

Stream compressed files without extracting:

<!-- NOT TESTED: Illustrative example -->
```typescript
const lineCount = await read("huge.log.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count();
```

Decompresses on-the-fly, never stores uncompressed data.

## Multiple Files

Process multiple large files:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const files = ["log1.txt", "log2.txt", "log3.txt"];

for (const file of files) {
  const errors = await read(file)
    .lines
    .filter(line => line.includes("ERROR"))
    .count();
  console.log(`${file}: ${errors} errors`);
}
```

## Streaming Transformations

Chain transformations, all streaming:

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await read("data.txt")
  .lines
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .map(line => line.toUpperCase())
  .filter(line => line.startsWith("ERROR"))
  .collect();
```

Each line flows through all transformations before the next line is read.

## Writing Large Files

Stream output to a file:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { concat } from "jsr:@j50n/proc@{{gitv}}";

const processed = await read("input.txt")
  .lines
  .map(line => line.toUpperCase())
  .map(line => new TextEncoder().encode(line + "\n"))
  .collect();

await Deno.writeFile("output.txt", concat(processed));
```

## Performance Tips

### Use take() for Early Exit

<!-- NOT TESTED: Illustrative example -->
```typescript
// Stops reading after 100 matches
const first100 = await read("huge.txt")
  .lines
  .filter(predicate)
  .take(100)
  .collect();
```

### Don't Collect Unless Needed

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Loads everything into memory
const lines = await read("huge.txt").lines.collect();
for (const line of lines) process(line);

// ✅ Streams
for await (const line of read("huge.txt").lines) {
  process(line);
}
```

### Use Concurrent Processing

Process multiple files in parallel:

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await enumerate(files)
  .concurrentMap(async (file) => {
    return await read(file).lines.count();
  }, { concurrency: 3 })
  .collect();
```

## Memory Usage

Streaming uses constant memory:

<!-- NOT TESTED: Illustrative example -->
```typescript
// File size: 10GB
// Memory used: ~64KB (buffer size)
await read("10gb-file.txt")
  .lines
  .forEach(line => process(line));
```

## Real-World Example

Analyze a year of logs:

<!-- NOT TESTED: Illustrative example -->
```typescript
const errorsByDay = await read("year-of-logs.txt")
  .lines
  .filter(line => line.includes("ERROR"))
  .map(line => {
    const date = line.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    return date;
  })
  .filter(date => date !== null)
  .reduce((acc, date) => {
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

// Show top 10 error days
Object.entries(errorsByDay)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([date, count]) => {
    console.log(`${date}: ${count} errors`);
  });
```

Processes gigabytes of logs with minimal memory.

## When to Stream

**Always stream when:**
- File is larger than available RAM
- You don't need all data at once
- Processing can be done incrementally
- You want to start processing immediately

**Consider collecting when:**
- File is small (< 100MB)
- You need random access
- You need to process data multiple times
- Memory is not a concern

## Common Patterns

### Filter and Count

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await read("file.txt")
  .lines
  .filter(predicate)
  .count();
```

### Transform and Save

<!-- NOT TESTED: Illustrative example -->
```typescript
const output = await read("input.txt")
  .lines
  .map(transform)
  .map(line => new TextEncoder().encode(line + "\n"))
  .collect();

await Deno.writeFile("output.txt", concat(output));
```

### Aggregate Data

<!-- NOT TESTED: Illustrative example -->
```typescript
const stats = await read("data.txt")
  .lines
  .reduce((acc, line) => {
    // Update statistics
    return acc;
  }, initialStats);
```

## Next Steps

- [Concurrent Processing](./concurrent.md) - Process multiple files in parallel
- [Performance Optimization](./performance.md) - Make it faster
- [Decompressing Files](../recipes/decompression.md) - Work with compressed files
