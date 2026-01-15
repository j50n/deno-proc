# Compressing and Decompressing Data

Stream data through compression without temporary files. Works with any data transform pipeline.

## Three Approaches

You have three ways to compress/decompress:

1. **CompressionStream/DecompressionStream** — Web standard, built-in, good performance
2. **gzip/gunzip** — Unix tools, widely available
3. **pigz/unpigz** — Parallel gzip, fastest (if installed)

All work the same way: pass them to `.transform()` and proc handles the streaming.

## Using CompressionStream (Recommended)

Built into Deno, no external dependencies:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

// Compress
await read("data.csv")
  .transform(new CompressionStream("gzip"))
  .writeTo("data.csv.gz");

// Decompress
await read("data.csv.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .forEach(line => console.log(line));
```

**Supported formats:** `"gzip"`, `"deflate"`, `"deflate-raw"`

## Using gzip/gunzip

Standard Unix tools, available everywhere:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

// Compress
await read("data.csv")
  .run("gzip")
  .writeTo("data.csv.gz");

// Decompress
await read("data.csv.gz")
  .run("gunzip")
  .lines
  .forEach(line => console.log(line));
```

## Using pigz/unpigz (Fastest)

Parallel gzip for multi-core systems. Install with `apt install pigz` or `brew install pigz`:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

// Compress (uses all CPU cores)
await read("large-file.csv")
  .run("pigz")
  .writeTo("large-file.csv.gz");

// Decompress (parallel)
await read("large-file.csv.gz")
  .run("unpigz")
  .lines
  .count();
```

**Performance:** pigz is typically 3-4x faster than gzip on multi-core systems.

## Compress During Transform

Combine data transforms with compression:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

// CSV → filter → TSV → compress
await read("sales.csv")
  .transform(fromCsvToRows())
  .filter(row => parseFloat(row[3]) > 1000)
  .transform(toTsv())
  .transform(new CompressionStream("gzip"))
  .writeTo("high-value.tsv.gz");
```

## Decompress and Process

Read compressed data directly:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

const total = await read("sales.csv.gz")
  .transform(new DecompressionStream("gzip"))
  .transform(fromCsvToRows())
  .map(row => parseFloat(row[3]))
  .reduce((sum, val) => sum + val, 0);

console.log(`Total: $${total.toFixed(2)}`);
```

## Multiple Compression Formats

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

// bzip2
await read("data.txt")
  .run("bzip2")
  .writeTo("data.txt.bz2");

// xz
await read("data.txt")
  .run("xz")
  .writeTo("data.txt.xz");

// zstd (if installed)
await read("data.txt")
  .run("zstd")
  .writeTo("data.txt.zst");
```

## Compression Level Control

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

// gzip: -1 (fast) to -9 (best compression)
await read("data.csv")
  .run("gzip", "-9")  // Maximum compression
  .writeTo("data.csv.gz");

// pigz with compression level
await read("data.csv")
  .run("pigz", "-9")
  .writeTo("data.csv.gz");
```

## When to Use Each

| Method              | Use When                                    |
|---------------------|---------------------------------------------|
| **CompressionStream** | No external dependencies, good enough     |
| **gzip/gunzip**     | Need specific gzip options, compatibility   |
| **pigz/unpigz**     | Large files, multi-core system, need speed  |

## What Doesn't Work

**Archive formats don't stream the same way:**

```typescript
// ❌ These don't work for streaming compression
.run("zip")   // Creates archives, not streaming compression
.run("tar")   // Creates archives, not streaming compression

// ✅ Use these for streaming compression
.run("gzip")
.run("bzip2")
.run("xz")
```

## Performance Comparison

Compressing a 100MB CSV file:

- **pigz**: ~2-3 seconds (multi-core)
- **gzip**: ~8-10 seconds (single-core)
- **CompressionStream**: ~10-12 seconds (single-core)

For most use cases, CompressionStream is fine. Use pigz for large files or batch processing.

## Real-World Example

Process logs, filter errors, compress output:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

await read("app.log")
  .lines
  .filter(line => line.includes("ERROR") || line.includes("FATAL"))
  .map(line => `${new Date().toISOString()} ${line}`)
  .transform(new CompressionStream("gzip"))
  .writeTo("errors.log.gz");
```
