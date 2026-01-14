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
  new Uint8Array(memory.buffer, outputPtr, recordLen)
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
- `lazyrow_decode_delimited(id, len, field_sep, record_sep)` - decode AND output with target separators

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

| Conversion | Before | After | Speedup |
|------------|--------|-------|---------|
| lazyrow2csv | 8 MB/s | 202 MB/s | 25x |
| lazyrow2tsv | 8 MB/s | 198 MB/s | 25x |
| lazyrow2record | 8 MB/s | 231 MB/s | 29x |
| record2csv | 78 MB/s | 149 MB/s | 1.9x |
| record2tsv | 68 MB/s | 133 MB/s | 2x |

## Summary

1. **One WASM call per chunk** - combine operations
2. **No JS byte processing** - do it in WASM
3. **Track consumed bytes** - for partial data handling
4. **Minimal JS buffering** - only for leftovers
5. **Direct format output** - skip intermediate formats
