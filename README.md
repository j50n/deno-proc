# proc

**Unlock Deno's secret AsyncIterable superpowers!**

A simpler, saner alternative to JavaScript streams. Built on async iterables—a
more standard JavaScript primitive—proc eliminates backpressure problems,
produces cleaner code, and is easier to work with. Run processes, transform data
between formats, and use Array methods on async iterables.

📚 **[Full Documentation](https://j50n.github.io/deno-proc/)** | 🚀
**[Quick Start](https://j50n.github.io/deno-proc/getting-started/quick-start.html)**
| 📊
**[Performance Guide](https://j50n.github.io/deno-proc/data-transforms/performance.html)**

```typescript
import { enumerate, read, run } from "jsr:@j50n/proc";
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc/transforms";

// Run processes and capture output
const lines = await run("ls", "-la").lines.collect();

// Chain processes like a shell pipeline
const result = await run("cat", "data.txt")
  .run("grep", "error")
  .run("wc", "-l")
  .lines.first;

// Transform data between formats
await read("sales.csv")
  .transform(fromCsvToRows())
  .filter((row) => parseFloat(row[3]) > 1000)
  .transform(toTsv())
  .writeTo("high-value.tsv");

// Work with async iterables using familiar Array methods
const commits = await run("git", "log", "--oneline")
  .lines
  .map((line) => line.trim())
  .filter((line) => line.includes("fix"))
  .take(5)
  .collect();

// Errors propagate naturally - handle once at the end
try {
  await run("npm", "test")
    .lines
    .filter((line) => line.includes("FAIL"))
    .toStdout();
} catch (error) {
  console.error(`Tests failed: ${error.code}`);
}
```

## Why proc?

**Simpler than streams** — AsyncIterables are a standard JavaScript primitive
(more standard than streams). Pull-based iteration is easier to reason about
than push-based streams. No complex coordination, no buffering logic, no
backpressure headaches.

**Backpressure solved** — Traditional streams require careful coordination
between producers and consumers. Async iterators eliminate this entirely—the
consumer pulls when ready. No memory pressure, no dropped data, no complexity.

**Cleaner, more intuitive code** — Use `map`, `filter`, `reduce`, `flatMap`,
`take`, `drop` and more—just like Arrays. Errors propagate naturally through
pipelines. One try-catch at the end handles everything.

**WASM-powered data transforms** — Convert between CSV, TSV, JSON, and Record
formats with WebAssembly-accelerated parsing. For maximum throughput, use the
flatdata CLI for multi-process streaming.

**Powerful process management** — Run commands, pipe between processes, capture
output, and control execution with a clean, composable API. Shell-like pipelines
with proper error handling.

**Type-safe and ergonomic** — Full TypeScript support with intuitive APIs that
guide you toward correct usage.

## Features at a Glance

### 🚀 Process Management

- **Run commands** — `run()`, `pipe()`, `result()`, `toStdout()`
- **Chain processes** — Shell-like pipelines with `.run()`
- **Capture output** — Lines, bytes, or full output
- **Error handling** — Natural propagation through pipelines

### 🔄 Async Iterables

- **Array-like methods** — `map`, `filter`, `reduce`, `flatMap`, `forEach`,
  `some`, `every`, `find`
- **Slicing & sampling** — `take`, `drop`, `slice`, `first`, `last`, `nth`
- **Concurrent operations** — `concurrentMap`, `concurrentUnorderedMap` with
  concurrency control
- **Utilities** — `enumerate`, `zip`, `range`, `cache()`

### 📊 Data Transforms

- **Format conversion** — CSV ↔ TSV ↔ JSON ↔ Record
- **Streaming processing** — Constant memory usage for any file size
- **LazyRow optimization** — Faster parsing with binary backing
- **flatdata CLI** — WASM-powered tool for multi-process streaming

## Installation

```typescript
import * as proc from "jsr:@j50n/proc";
```

Or import specific functions:

```typescript
import { enumerate, read, run } from "jsr:@j50n/proc";
```

### Data Transforms (Optional)

Data transforms are in a separate module to keep the core library lightweight:

> ⚠️ **Experimental (v0.24.0+)**: Data transforms are under active development.
> API may change as we improve correctness and streaming performance.

```typescript
// Core library - process management and async iterables
import { enumerate, read, run } from "jsr:@j50n/proc";

// Data transforms - CSV, TSV, JSON, Record conversions
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc/transforms";
```

See the
[Data Transforms Guide](https://j50n.github.io/deno-proc/data-transforms/) for
details.

## Key Concepts

**Properties vs Methods**: Some APIs are properties (`.lines`, `.status`,
`.first`) and some are methods (`.collect()`, `.map()`, `.filter()`). Properties
don't use parentheses.

**Resource Management**: Always consume process output via `.lines.collect()`,
`.lines.forEach()`, or similar. Unconsumed output causes resource leaks.

**Error Handling**: Processes that exit with non-zero codes throw
`ExitCodeError` when you consume their output. Use try-catch to handle failures.

**Enumeration**: `enumerate()` wraps iterables but doesn't add indices. Call
`.enum()` on the result to get `[item, index]` tuples.

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

### Transform data between formats

```typescript
import { read } from "jsr:@j50n/proc";
import { fromCsvToRows, toJson } from "jsr:@j50n/proc/transforms";

// Convert CSV to JSON Lines with filtering
await read("sales.csv")
  .transform(fromCsvToRows())
  .filter((row) => parseFloat(row[3]) > 1000)
  .map((row) => ({
    id: row[0],
    customer: row[1],
    amount: parseFloat(row[3]),
  }))
  .transform(toJson())
  .writeTo("high-value.jsonl");
```

### Run a command and capture output

```typescript
import { run } from "jsr:@j50n/proc";

const result = await run("git", "rev-parse", "HEAD").lines.first;
console.log(`Current commit: ${result?.trim()}`);
```

### Handle errors gracefully

```typescript
import { run } from "jsr:@j50n/proc";

try {
  // Errors propagate through the entire pipeline
  // No need for error handling at each step
  await run("npm", "test")
    .lines
    .map((line) => line.toUpperCase())
    .filter((line) => line.includes("FAIL"))
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
  .filter((line) => line.includes("ERROR"))
  .reduce((count) => count + 1, 0);

console.log(`Found ${errorCount} errors`);
```

### Parallel processing with concurrency control

```typescript
import { enumerate } from "jsr:@j50n/proc";

const urls = ["url1", "url2", "url3" /* ... */];

await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetch(url);
    return { url, status: response.status };
  }, { concurrency: 5 })
  .forEach((result) => console.log(result));
```

## Features

- **Process execution** — `run()`, `pipe()`, `result()`, `toStdout()`
- **Array-like methods** — `map`, `filter`, `reduce`, `flatMap`, `forEach`,
  `some`, `every`, `find`
- **Slicing & sampling** — `take`, `drop`, `slice`, `first`, `last`, `nth`
- **Concurrent operations** — `concurrentMap`, `concurrentUnorderedMap` with
  concurrency control
- **Data transforms** — CSV, TSV, JSON, Record format conversions with streaming
- **Utilities** — `enumerate`, `zip`, `range`, `read` (for files)
- **Caching** — `cache()` to replay iterables
- **Writable iterables** — Push values into async iterables programmatically

## Documentation

- **[Getting Started](https://j50n.github.io/deno-proc/getting-started/quick-start.html)**
  — Your first proc script in 5 minutes
- **[Process Management](https://j50n.github.io/deno-proc/core/running-processes.html)**
  — Run commands, chain pipelines, handle errors
- **[Async Iterables](https://j50n.github.io/deno-proc/iterables/array-methods.html)**
  — Array-like methods for streaming data
- **[Data Transforms](https://j50n.github.io/deno-proc/data-transforms/)** —
  CSV, TSV, JSON, Record conversions
- **[Performance Guide](https://j50n.github.io/deno-proc/data-transforms/performance.html)**
  — Benchmarks and optimization tips
- **[Recipes](https://j50n.github.io/deno-proc/recipes/counting-words.html)** —
  Copy-paste solutions for common tasks
- **[API Reference](https://j50n.github.io/deno-proc/api-reference.html)** —
  Complete API documentation

## Contributing

Contributions are welcome! See the
[contributor guide](https://j50n.github.io/deno-proc/contributor/) for details
on:

- Project architecture
- Coding standards
- Testing strategy
- Documentation guidelines

## License

MIT

## Building Documentation

The WASM book (`labs/wasm/docs/`) generates HTML, EPUB, and PDF outputs.

### Prerequisites (Debian/Ubuntu)

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# mdbook
cargo install mdbook

# Document generation tools
sudo apt install pandoc weasyprint ghostscript imagemagick

# WebAssembly Binary Toolkit (for WASM verification)
sudo apt install wabt
```

### Build

```bash
./build-site.sh
```

Outputs:

- `labs/wasm/docs/book/` — HTML
- `labs/wasm/docs/book/book.epub` — EPUB with cover
- `labs/wasm/docs/book/book.pdf` — PDF with cover
