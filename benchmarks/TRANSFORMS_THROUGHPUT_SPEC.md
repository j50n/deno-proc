# Transform Throughput Benchmark Specification

**Version:** 1.0\
**Date:** 2026-01-17\
**Purpose:** Measure and compare throughput (MB/s) of all in-process data
transforms

## Overview

This benchmark measures the performance of data transformation functions in the
`@j50n/proc/transforms` module. It tests how fast each transform can process
data, measured in megabytes per second (MB/s).

## Test Data

- **Records:** 100,000 rows
- **Columns:** 20 fields per row
- **Field format:** `field{column}_{row}` (e.g., `field0_0`, `field1_0`, etc.)
- **Total size:** ~25 MB (varies by format)

### Size by Format

Each format has a different encoded size due to delimiters and structure:

- **CSV:** ~2.9 MB (comma-separated, newline-terminated)
- **TSV:** ~2.9 MB (tab-separated, newline-terminated)
- **Record:** ~2.7 MB (ASCII 31/30 separators, no newlines)
- **JSON Lines:** ~3.5 MB (JSON arrays per line)
- **LazyRow Binary:** ~2.8 MB (length-prefixed binary format)

## Benchmark Methodology

### General Principles

1. **Warmup + Measure:** Each benchmark runs twice - once for warmup (JIT
   compilation), once for measurement
2. **Drain completely:** All output is consumed to ensure the transform
   completes
3. **Size-based throughput:** MB/s = (input_size_MB) / (time_seconds)
4. **Async iteration:** All data flows through `AsyncIterable` to simulate real
   streaming usage

### Benchmark Structure

```typescript
async function benchTransform(
  name: string,
  dataGen: () => AsyncIterable<InputType>,
  sizeMB: number,
): Promise<BenchResult> {
  // Warmup
  await drainOutput(transform()(dataGen()));

  // Measure
  const start = performance.now();
  await drainOutput(transform()(dataGen()));
  const time = (performance.now() - start) / 1000;

  return { name, throughput: sizeMB / time, time };
}
```

### Data Generation

All test data is pre-generated once at startup to avoid measuring generation
overhead:

```typescript
// Base data
const rows = generateRows();  // string[][]

// Format-specific data
const csvData = generateCsv(rows);      // string
const tsvData = generateTsv(rows);      // string
const recData = generateRecord(rows);   // string
const jsonData = generateJsonLines(rows); // string

// LazyRow variants
const stringLazyRows = rows.map(r => LazyRow.fromStringArray(r));
const actualBinaryLazyRows = /* parse from binary format */;
```

## Test Categories

### Category 1: Polymorphic Output Transforms

These transforms accept multiple input types:
`string[] | string[][] | LazyRow | LazyRow[]`

**Transforms:** `toCsv`, `toTsv`, `toRecord`, `toLazyRowBinary`

**Test matrix (6 tests per transform):**

| Input Type   | Batching             | LazyRow Backing | Example                     |
| ------------ | -------------------- | --------------- | --------------------------- |
| `string[][]` | Batched (1000/batch) | N/A             | `[["a","b"], ["c","d"]]`    |
| `string[]`   | Single rows          | N/A             | `["a","b"]`                 |
| `LazyRow[]`  | Batched (1000/batch) | Binary-backed   | Parsed from binary format   |
| `LazyRow`    | Single rows          | Binary-backed   | Parsed from binary format   |
| `LazyRow[]`  | Batched (1000/batch) | String-backed   | `LazyRow.fromStringArray()` |
| `LazyRow`    | Single rows          | String-backed   | `LazyRow.fromStringArray()` |

**Why test all 6 combinations?**

- **Batching:** Batched inputs (arrays) are typically 1.5-2.5x faster due to
  reduced iteration overhead
- **LazyRow backing:** Binary-backed LazyRows enable zero-copy operations;
  string-backed require encoding
- **Type detection:** Transforms use runtime type detection to choose optimal
  code paths

**Size calculation:**

All tests in this category use the **output format size** for throughput
calculation:

- `toCsv` → `csvSize`
- `toTsv` → `tsvSize`
- `toRecord` → `recSize`
- `toLazyRowBinary` → `csvSize` (for fair comparison, since binary format is
  similar size)

### Category 2: Parsing Transforms (Bytes → Rows)

These transforms parse byte streams into structured data.

**Transforms:** `fromCsvToRows`, `fromCsvToLazyRows`, `fromTsvToRows`,
`fromTsvToLazyRows`, `fromRecordToRows`, `fromRecordToLazyRows`,
`fromJsonToRows`

**Test structure (1 test per transform):**

```typescript
await bench("fromCsvToRows", csvSize, async () => {
  await drain(fromCsvToRows()(bytesFrom(csvData)));
});
```

**Input:** Pre-generated format-specific string data wrapped in
`AsyncIterable<Uint8Array>`

**Output:** Drained to count (rows consumed but not stored)

**Why this structure?**

