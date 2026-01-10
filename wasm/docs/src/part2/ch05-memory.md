# The Memory Model

WASM has one contiguous block of bytes called linear memory. Understanding it unlocks strings, arrays, and complex data.

## Linear Memory

```typescript
const memory = new WebAssembly.Memory({ 
  initial: 1,    // 1 page = 64KB
  maximum: 256   // Up to 16MB
});
```

That's it. No heap segments, no memory protection. Just bytes at addresses.

## Reading and Writing

Create typed array views into memory:

```typescript
const bytes = new Uint8Array(memory.buffer);
const ints = new Int32Array(memory.buffer);
const floats = new Float64Array(memory.buffer);

// Read
const value = bytes[1024];

// Write
bytes[1024] = 42;

// Bulk write
const data = new TextEncoder().encode("Hello");
bytes.set(data, 1024);
```

For structured data, use `DataView`:

```typescript
const view = new DataView(memory.buffer);
view.setFloat64(offset, value, true);  // true = little-endian
const x = view.getFloat64(offset, true);
```

## Memory Growth

Memory can grow at runtime:

```typescript
memory.grow(1); // Add 64KB
```

**Critical**: After growth, `memory.buffer` changes. All existing views become detached:

```typescript
let bytes = new Uint8Array(memory.buffer);
memory.grow(1);
// bytes is now invalid!
bytes = new Uint8Array(memory.buffer); // Create fresh view
```

Always create views just before use, or recreate after potential growth.

## Pointers

A pointer is just a number—an offset into linear memory:

```odin
@(export)
get_data_ptr :: proc "c" () -> rawptr {
    return &global_data
}
```

```typescript
const ptr = getDataPtr(); // e.g., 1048576
const bytes = new Uint8Array(memory.buffer, ptr, size);
```

## Sharing Data

The pattern for passing complex data:

1. Allocate space in WASM memory
2. Write data from JavaScript
3. Call WASM with pointer and length
4. Read results from memory
5. Free allocation (if needed)

```typescript
const str = "Hello";
const encoded = new TextEncoder().encode(str);
const ptr = allocate(encoded.length);

new Uint8Array(memory.buffer).set(encoded, ptr);
processString(ptr, encoded.length);
free(ptr);
```

## Memory Ownership

Be explicit about who owns memory:

- **JavaScript-owned**: JS allocates, passes to WASM, JS frees
- **WASM-owned**: WASM allocates internally, returns pointer
- **Transferred**: JS allocates, WASM takes ownership

Memory leaks in WASM are silent—no garbage collector will save you.

## Debugging

```typescript
function hexDump(memory: WebAssembly.Memory, start: number, len: number) {
  const bytes = new Uint8Array(memory.buffer, start, len);
  console.log(Array.from(bytes).map(b => 
    b.toString(16).padStart(2, '0')
  ).join(' '));
}
```
