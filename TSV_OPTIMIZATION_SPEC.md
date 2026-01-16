# TSV Transform Optimization Specification

## Problem Statement

Statistical benchmarks revealed that TSV-to-X transforms are 6-8x slower than they should be because they use a full CSV parser instead of simple delimiter replacement.

## Current Performance (50 iterations, 25.54 MB test file)

### Fast Transforms (using simple operations)
- **record2tsv (scalar)**: 423.9 MB/s - Simple byte replacement (0x1F→tab, 0x1E→newline)
- **record2tsv (SIMD)**: 519.8 MB/s - SIMD-optimized byte replacement
- **lazyrow2tsv**: 94.1 MB/s - Binary decoding
- **lazyrow2csv**: 92.6 MB/s - Binary decoding
- **record2csv**: 89.2 MB/s - CSV stringifier (needs quoting logic)

### Slow Transforms (using CSV parser unnecessarily)
- **tsv2record**: 64.2 MB/s ❌ Should be ~400+ MB/s
- **tsv2csv**: 64.9 MB/s ❌ Should be ~400+ MB/s  
- **tsv2lazyrow**: 47.8 MB/s ❌ Should be ~400+ MB/s

### Correctly Slow Transforms (need CSV parser)
- **csv2record**: 64.2 MB/s ✓ Needs parser for quote handling
- **csv2tsv**: 65.6 MB/s ✓ Needs parser for quote handling
- **csv2lazyrow**: 48.4 MB/s ✓ Needs parser for quote handling

## Root Cause Analysis

### Why record2tsv is Fast

Located in `odin/src/record2tsv.odin`:

```odin
record_to_tsv_scalar :: proc "c" (ptr: rawptr, length: int) -> int {
    data := slice.from_ptr(cast(^u8)ptr, length)
    
    for i in 0..<length {
        b := data[i]
        if b == FIELD_SEPARATOR {      // 0x1F
            data[i] = TAB              // 0x09
        } else if b == RECORD_SEPARATOR { // 0x1E
            data[i] = NEWLINE          // 0x0A
        }
    }
    return length
}
```

**Simple in-place byte replacement. No parsing, no state machine.**

### Why tsv2record is Slow

Located in `scripts/flatdata/flatdata.ts`:

```typescript
const tsv2record = new Command()
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const enumerated = enumerate(stream)
      .transform((input) => processor.csvToRecordStreaming(input, 9)); // ❌ Full CSV parser!
```

This calls `csvToRecordStreaming()` which uses `create_direct_parser()` - a **full RFC 4180 CSV parser** with:
- State machine (FieldStart, Unquoted, Quoted, QuoteInQuoted, RecordEnd)
- Quote handling and escape sequences
- Character-by-character processing
- Incremental output building

**TSV has no quotes or escapes, so this is massive overkill!**

## Solution Design

### 1. Create `tsv_to_record` WASM Function

Add to `odin/src/record2tsv.odin` (or new file):

```odin
// Scalar implementation
tsv_to_record_scalar :: proc "c" (ptr: rawptr, length: int) -> int {
    data := slice.from_ptr(cast(^u8)ptr, length)
    
    for i in 0..<length {
        b := data[i]
        if b == TAB {                  // 0x09
            data[i] = FIELD_SEPARATOR  // 0x1F
        } else if b == NEWLINE {       // 0x0A
            data[i] = RECORD_SEPARATOR // 0x1E
        }
    }
    return length
}

// SIMD implementation (similar to record_to_tsv_simd)
tsv_to_record_simd :: proc "c" (ptr: rawptr, length: int) -> int {
    // Use SIMD to process 16 bytes at a time
    // Replace TAB with FIELD_SEPARATOR
    // Replace NEWLINE with RECORD_SEPARATOR
}

@(export)
tsv_to_record :: proc "c" (ptr: rawptr, length: int) -> int {
    when #config(FLATDATA_SIMD, false) {
        return tsv_to_record_simd(ptr, length)
    } else {
        return tsv_to_record_scalar(ptr, length)
    }
}
```

