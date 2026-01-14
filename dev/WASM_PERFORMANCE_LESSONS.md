# WASM Performance Lessons

Lessons learned from optimizing the flatdata WASM conversions.

## The Golden Rule

**Minimize JS work between read and write.** The ideal pattern is:

```typescript
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Copy to WASM input buffer
  new Uint8Array(memory.buffer, inputPtr, value.length).set(value);

  // Single WASM call
  const outLen = exports.process(value.length);

  // Write output
  if (outLen > 0) {
    await write(new Uint8Array(memory.buffer, outputPtr, outLen).slice());
  }
}
```

Any JS processing between read and write kills performance.

## Anti-Patterns (What NOT to Do)

### 1. Byte-by-byte processing in JS

```typescript
// BAD: 8 MB/s
const output = new Uint8Array(outLen);
for (let i = 0; i < outLen; i++) {
  if (data[i] === 0x1F) output[i] = separator;
  else if (data[i] === 0x1E) output[i] = 0x0A;
  else output[i] = data[i];
}
```

Instead, do delimiter replacement in WASM.

### 2. Scanning data structures in JS

```typescript
// BAD: Scanning row boundaries in JS
while (i + 4 <= buffer.length) {
  const view = new DataView(buffer.buffer, buffer.byteOffset + i);
  const rowLength = view.getUint32(0, true);
  // ...
}
```

Let WASM handle format-specific parsing.

### 3. Multiple WASM calls per chunk

```typescript
// BAD: Two WASM calls + buffer copy
const recordLen = exports.decode(inputLen);
new Uint8Array(memory.buffer, inputPtr, recordLen).set(
  new Uint8Array(memory.buffer, outputPtr, recordLen),
);
const outLen = exports.stringify(recordLen);
```

Combine operations into a single WASM function.

### 4. Accumulating large JS buffers

```typescript
// BAD: Growing buffer in JS
const newBuf = new Uint8Array(buffer.length + value.length);
newBuf.set(buffer);
newBuf.set(value, buffer.length);
buffer = newBuf;
```

Only buffer the minimum needed for partial data handling.

## Good Patterns

### 1. Direct format conversion in WASM

Create WASM functions that convert directly between formats:

- `lazyrow_decode_delimited(id, len, field_sep, record_sep)` - decode AND output
  with target separators

### 2. Track consumed bytes in WASM

When WASM can't process all input (partial rows), track how much was consumed:

```odin
LazyRowDecoder :: struct {
    output: [dynamic]u8,
    consumed: int,  // Track input bytes processed
}
```

Then JS only needs to save the unconsumed leftover:

```typescript
const consumed = exports.get_consumed(decoderId);
if (consumed < slice.length) {
  leftover = slice.subarray(consumed).slice();
}
```

### 3. Swap buffers to avoid copies

If you need to chain operations, have WASM read from output buffer:

```odin
// Read from output buffer, write to input buffer
lazyrow_encode_from_output :: proc(id: i32, input_len: i32) -> i32 {
    input := slice.from_ptr(cast(^u8)output_buffer, int(input_len))
    // ... encode ...
    out := slice.from_ptr(cast(^u8)input_buffer, out_len)
    copy(out, encoder.output[:out_len])
}
```

## Performance Results

After applying these lessons:

| Conversion     | Before  | After    | Speedup |
| -------------- | ------- | -------- | ------- |
| lazyrow2csv    | 8 MB/s  | 202 MB/s | 25x     |
| lazyrow2tsv    | 8 MB/s  | 198 MB/s | 25x     |
| lazyrow2record | 8 MB/s  | 231 MB/s | 29x     |
| record2csv     | 78 MB/s | 149 MB/s | 1.9x    |
| record2tsv     | 68 MB/s | 133 MB/s | 2x      |

## Summary

1. **One WASM call per chunk** - combine operations
2. **No JS byte processing** - do it in WASM
3. **Track consumed bytes** - for partial data handling
4. **Minimal JS buffering** - only for leftovers
5. **Direct format output** - skip intermediate formats

