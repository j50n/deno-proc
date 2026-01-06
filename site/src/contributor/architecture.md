# Project Architecture

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

## Design Principles

### Properties vs Methods
- **Properties** (no parentheses): Return new objects or promises
  - Examples: `.lines`, `.status`, `.first`, `.last`
- **Methods** (with parentheses): Functions that take parameters or perform actions
  - Examples: `.collect()`, `.map()`, `.filter()`, `.count()`

### Resource Management
- Always consume process output to avoid resource leaks
- Terminal operations: `.collect()`, `.forEach()`, `.count()`, etc.
- Document resource management requirements clearly

### Error Propagation
- Errors flow through pipelines naturally
- No need for error handling at each step
- One try-catch at the end handles everything
- This is a key differentiator of the library

### Type Safety
- Full TypeScript support required
- Generic types where appropriate: `Enumerable<T>`, `ProcessEnumerable<S>`
- Type inference should work naturally
