# Architecture

## Core Modules

- **src/run.ts** - Main entry point, `run()` function
- **src/process.ts** - Process wrapper class
- **src/enumerable.ts** - Enumerable class with AsyncIterable operations
- **src/transformers.ts** - Data transformation functions (toBytes, JSON, gzip)
- **src/utility.ts** - Helper functions (range, concat, read, etc.)
- **src/concurrent.ts** - Concurrent mapping operations
- **src/writable-iterable.ts** - WritableIterable for push-based iteration
- **src/cache.ts** - KV-based caching utilities
- **src/helpers.ts** - Internal helper functions

## Key Concepts

**Enumerable:** Wrapper around AsyncIterable providing composable operations

- Created via `enumerate()` factory function
- Supports map, filter, reduce, take, drop, concat, etc.
- Integrates with process I/O via `.run()` and `.lines`

**ProcessEnumerable:** Extends Enumerable for process output

- Returned by `run()` function
- Provides access to process PID and status
- Automatically handles resource cleanup

**Transformers:** Functions that convert between data types

- `toBytes()` - Convert strings/arrays to Uint8Array
- `toLines()` - Convert bytes to text lines
- `jsonStringify()` / `jsonParse()` - JSON serialization
- `gzip()` / `gunzip()` - Compression
