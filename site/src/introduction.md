# Welcome to proc

## The Problem

JavaScript streams are push-based. Producers push data whether consumers are
ready or not. This creates backpressure—complex coordination between producers
and consumers to prevent memory exhaustion. And when something goes wrong? You
need error handlers on every stream in the chain.

```typescript
// Traditional streams: backpressure + error handling at every step
stream1.on("error", handleError);
stream2.on("error", handleError);
stream3.on("error", handleError);
// Plus drain events, pause/resume, pipe coordination...
```

## The Solution

proc uses async iterators instead of streams. Consumers pull data when ready. No
backpressure. No coordination. And errors flow through pipelines naturally—one
try-catch handles everything.

```typescript
// proc: no backpressure, errors just work
try {
  await run("cat", "data.txt")
    .run("grep", "error")
    .run("wc", "-l")
    .lines
    .forEach(console.log);
} catch (error) {
  // All errors caught here
}
```

## Who This Book Is For

This documentation is for developers who:

- Run child processes and want better error handling than `Deno.Command`
  provides
- Process streaming data (logs, CSV files, API responses) without loading
  everything into memory
- Want Array-like methods (`map`, `filter`, `reduce`) for async data
- Are replacing shell scripts with type-safe, testable code

You should be comfortable with TypeScript basics and async/await. No prior
experience with Deno streams or child processes required.

## What You'll Learn

**Running Processes** — Execute commands, chain them like shell pipes, capture
output, handle errors gracefully.

**Async Iterables** — Use `map`, `filter`, `reduce`, and more on any async data
source. Process gigabyte files with constant memory.

**Data Transforms** — Convert between CSV, TSV, JSON, and Record formats with
streaming support. Or use the WASM-powered flatdata CLI for maximum throughput.

## A Taste of proc

Count lines in a compressed file—streaming, constant memory:

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const count = await read("logs.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count();
```

Chain processes like shell pipes:

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const errors = await run("cat", "app.log")
  .run("grep", "ERROR")
  .run("wc", "-l")
  .lines.first;
```

Transform async data with familiar methods:

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const results = await enumerate(urls)
  .concurrentMap(fetch, { concurrency: 5 })
  .filter((r) => r.ok)
  .map((r) => r.json())
  .collect();
```

## Quick Decision Guide

**Need to run shell commands?** →
[Running Processes](./core/running-processes.md)

**Processing files line by line?** → [File I/O](./utilities/file-io.md)

**Converting CSV/TSV/JSON?** → [Data Transforms](./data-transforms/README.md)

**Need maximum throughput?** → [flatdata CLI](./utilities/flatdata.md)

**Working with any async data?** →
[Understanding Enumerable](./iterables/enumerable.md)

## Getting Started

1. [Installation](./getting-started/installation.md) — Add proc to your project
2. [Quick Start](./getting-started/quick-start.md) — Your first proc script in 5
   minutes
3. [Key Concepts](./getting-started/key-concepts.md) — Essential patterns to
   understand

---

**Version:** {{gitv}} | **License:** MIT | **Status:** Production-ready

[GitHub](https://github.com/j50n/deno-proc) ·
[Issues](https://github.com/j50n/deno-proc/issues) · [FAQ](./faq.md)
