# Troubleshooting

Common issues and their solutions.

## Process Issues

### My process hangs

**Cause**: Output not consumed. proc waits for you to read the output before the
process completes.

```typescript
// ❌ Hangs - output never consumed
const p = run("ls");
await p.status;

// ✅ Works - consume output first
const p = run("ls");
await p.lines.collect();
await p.status;
```

### "Resource leak" errors

**Cause**: Process output not consumed. Every process must have its output read.

```typescript
// ❌ Resource leak
run("ls"); // Output ignored

// ✅ Consume the output
await run("ls").lines.collect();

// ✅ Or iterate through it
await run("ls").lines.forEach(console.log);
```

### Process exits with unexpected code

**Cause**: The command failed. Check the error for details.

```typescript
import { ExitCodeError } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("grep", "pattern", "missing-file.txt").lines.collect();
} catch (error) {
  if (error instanceof ExitCodeError) {
    console.error(`Exit code: ${error.code}`);
    console.error(`Command: ${error.command.join(" ")}`);
  }
}
```

### Permission denied

**Cause**: Missing Deno permissions.

```bash
# Grant necessary permissions
deno run --allow-run --allow-read --allow-write script.ts
```

## Type Errors

### "Property 'lines' does not exist"

**Cause**: Using `.lines()` instead of `.lines` (it's a property, not a method).

```typescript
// ❌ Wrong
run("ls").lines().collect();

// ✅ Correct
run("ls").lines.collect();
```

Same applies to `.status`, `.first`, `.last`.

### DecompressionStream type error

**Cause**: TypeScript doesn't recognize the stream type.

```typescript
// Add type assertion
.transform(new DecompressionStream("gzip") as TransformStream<Uint8Array, Uint8Array>)
```

### "Cannot find module" for transforms

**Cause**: Data transforms are a separate import.

```typescript
// ❌ Wrong - transforms not in main module
import { fromCsvToRows } from "jsr:@j50n/proc@{{gitv}}";

// ✅ Correct - use /transforms subpath
import { fromCsvToRows } from "jsr:@j50n/proc/transforms";
```

## Async Issues

### Results are undefined or empty

**Cause**: Not awaiting async operations.

```typescript
// ❌ Wrong - not awaited
const lines = run("ls").lines.collect();
console.log(lines); // Promise, not array

// ✅ Correct - await the result
const lines = await run("ls").lines.collect();
console.log(lines); // string[]
```

### forEach doesn't seem to run

**Cause**: `forEach` returns a Promise that must be awaited.

```typescript
// ❌ Wrong - not awaited
run("ls").lines.forEach(console.log);

// ✅ Correct
await run("ls").lines.forEach(console.log);
```

## Data Transform Issues

### CSV parsing produces wrong columns

**Cause**: Delimiter mismatch or quoting issues.

```typescript
// Check your delimiter
fromCsvToRows(); // Comma-delimited
fromTsvToRows(); // Tab-delimited
fromCsvToRows({ delimiter: ";" }); // Custom delimiter
```

### Large file causes memory issues

**Cause**: Using `.collect()` on huge datasets loads everything into memory.

```typescript
// ❌ Loads entire file into memory
const allRows = await read("huge.csv")
  .transform(fromCsvToRows())
  .collect();

// ✅ Stream and process one at a time
await read("huge.csv")
  .transform(fromCsvToRows())
  .forEach((row) => processRow(row));
```

### flatdata command not found

**Cause**: flatdata CLI not installed globally.

```bash
deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc@{{gitv}}/flatdata
```

## Performance Issues

### Processing is slower than expected

**Possible causes**:

1. **Using CSV when TSV would work** — TSV is 3-5x faster than CSV
2. **Not using LazyRow** — Enable with `fromCsvToRows({ lazy: true })`
3. **Sequential when parallel would help** — Use `concurrentMap` for I/O-bound
   work

```typescript
// Faster: use concurrentMap for network requests
await enumerate(urls)
  .concurrentMap(fetch, { concurrency: 10 })
  .collect();
```

### Memory usage grows over time

**Cause**: Caching or collecting when streaming would work.

```typescript
// ❌ Caches everything
const cached = enumerate(hugeDataset).cache();

// ✅ Stream through without caching
await enumerate(hugeDataset)
  .filter(predicate)
  .forEach(process);
```

## Still Stuck?

1. Check the [FAQ](./faq.md) for common questions
2. Search [existing issues](https://github.com/j50n/deno-proc/issues)
3. [Open a new issue](https://github.com/j50n/deno-proc/issues/new) with:
   - proc version
   - Deno version
   - Minimal reproduction code
   - Expected vs actual behavior
