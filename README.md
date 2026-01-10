# proc

Run child processes and work with async iterables in Deno—with the fluent Array API you already know.

📚 **[Full Documentation](https://j50n.github.io/deno-proc/)**

```typescript
import * as proc from "jsr:@j50n/proc";

// Run processes and capture output
const lines = await proc.run("ls", "-la").lines.collect();

// Chain processes like a shell pipeline
const result = await proc.run("cat", "data.txt")
  .run("grep", "error")
  .run("wc", "-l")
  .lines.first;

// Work with async iterables using familiar Array methods
const commits = await proc.run("git", "log", "--oneline")
  .lines
  .map(line => line.trim())
  .filter(line => line.includes("fix"))
  .take(5)
  .collect();

// Errors propagate naturally - handle once at the end
try {
  await proc.run("npm", "test")
    .lines
    .map(line => line.toUpperCase())
    .filter(line => line.includes("FAIL"))
    .toStdout();
} catch (error) {
  console.error(`Tests failed: ${error.code}`);
}
```

## Why proc?

**Errors that just work** — Errors propagate through pipelines naturally, just like data. No edge cases, no separate error channels, no callbacks. One try-catch at the end handles everything. JavaScript streaming is fast, but error handling shouldn't break your brain.

**Powerful process management** — Run commands, pipe between processes, capture output, and control execution with a clean, composable API.

**Async iterables that feel like Arrays** — Use `map`, `filter`, `reduce`, `flatMap`, `take`, `drop`, and more on any async iterable. No more wrestling with streams.

**Type-safe and ergonomic** — Full TypeScript support with intuitive APIs that guide you toward correct usage.

## Key Concepts

**Properties vs Methods**: Some APIs are properties (`.lines`, `.status`, `.first`) and some are methods (`.collect()`, `.map()`, `.filter()`). Properties don't use parentheses.

**Resource Management**: Always consume process output via `.lines.collect()`, `.lines.forEach()`, or similar. Unconsumed output causes resource leaks.

**Error Handling**: Processes that exit with non-zero codes throw `ExitCodeError` when you consume their output. Use try-catch to handle failures.

**Enumeration**: `enumerate()` wraps iterables but doesn't add indices. Call `.enum()` on the result to get `[item, index]` tuples.

## Quick Examples

### Stream and process large compressed files

```typescript
import { read } from "jsr:@j50n/proc";

// Read, decompress, and count lines - all streaming, no temp files!
const lineCount = await read("war-and-peace.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count();

console.log(`${lineCount} lines`); // 23,166 lines
```

### Run a command and capture output

```typescript
const result = await proc.run("git", "rev-parse", "HEAD").lines.first;
console.log(`Current commit: ${result?.trim()}`);
```

### Handle errors gracefully

```typescript
try {
  // Errors propagate through the entire pipeline
  // No need for error handling at each step
  await proc.run("npm", "test")
    .lines
    .map(line => line.toUpperCase())
    .filter(line => line.includes("FAIL"))
    .toStdout();
} catch (error) {
  // Handle all errors in one place
  if (error.code) {
    console.error(`Tests failed with code ${error.code}`);
  }
}
```

### Transform async iterables

```typescript
import { enumerate } from "jsr:@j50n/proc";

const data = ["apple", "banana", "cherry"];

const numbered = await enumerate(data)
  .enum()
  .map(([fruit, i]) => `${i + 1}. ${fruit}`)
  .collect();

console.log(numbered); // ["1. apple", "2. banana", "3. cherry"]
```

### Process large files efficiently

```typescript
import { read } from "jsr:@j50n/proc";

const errorCount = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .reduce((count) => count + 1, 0);

console.log(`Found ${errorCount} errors`);
```

### Parallel processing with concurrency control

```typescript
import { enumerate } from "jsr:@j50n/proc";

const urls = ["url1", "url2", "url3", /* ... */];

await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetch(url);
    return { url, status: response.status };
  }, { concurrency: 5 })
  .forEach(result => console.log(result));
```

## Features

- **Process execution** — `run()`, `pipe()`, `result()`, `toStdout()`
- **Array-like methods** — `map`, `filter`, `reduce`, `flatMap`, `forEach`, `some`, `every`, `find`
- **Slicing & sampling** — `take`, `drop`, `slice`, `first`, `last`, `nth`
- **Concurrent operations** — `concurrentMap`, `concurrentUnorderedMap` with concurrency control
- **Utilities** — `enumerate`, `zip`, `range`, `read` (for files)
- **Caching** — `cache()` to replay iterables
- **Writable iterables** — Push values into async iterables programmatically

## Installation

```typescript
import * as proc from "jsr:@j50n/proc";
```

Or import specific functions:

```typescript
import { run, enumerate, read } from "jsr:@j50n/proc";
```

## License

MIT

## Building Documentation

The WASM book (`wasm/docs/`) generates HTML, EPUB, and PDF outputs.

### Prerequisites (Debian/Ubuntu)

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# mdbook
cargo install mdbook

# Document generation tools
sudo apt install pandoc weasyprint ghostscript imagemagick
```

### Build

```bash
./build-site.sh
```

Outputs:
- `wasm/docs/book/` — HTML
- `wasm/docs/book/book.epub` — EPUB with cover
- `wasm/docs/book/book.pdf` — PDF with cover
