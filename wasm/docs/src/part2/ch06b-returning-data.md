# Returning Dynamic Data

When Odin generates data of unknown size, the caller can't pre-allocate a buffer. Odin must allocate the memory and return it to JavaScript.

This chapter covers two cases:
1. **Variable-length data** (strings, arrays) - need pointer AND length
2. **Fixed-size data** (structs) - just need pointer

---

## Variable-Length Data (Strings, Arrays)

WASM functions return a single value, but we need two: a pointer and a length.

**Solution:** Pack both into a 64-bit integer. Low 32 bits = pointer, high 32 bits = length.

**Odin:**

```odin
// Returns: high 32 bits = length, low 32 bits = pointer
@(export)
create_greeting :: proc "c" (name_ptr: rawptr, name_len: int) -> i64 {
    context = runtime.default_context()
    name := string(slice.from_ptr(cast(^u8)name_ptr, name_len))
    msg := fmt.aprintf("Hello, {}!", name)
    
    ptr := i64(uintptr(raw_data(msg)))
    length := i64(len(msg))
    return (length << 32) | ptr
}

@(export)
free_buffer :: proc "c" (ptr: rawptr) {
    context = runtime.default_context()
    free(ptr)
}
```

**TypeScript:**

```typescript
createGreeting(name: string): string {
  const nameBytes = new TextEncoder().encode(name);
  const namePtr = this.exports.alloc_string(nameBytes.length) as number;
  
  try {
    new Uint8Array(this.memory.buffer).set(nameBytes, namePtr);
    
    // Odin returns packed pointer+length
    const packed = this.exports.create_greeting(namePtr, nameBytes.length) as bigint;
    const ptr = Number(packed & 0xFFFFFFFFn);
    const len = Number(packed >> 32n);
    
    try {
      return new TextDecoder().decode(new Uint8Array(this.memory.buffer, ptr, len));
    } finally {
      this.exports.free_buffer(ptr);
    }
  } finally {
    this.exports.free_string(namePtr, nameBytes.length);
  }
}
```

**Why packed i64 works:**
- 32 bits for pointer covers 4GB (WASM max)
- 32 bits for length covers 4GB (plenty)
- JavaScript BigInt handles 64-bit cleanly

---

## Fixed-Size Data (Structs)

Structs have known size, so we only need the pointer. Odin allocates, JavaScript reads the fields and frees.

**Odin:**

```odin
Point :: struct {
    x: f64,
    y: f64,
}

@(export)
create_point :: proc "c" (x: f64, y: f64) -> ^Point {
    context = runtime.default_context()
    p := new(Point)
    p.x = x
    p.y = y
    return p
}

@(export)
free_point :: proc "c" (p: ^Point) {
    context = runtime.default_context()
    free(p)
}
```

**TypeScript:**

```typescript
createPoint(x: number, y: number): { x: number; y: number } {
  const ptr = this.exports.create_point(x, y) as number;
  
  try {
    const view = new DataView(this.memory.buffer);
    return {
      x: view.getFloat64(ptr, true),      // little-endian
      y: view.getFloat64(ptr + 8, true),
    };
  } finally {
    this.exports.free_point(ptr);
  }
}
```

**Struct layout:**
- Fields are in declaration order
- `f64` = 8 bytes, `i32`/`f32` = 4 bytes, `i64` = 8 bytes
- Odin uses little-endian byte order

---

## Struct Return by Value (Gotcha)

Odin can return structs by value, but WASM uses a **hidden first parameter**:

```odin
// Odin signature
@(export)
make_point :: proc "c" (x: f64, y: f64) -> Point {
    return Point{x, y}
}
```

```typescript
// Actual WASM call - first arg is out pointer!
const outPtr = alloc_string(16) as number;  // 16 bytes for Point
make_point(outPtr, x, y);  // NOT make_point(x, y)

const view = new DataView(memory.buffer);
const point = {
  x: view.getFloat64(outPtr, true),
  y: view.getFloat64(outPtr + 8, true),
};
```

This is implicit and error-prone. **Use explicit pointers instead** - they match what's actually happening.

---

## Summary

| Data Type | Return Method | JavaScript Handling |
|-----------|---------------|---------------------|
| String/Array | Packed i64 (ptr + len) | Unpack with BigInt, decode, free |
| Struct | Pointer | Read fields with DataView, free |
| Struct by value | Hidden out-param | Allocate first, pass as arg 1 |

Always use `try/finally` to ensure cleanup.

See `examples/foundation/` for working code.
