# Decompressing Files

Process compressed files without creating temporary files. Stream everything.

## Decompress and Count Lines

<!-- TESTED: tests/mdbook_examples.test.ts - "decompression: decompress and count" -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const lineCount = await read("war-and-peace.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count();

console.log(`${lineCount} lines`);
```

**What's happening:**
- `read()` opens the file as a stream of bytes
- `.transform()` pipes through the decompression stream
- `.lines` converts bytes to text lines
- `.count()` counts them

All streaming. No temp files. Constant memory usage.

## Search in Compressed File

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const matches = await read("logs.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .filter(line => line.includes("ERROR"))
  .collect();

console.log(`Found ${matches.length} errors`);
```

## Process Multiple Compressed Files

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read, enumerate } from "jsr:@j50n/proc@{{gitv}}";

const files = ["log1.gz", "log2.gz", "log3.gz"];

for (const file of files) {
  const errors = await read(file)
    .transform(new DecompressionStream("gzip"))
    .lines
    .filter(line => line.includes("ERROR"))
    .count();
  
  console.log(`${file}: ${errors} errors`);
}
```

## Decompress and Transform

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const data = await read("data.json.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .map(line => JSON.parse(line))
  .filter(obj => obj.status === "active")
  .collect();
```

## Supported Formats

The Web Streams API supports:

- **gzip** - `.gz` files
- **deflate** - `.zip` files (deflate compression)
- **deflate-raw** - Raw deflate

<!-- NOT TESTED: Illustrative example -->
```typescript
// Gzip
.transform(new DecompressionStream("gzip"))

// Deflate
.transform(new DecompressionStream("deflate"))

// Deflate-raw
.transform(new DecompressionStream("deflate-raw"))
```

## Compress Output

You can also compress:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const compressed = await read("large-file.txt")
  .transform(new CompressionStream("gzip"))
  .collect();

await Deno.writeFile("large-file.txt.gz", concat(compressed));
```

## Real-World Example: Log Analysis

Analyze compressed logs without extracting them:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

const errors = await read("app.log.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .map(line => {
    const [timestamp, level, ...message] = line.split(" ");
    return { timestamp, level, message: message.join(" ") };
  })
  .filter(entry => entry.level === "ERROR")
  .collect();

console.log(`Found ${errors.length} errors`);
errors.slice(0, 10).forEach(e => {
  console.log(`${e.timestamp}: ${e.message}`);
});
```

## Performance Tips

### Stream, Don't Collect

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Loads entire file into memory
const lines = await read("huge.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .collect();

// ✅ Processes one line at a time
for await (const line of read("huge.gz")
  .transform(new DecompressionStream("gzip"))
  .lines) {
  process(line);
}
```

### Use Concurrent Processing

Process multiple files in parallel:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const files = ["log1.gz", "log2.gz", "log3.gz"];

const results = await enumerate(files)
  .concurrentMap(async (file) => {
    const errors = await read(file)
      .transform(new DecompressionStream("gzip"))
      .lines
      .filter(line => line.includes("ERROR"))
      .count();
    return { file, errors };
  }, { concurrency: 3 })
  .collect();
```

## Why This Is Better

**Traditional approach:**
```bash
# Extract first
gunzip file.gz
# Then process
grep ERROR file
# Clean up
rm file
```

**proc approach:**
<!-- NOT TESTED: Illustrative example -->
```typescript
// One step, no temp files
await read("file.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .filter(line => line.includes("ERROR"))
  .forEach(console.log);
```

Faster, cleaner, more memory-efficient.

## Next Steps

- [Streaming Large Files](../advanced/streaming.md) - Handle huge files
- [Concurrent Processing](../advanced/concurrent.md) - Process multiple files in parallel
- [File I/O](../utilities/file-io.md) - More file operations