- Parsing is deterministic - no input type variations
- Tests measure pure parsing speed
- LazyRow variants test lazy vs eager evaluation

### Category 3: Serialization Transforms (Rows → Bytes)

**Transform:** `toJson`

**Test structure:**

```typescript
await bench("toJson", jsonSize, async () => {
  await drainBytes(toJson()(fromJsonToRows()(bytesFrom(jsonData))));
});
```

**Input:** Parsed rows from JSON data (round-trip test)

**Why round-trip?**

- Tests realistic usage: parse → process → serialize
- Ensures output is valid (can be parsed back)

### Category 4: Binary Format Transforms

**Transform:** `fromLazyRowBinary`

**Test structure:**

```typescript
await bench("fromLazyRowBinary", binarySize, async () => {
  await drain(fromLazyRowBinary()(toAsync([binaryData])));
});
```

**Input:** Pre-generated binary LazyRow format data

**Why separate category?**

- Binary format is internal representation, not a standard format
- Extremely fast (400+ MB/s) due to zero-copy parsing
- Used as intermediate format in pipelines

## Helper Functions

### `toAsync<T>(items: T[]): AsyncIterable<T>`

Converts array to async iterable. Used to simulate streaming data.

### `bytesFrom(data: string): AsyncIterable<Uint8Array>`

Encodes string to UTF-8 bytes as single chunk. Simulates file/network input.

### `drain<T>(iter: AsyncIterable<T>): Promise<number>`

Consumes all items from iterable, returns count. Ensures transform completes.

### `drainBytes(iter: AsyncIterable<Uint8Array>): Promise<number>`

Consumes all byte chunks, returns total byte count. Ensures transform completes.

## Expected Performance Characteristics

### By Transform Type

- **toRecord:** 120-338 MB/s (fastest - minimal overhead)
- **toTsv:** 100-216 MB/s (fast - simple format, no quoting)
- **toCsv:** 40-149 MB/s (moderate - requires quoting logic)
- **toLazyRowBinary:** 12-263 MB/s (varies wildly by input type)
  - Binary-backed: 130-263 MB/s (fast - zero-copy)
  - String-backed: 12-13 MB/s (slow - must encode each field)

### By Input Type

- **Batched (arrays):** 1.5-2.5x faster than single items
- **Binary-backed LazyRow:** Up to 20x faster than string-backed (for binary
  output)
- **String-backed LazyRow:** Similar to `string[]` performance

### Parsing Performance

- **fromLazyRowBinary:** 400+ MB/s (zero-copy parsing)
- **fromRecordToLazyRows:** 180 MB/s (simple format)
- **fromTsvToLazyRows:** 171 MB/s (tab-separated)
- **fromCsvToLazyRows:** 81 MB/s (complex quoting rules)
- **fromCsvToRows:** 11 MB/s (eager evaluation overhead)

## Uniformity Requirements

### All benchmarks must:

1. **Pre-generate data** - No generation during measurement
2. **Warmup once** - Run transform once before measuring
3. **Measure once** - Single timed run after warmup
4. **Drain completely** - Consume all output
5. **Use correct size** - Match input/output format for MB/s calculation
6. **Return BenchResult** - `{ name, throughput, time }`

### Naming convention:

- Output transforms: `"transformName (from inputType)"`
  - Example: `"toCsv (from LazyRow[] binary)"`
- Parsing transforms: `"transformName"`
  - Example: `"fromCsvToRows"`

### Size selection:

- **Output transforms:** Use output format size
- **Parsing transforms:** Use input format size
- **Round-trip transforms:** Use format size being tested

## Validation

### Correctness

Unit tests in `tests/transforms/` verify correctness. Benchmarks assume
transforms are correct.

### Performance regression

Compare results to baseline:

- **Average throughput:** Should be ~135 MB/s across all transforms
- **Individual transforms:** Should be within 20% of documented performance

### Data integrity

Binary-backed LazyRows must be generated correctly:

```typescript
// WRONG: Creates string-backed LazyRow
const wrong = LazyRow.fromStringArray(row);

// CORRECT: Parse from binary format
const binary = await toLazyRowBinary()(toAsync([rows]));
const correct = await fromLazyRowBinary()(binary);
```

## Future Improvements

1. **Multiple runs:** Average over 3-5 runs for stability
2. **Percentiles:** Report p50, p95, p99 instead of single value
3. **Memory profiling:** Track allocation rate and GC pressure
4. **Comparison mode:** Compare against baseline file
5. **CI integration:** Fail on >20% regression

## Summary Output

```
============================================================
SUMMARY
============================================================
Transform                                      MB/s         Time
------------------------------------------------------------
toCsv (from string[][])                        79.1       323 ms
toCsv (from string[])                          47.7       535 ms
...
------------------------------------------------------------
Average                                       135.0 MB/s
============================================================
```

- **Transform:** Full descriptive name with input type
- **MB/s:** Throughput (higher is better)
- **Time:** Wall-clock time in milliseconds
- **Average:** Mean throughput across all transforms
