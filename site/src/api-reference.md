# API Reference

Complete API documentation is auto-generated from the source code using Deno's
documentation tool.

## [📚 View Full API Documentation](./api-docs/index.html){:target="_blank"}

The API documentation includes:

- **All exported functions** - Complete signatures and descriptions
- **All classes and interfaces** - Full type information
- **All methods and properties** - Detailed documentation
- **Type definitions** - Complete TypeScript types
- **Examples** - Code examples from JSDoc

## Quick Links

### Core Functions

- **[run()](./api-docs/~/run.html){:target="_blank"}** - Run a child process
- **[enumerate()](./api-docs/~/enumerate.html){:target="_blank"}** - Wrap an
  iterable
- **[read()](./api-docs/~/read.html){:target="_blank"}** - Read a file
- **[main()](./api-docs/~/main.html){:target="_blank"}** - Run a program and
  shut its children down cleanly before it exits
- **[terminateAll()](./api-docs/~/terminateAll.html){:target="_blank"}** -
  Signal every running child and wait for them to exit

### Classes

- **[Enumerable](./api-docs/~/Enumerable.html){:target="_blank"}** - Array-like
  methods for async iterables
- **[ProcessEnumerable](./api-docs/~/ProcessEnumerable.html){:target="_blank"}** -
  Process-specific enumerable
- **[Process](./api-docs/~/Process.html){:target="_blank"}** - Process
  management

### Error Types

- **[ExitCodeError](./api-docs/~/ExitCodeError.html){:target="_blank"}** -
  Non-zero exit code
- **[SignalError](./api-docs/~/SignalError.html){:target="_blank"}** - Process
  killed by signal
- **[UpstreamError](./api-docs/~/UpstreamError.html){:target="_blank"}** - Error
  from upstream process

### Data Transforms

From `jsr:@j50n/proc/transforms`:

- **[fromCsvToRows()](./api-docs/transforms/~/fromCsvToRows.html){:target="_blank"}**,
  **[toCsv()](./api-docs/transforms/~/toCsv.html){:target="_blank"}** - CSV
- **[fromTsvToRows()](./api-docs/transforms/~/fromTsvToRows.html){:target="_blank"}**,
  **[toTsv()](./api-docs/transforms/~/toTsv.html){:target="_blank"}** - TSV
- **[fromJsonToRows()](./api-docs/transforms/~/fromJsonToRows.html){:target="_blank"}**,
  **[toJson()](./api-docs/transforms/~/toJson.html){:target="_blank"}** - JSON
  lines
- **[fromRecordToRows()](./api-docs/transforms/~/fromRecordToRows.html){:target="_blank"}**,
  **[toRecord()](./api-docs/transforms/~/toRecord.html){:target="_blank"}** -
  Record format
- **[LazyRow](./api-docs/transforms/~/LazyRow.html){:target="_blank"}** - Rows
  that parse fields on demand

### Utilities

- **[range()](./api-docs/~/range.html){:target="_blank"}** - Generate number
  ranges
- **[concat()](./api-docs/~/concat.html){:target="_blank"}** - Concatenate byte
  arrays
- **[cache()](./api-docs/~/cache.html){:target="_blank"}** - Cache a computed
  value in Deno KV for a time

## Using the API Docs

The generated documentation includes:

### Search

Use the search box to find any function, class, or type.

### Type Information

Click on any type to see its definition and usage.

### Examples

Most functions include working code examples.

### Source Links

Click "Source" to view the implementation.

## Integration with This Guide

This user guide provides:

- **Conceptual explanations** - Why and when to use features
- **Tutorials** - Step-by-step learning
- **Recipes** - Real-world solutions
- **Best practices** - How to use effectively

The API reference provides:

- **Complete signatures** - Exact function parameters
- **Type definitions** - TypeScript types
- **Technical details** - Implementation specifics
- **All exports** - Everything available

Use both together for complete understanding.

## Keeping Docs Updated

The API documentation is regenerated every time the site is built, so it's
always in sync with the code.

To regenerate manually:

```bash
deno doc --html --name="proc" --output=./site/src/api-docs ./mod.ts
```

## Next Steps

- [Browse the full API documentation](./api-docs/index.html){:target="_blank"}
- [Getting Started](./getting-started/installation.md) - If you're new
- [Core Features](./core/error-handling.md) - Learn the essentials
- [Recipes](./recipes/counting-words.md) - See real examples
