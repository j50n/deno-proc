# Welcome to proc

Running child processes and working with streams should be simple. **proc**
makes it simple.

> **✨ The Big Idea**: Treat processes and streams like arrays. Use `map`,
> `filter`, `reduce` on anything. Errors flow naturally through pipelines. No
> callbacks, no edge cases, no headaches.

## What is proc?

proc is a Deno library that gives you two superpowers:

1. **Run child processes** with a clean, composable API
2. **Work with async iterables** using the Array methods you already know

But here's the real magic: **errors just work**. They flow through your
pipelines naturally, like data. No edge cases, no separate error channels, no
callbacks. One try-catch at the end handles everything.

> **💡 Tip**: If you've ever struggled with JavaScript streams, you're going to
> love this.

> **🚀 Need speed?** Check out [flatdata](./utilities/flatdata.md)—a
> WASM-powered CLI for CSV/TSV processing at ~330 MB/s (7x faster than pure JS).

## A Taste of proc

Count lines in a compressed file—streaming, no temp files:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const lines = await read("war-and-peace.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count();

console.log(`${lines} lines`); // 23,166 lines
```

Build custom transformations with readable async generators:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

// Parse and validate JSON lines
async function* parseJsonLines(lines) {
  for await (const line of lines) {
    try {
      const obj = JSON.parse(line.trim());
      if (obj.id && obj.timestamp) yield obj;
    } catch {
      // Skip invalid JSON
    }
  }
}

const validEntries = await enumerate(logLines)
  .transform(parseJsonLines)
  .collect();
```

Chain processes like shell pipes:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const result = await run("cat", "data.txt")
  .run("grep", "error")
  .run("wc", "-l")
  .lines.first;
```

Handle errors gracefully:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("npm", "test")
    .lines
    .map((line) => line.toUpperCase())
    .filter((line) => line.includes("FAIL"))
    .forEach((line) => console.log(line));
} catch (error) {
  // All errors caught here—from the process, from map, from filter
  console.error(`Tests failed: ${error.code}`);
}
```

## Why proc?

JavaScript streaming is powerful, but traditional approaches create unnecessary
complexity. proc eliminates the two biggest pain points: backpressure
coordination and error handling. By using async iterators (pull-based) instead
of streams (push-based), backpressure disappears entirely and errors propagate
naturally through pipelines.

## High-Performance Data Processing

proc includes **flatdata**, a WASM-powered CLI for converting between CSV, TSV,
and binary record formats. By offloading CSV parsing to a subprocess, your main
application stays responsive while processing data at ~330 MB/s—about 7x faster
than pure JavaScript.

```bash
# Install flatdata globally
deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc/flatdata

# Use in pipelines
cat huge.csv | flatdata csv2record | ./your-processor | flatdata record2csv
```

See the [flatdata documentation](./utilities/flatdata.md) for details.

This design gives you:

- **Errors that propagate naturally** through pipelines
- **Array methods on async iterables** (map, filter, reduce, and more)
- **Custom transformations with async generators** (easier than streams API)
- **Process management** that feels like shell scripting
- **Streaming everything** for memory efficiency
- **Type safety** with full TypeScript support

## Who is this for?

- **DevOps engineers** automating deployments, processing logs, and managing
  infrastructure
- **Data engineers** processing large CSV files, log files, or streaming data
- **Backend developers** building CLI tools, batch processors, or data pipelines
- **System administrators** replacing Bash scripts with type-safe, testable Deno
  code
- **Anyone** who needs to run child processes or work with large datasets
  efficiently

## Ready to dive in?

Start with [Installation](./getting-started/installation.md) or jump straight to
the [Quick Start](./getting-started/quick-start.md).

---

**Current Version:** {{gitv}}\
**Status:** Stable, actively maintained, ready for production

Found a bug? Have a question?
[File an issue](https://github.com/j50n/deno-proc/issues) or check the
[FAQ](./faq.md).
