# WASM Buffer Overflow Handling

Lessons learned from handling pathological inputs (1MB+ fields) in the flatdata
WASM module.

## The Problem

Fixed-size buffers in WASM fail on large inputs:

- Original `MAX_ROW_DATA`: 256KB
- Original output buffer: 128KB
- A 1MB CSV field overflows both

## Solution: Two-Part Fix

### Part 1: Odin Dynamic Arrays

Replaced manual buffer management with Odin's `[dynamic]u8`:

```odin
// Before
input_buffer: rawptr
input_capacity: int
output_buffer: rawptr
output_capacity: int

grow_output_buffer :: proc(new_size: int) -> bool { ... }
grow_input_buffer :: proc(new_size: int) -> bool { ... }

// After
input_buffer: [dynamic]u8
output_buffer: [dynamic]u8
```

Benefits:

- `append(&output_buffer, byte)` auto-grows
- `resize(&output_buffer, len)` for pre-allocation
- `raw_data(output_buffer)` for JS pointer
- No manual grow functions needed
- Odin handles all allocation/copy/free

### Part 2: TypeScript Row-at-a-Time Processing

The TypeScript code was processing in fixed 64KB chunks, which broke when a
single row exceeded that size.

Fixed by processing one complete row at a time with dynamic buffer sizing:

```typescript
// Added ensureInputBuffer method
private ensureInputBuffer(size: number): void {
  if (size > this.inputSize) {
    this.inputSize = size;
    this.inputPtr = this.exports.alloc_input_buffer(size);
  }
}

// Process one row at a time
while (buffer.length >= 4) {
  const view = new DataView(buffer.buffer, buffer.byteOffset);
  const rowLength = view.getUint32(0, true);
  const totalRowSize = 4 + rowLength;
  
  if (totalRowSize > buffer.length) break; // Incomplete row
  
  this.ensureInputBuffer(totalRowSize);
  // ... process row ...
  buffer = buffer.subarray(totalRowSize);
}
```

## Methods Updated

| Method                     | Change                                            |
| -------------------------- | ------------------------------------------------- |
| `lazyrowToDelimited`       | Process one row at a time, dynamic buffer         |
| `lazyRowBinaryToRecord`    | Process one row at a time, dynamic buffer         |
| `lazyRowBinaryToDelimited` | Process one row at a time, dynamic buffer         |
| `recordToLazyRowBinary`    | Accumulate until record separator, dynamic buffer |

## Test Results

All 80 flatdata tests pass, including all pathological 1MB field tests:

| Test                                     | Status |
| ---------------------------------------- | ------ |
| csv2record with 1MB field                | ✅     |
| csv2tsv with 1MB field                   | ✅     |
| csv2lazyrow round-trip with 1MB field    | ✅     |
| tsv2record with 1MB field                | ✅     |
| tsv2csv with 1MB field                   | ✅     |
| tsv2lazyrow round-trip with 1MB field    | ✅     |
| record2csv with 1MB field                | ✅     |
| record2tsv with 1MB field                | ✅     |
| record2lazyrow round-trip with 1MB field | ✅     |
| lazyrow2csv with 1MB field               | ✅     |
| lazyrow2tsv with 1MB field               | ✅     |
| lazyrow2record with 1MB field            | ✅     |
| multiple 1MB fields in one row           | ✅     |
| 1MB field with normal rows before/after  | ✅     |

## Key Insight

The fix required changes at both layers:

1. **Odin**: Dynamic arrays for auto-growing buffers
2. **TypeScript**: Row-at-a-time processing to handle rows larger than default
   buffer size

Neither fix alone was sufficient - both were needed.

## Key Files

- `/home/dev/ws/deno-proc/odin/src/exports.odin` - WASM exports with dynamic
  arrays
- `/home/dev/ws/deno-proc/src/transforms/flatdata-processor.ts` - TypeScript
  with row-at-a-time processing