### 2. Add TypeScript Wrapper

Add to `src/wasm/flatdata-processor.ts`:

```typescript
async *tsvToRecordFast(
  input: AsyncIterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  for await (const chunk of input) {
    if (chunk.length === 0) continue;

    this.ensureInputBuffer(chunk.length);
    new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(chunk);

    const outputLen = this.exports.tsv_to_record(this.inputPtr, chunk.length);

    yield new Uint8Array(this.memory.buffer, this.inputPtr, outputLen).slice();
  }
}
```

### 3. Update CLI Command

Change in `scripts/flatdata/flatdata.ts`:

```typescript
const tsv2record = new Command()
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const enumerated = enumerate(stream)
      .transform((input) => processor.tsvToRecordFast(input)); // ✓ Simple replacement
```

### 4. Similar Changes for tsv2csv

Create `tsv_to_csv` function that:
- Replaces tab → comma
- Keeps newline as-is
- Optionally quotes fields containing commas/quotes/newlines (scan-then-quote approach)

### 5. TSV to LazyRow

More complex - needs to:
1. Parse TSV (simple: split on tabs and newlines)
2. Encode to LazyRow binary format

May need dedicated `tsv_to_lazyrow` function or two-step process.

## Expected Results

After optimization:
- **tsv2record**: 64 MB/s → **~420 MB/s** (6.5x speedup)
- **tsv2csv**: 65 MB/s → **~400 MB/s** (6x speedup)
- **tsv2lazyrow**: 48 MB/s → **~400 MB/s** (8x speedup)

## Testing Requirements

### Comprehensive Test Suite

Create `tests/flatdata/tsv2record.test.ts` similar to `record2tsv.test.ts`:
- Basic functionality (SIMD and scalar)
- Edge cases (empty input, consecutive separators)
- Special characters (Unicode, quotes, null bytes)
- Pathological cases (10K char fields, 1000 fields)
- SIMD boundary conditions (15, 16, 17, 32 byte inputs)
- Equivalence verification (SIMD == scalar)

### Benchmark Verification

Run `benchmarks/flatdata-statistical.ts` and verify:
- tsv2record reaches ~400+ MB/s
- tsv2csv reaches ~400+ MB/s
- tsv2lazyrow reaches ~400+ MB/s
- SIMD versions are 15-25% faster than scalar

## Implementation Notes

### WASM Exports

Add to `odin/src/exports.odin`:

```odin
interface WasmExports {
  // Existing
  record_to_tsv: (ptr: number, length: number) => number;
  
  // New
  tsv_to_record: (ptr: number, length: number) => number;
  tsv_to_csv: (ptr: number, length: number) => number;
}
```

### Build Process

Update `odin/build.sh` to compile new functions into both scalar and SIMD WASM modules.

### Backward Compatibility

Old methods remain available:
- `csvToRecordStreaming(input, 9)` still works for TSV
- New `tsvToRecordFast(input)` is faster alternative
- CLI commands automatically use fast path

## Files to Modify

1. `odin/src/record2tsv.odin` - Add tsv_to_record functions
2. `odin/src/exports.odin` - Export new functions
3. `src/wasm/flatdata-processor.ts` - Add TypeScript wrappers
4. `scripts/flatdata/flatdata.ts` - Update CLI commands
5. `tests/flatdata/tsv2record.test.ts` - New test suite
6. `tests/flatdata/tsv2csv.test.ts` - New test suite
7. `benchmarks/flatdata-statistical.ts` - Already includes all transforms

## Success Criteria

- [ ] All tests pass (including new comprehensive test suites)
- [ ] tsv2record reaches 400+ MB/s (6x speedup)
- [ ] tsv2csv reaches 400+ MB/s (6x speedup)
- [ ] tsv2lazyrow reaches 400+ MB/s (8x speedup)
- [ ] SIMD and scalar implementations produce identical output
- [ ] Build passes with no errors
- [ ] Documentation updated with new performance numbers
