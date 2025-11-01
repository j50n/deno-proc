# deno-proc Project Information

## Overview

**Package:** @j50n/proc\
**Registry:** JSR (jsr.io)\
**Version:** 0.22.15\
**License:** MIT\
**Author:** Jason Smith (j50n)\
**Repository:** /home/dev/ws/deno-proc

## Purpose

Deno library for running child processes with a fluent, composable API based on
AsyncIterables.

**Why use this instead of Deno.Command:**

- Composable operations via method chaining
- Automatic resource cleanup (no leaked processes)
- Proper error propagation from stderr
- AsyncIterable streams (easier than manual stream handling)
- No boilerplate code required
- Built-in transformers for common operations
- Type-safe transformations

## Current Status (Updated 2025-11-01)

**Test Coverage:** 127 tests (all passing)
- 39 documentation tests with working examples
- 25 edge case tests (concurrent, enumerable, transformers, writable)
- 17 comprehensive reduce tests matching Array.reduce API
- 46 existing feature tests

**Recent Improvements:**
- ✅ Comprehensive JSDoc documentation with tested examples
- ✅ Fixed Fisher-Yates shuffle bug (was biased)
- ✅ Fixed reduce() empty array with initial value bug
- ✅ Added step=0 validation to range() (prevents infinite loops)
- ✅ Comprehensive edge case test coverage
- ✅ All functions matching JS APIs now behave identically

**Known Issues:** None - all tests passing

## Architecture

### Core Modules

- **src/run.ts** - Main entry point, `run()` function
- **src/process.ts** - Process wrapper class
- **src/enumerable.ts** - Enumerable class with AsyncIterable operations
- **src/transformers.ts** - Data transformation functions (toBytes, JSON, gzip)
- **src/utility.ts** - Helper functions (range, concat, read, etc.)
- **src/concurrent.ts** - Concurrent mapping operations
- **src/writable-iterable.ts** - WritableIterable for push-based iteration
- **src/cache.ts** - KV-based caching utilities
- **src/helpers.ts** - Internal helper functions

### Key Concepts

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

## Documentation Standards

All public APIs must have:

1. JSDoc with clear description
2. At least one working example
3. Corresponding test in `tests/docs/`
4. Explanation of WHY to use it

See DOCUMENTATION_RULES.md for complete guidelines.

## Testing

**Test Structure:**

- `tests/docs/` - Documentation example tests (56 tests)
  - `run.test.ts` - run() function tests
  - `utility.test.ts` - utility function tests
  - `transformers.test.ts` - transformer tests
  - `concurrent.test.ts` - concurrent operation tests
  - `enumerable.test.ts` - enumerable method tests
  - `process.test.ts` - Process class tests
  - `writable-iterable.test.ts` - WritableIterable tests
  - `reduce.test.ts` - comprehensive reduce tests (17 tests)
  - `additional-coverage.test.ts` - edge case tests (25 tests)
- `tests/command/` - Process command tests
- `tests/enumerable/` - Enumerable operation tests
- `tests/errors/` - Error handling tests
- `tests/regressions/` - Regression tests

**Run tests:**

```bash
deno test --allow-run --allow-read --allow-write --allow-env
```

**Run build (includes tests):**

```bash
./build.sh
```

**Total:** 127 tests (all passing)

**Test Quality Standards:**
- Every public API has tests
- Edge cases covered (empty, null, single element)
- Error conditions tested
- Functions matching JS APIs tested for identical behavior
- Real-world use cases included

## Common Usage Patterns

### Basic command execution

```typescript
import { run } from "jsr:@j50n/proc";
const lines = await run("ls", "-la").lines.collect();
```

### Pipe commands

```typescript
const result = await run("echo", "HELLO")
  .run("tr", "A-Z", "a-z")
  .lines.first;
```

### Process with transformations

```typescript
const numbers = await run("echo", "-e", "1\\n2\\n3")
  .lines
  .map((line) => parseInt(line))
  .collect();
```

### Concurrent processing

```typescript
const results = await range({ to: 10 })
  .concurrentMap(async (n) => {
    // Async work
    return n * 2;
  }, { concurrency: 3 })
  .collect();
```

### Error handling

```typescript
const proc = new Process(
  {
    stdout: "piped",
    stderr: "piped",
    fnError: (error, stderrData) => {
      // Custom error handling
    },
  },
  "command",
  ["args"],
);
```

## Development Workflow

### Adding New Features

1. Implement the feature
2. Add JSDoc with example
3. Create test in `tests/docs/`
4. Verify tests pass
5. Update this file if architecture changes

### Updating Documentation

1. Update JSDoc
2. Update or add tests
3. Run `deno test tests/docs/`
4. Verify all examples work

## Important Files

- `deno.json` - Package configuration
- `mod.ts` - Main export file
- `DOCUMENTATION_RULES.md` - Documentation standards
- `README.md` - Project overview
- `LICENSE.md` - MIT license