## Streaming Architecture (Advanced)

For maximum throughput, WASM should handle ALL buffering and batching
internally.

### The Problem with Row-by-Row Processing

Even with "one WASM call per chunk", if JS is parsing row boundaries and calling
WASM per-row, you get 100,000 WASM calls for 100,000 rows:

```typescript
// BAD: JS parses row boundaries, calls WASM per row
while (buffer.length >= 4) {
  const rowLength = view.getUint32(0, true);
  const totalRowSize = 4 + rowLength;
  
  if (totalRowSize > buffer.length) break;
  
  // WASM call for EACH row - 100K calls!
  const outLen = exports.decode_row(totalRowSize);
  await write(...);
  
  buffer = buffer.subarray(totalRowSize);
}
```

### The Solution: WASM Handles Everything

WASM should:

1. Accept arbitrary input chunks (64KB+ from Deno)
2. Buffer incomplete rows internally (carry buffer)
3. Accumulate output until threshold (64KB+) before returning
4. Return complete rows only, carry partial row to next call

```odin
StreamingDecoder :: struct {
    output: [dynamic]u8,           // Accumulates until threshold
    carry: [dynamic]u8,            // Incomplete row data between chunks
    field_lengths: [dynamic]u32,   // Reusable, grows as needed
    field_sep: u8,
    record_sep: u8,
}

OUTPUT_THRESHOLD :: 64 * 1024  // Return when output >= 64KB
```

### JS Becomes Trivial

```typescript
// GOOD: JS just shuttles bytes, WASM does all the work
const decoderId = exports.create_streaming_decoder(separator, 0x0A);

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Copy chunk to WASM
  new Uint8Array(memory.buffer, inputPtr, value.length).set(value);

  // Single WASM call processes entire chunk
  const ready = exports.streaming_decode(decoderId, value.length);

  // Write when threshold reached
  if (ready) {
    const outLen = exports.get_output(decoderId);
    await write(new Uint8Array(memory.buffer, outputPtr, outLen).slice());
    exports.clear_output(decoderId);
  }
}

// Flush remaining
const outLen = exports.finish(decoderId);
if (outLen > 0) {
  await write(new Uint8Array(memory.buffer, outputPtr, outLen).slice());
}
```

### Key Design Principles

1. **No artificial limits** - Use dynamic arrays that grow as needed
2. **Threshold-based output** - Accumulate 64KB+ before returning to reduce
   write() calls
3. **Internal carry buffer** - WASM handles partial rows, not JS
4. **Reusable scratch space** - Pre-allocate arrays, resize only when needed
   (not per-row)

### Per-Row Allocations Kill Performance

```odin
// BAD: Allocates for EVERY row
decode_row :: proc(row_data: []u8) {
    field_lengths := make([]u32, field_count)  // ALLOCATION
    defer delete(field_lengths)                 // DEALLOCATION
    // ...
}

// GOOD: Reuse array across all rows
StreamingDecoder :: struct {
    field_lengths: [dynamic]u32,  // Grows once, reused forever
}

decode_row :: proc(d: ^StreamingDecoder, row_data: []u8) {
    if len(d.field_lengths) < field_count {
        resize(&d.field_lengths, field_count)  // Rare resize
    }
    // Use d.field_lengths[:]
}
```

### Expected Results

With streaming architecture:

- **Before**: ~18 MB/s (row-by-row, per-row allocations)
- **After**: ~80 MB/s (streaming, reused buffers) - **4x speedup**

| Conversion      | Before  | After   | Speedup |
| --------------- | ------- | ------- | ------- |
| lazyrow2csv     | 18 MB/s | 77 MB/s | 4.3x    |
| lazyrow2tsv     | 18 MB/s | 85 MB/s | 4.7x    |
| lazyrow2record  | 17 MB/s | 79 MB/s | 4.6x    |
| **Overall avg** | 49 MB/s | 71 MB/s | 1.4x    |
