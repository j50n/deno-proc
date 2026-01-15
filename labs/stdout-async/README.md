# Async Stdout Performance Experiment

Determine if synchronous stdout writes are a performance bottleneck and explore async alternatives.

## Problem

Current `toStdout()` uses synchronous writes to prevent console.log interference. This may be causing significant throughput limitations.

## Goal

Measure the performance impact and implement an async version that trades console.log safety for speed.

## Quick Test

```bash
# Benchmark current sync version
deno run benchmark.ts sync > /dev/null

# Benchmark async versions
deno run benchmark.ts async-simple > /dev/null
deno run benchmark.ts async-buffered > /dev/null
```

## Three Approaches

1. **Simple async** - Just use `await Deno.stdout.write()`
2. **Buffered async** - Use WritableStream API (like `writeTo()`)
3. **Queued writes** - Fire-and-forget with queue depth limit

## Expected Result

If async is significantly faster (>2x), it becomes the default with documentation about console.log trade-offs.

## Why This Matters

This is a **prerequisite** for `labs/tsv-record-perf/`. If stdout is the bottleneck, WASM performance measurements will be misleading.

See [SPEC.md](SPEC.md) for complete details.
