# Returning Dynamic Data

When Odin generates data of unknown size, the caller can't pre-allocate a buffer. Odin must allocate the memory and tell JavaScript both where it is and how big it is.

## The Problem

WASM functions return a single value. But we need two: a pointer and a length.

## Solution: Packed i64

Pack both values into a single 64-bit integer. Low 32 bits hold the pointer, high 32 bits hold the length.

**Odin:**

```odin
import "core:fmt"
import "base:runtime"

// Returns: high 32 bits = length, low 32 bits = pointer
@(export)
create_greeting :: proc "c" (name_ptr: rawptr, name_len: int) -> i64 {
    context = runtime.default_context()
    
    // Build the string from input
    name := string(slice.from_ptr(cast(^u8)name_ptr, name_len))
    msg := fmt.aprintf("Hello, {}!", name)
    
    // Pack pointer and length into i64
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
  // First, pass the name to Odin
  const nameBytes = new TextEncoder().encode(name);
  const namePtr = this.exports.alloc_string(nameBytes.length) as number;
  
  try {
    new Uint8Array(this.memory.buffer).set(nameBytes, namePtr);
    
    // Call Odin - returns packed pointer+length
    const packed = this.exports.create_greeting(namePtr, nameBytes.length) as bigint;
    
    // Unpack: low 32 bits = pointer, high 32 bits = length
    const ptr = Number(packed & 0xFFFFFFFFn);
    const len = Number(packed >> 32n);
    
    try {
      return new TextDecoder().decode(
        new Uint8Array(this.memory.buffer, ptr, len)
      );
    } finally {
      this.exports.free_buffer(ptr);
    }
  } finally {
    this.exports.free_string(namePtr, nameBytes.length);
  }
}
```

## Why This Works

- 32 bits for pointer: supports up to 4GB of WASM memory (the max)
- 32 bits for length: supports strings up to 4GB (more than enough)
- BigInt in JavaScript handles 64-bit integers cleanly
- Odin allocates, JavaScript reads, then tells Odin to free

## The Pattern

1. Pass any input data to Odin (using the string pattern from previous chapter)
2. Odin allocates result, returns packed pointer+length
3. JavaScript unpacks and reads the data
4. JavaScript calls Odin to free the result buffer
5. JavaScript frees any input buffers

Always free in reverse order of allocation, and use `try/finally` to ensure cleanup.

## Returning Structs

Structs work the same way. Odin allocates, returns a pointer, JavaScript reads the fields and frees.

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
    // Point struct: two f64 values (8 bytes each), little-endian
    const view = new DataView(this.memory.buffer);
    return {
      x: view.getFloat64(ptr, true),
      y: view.getFloat64(ptr + 8, true),
    };
  } finally {
    this.exports.free_point(ptr);
  }
}
```

**Key points:**
- Know your struct layout (field sizes and order)
- Odin uses little-endian byte order
- `f64` = 8 bytes, `i32` = 4 bytes, `i64` = 8 bytes

## Struct Return by Value (Hidden Out-Parameter)

Odin can return structs by value, but WASM can't return complex types directly. The compiler uses a **hidden first parameter** where the caller provides a pointer for the result.

```odin
// Odin signature
@(export)
make_point :: proc "c" (x: f64, y: f64) -> Point {
    return Point{x, y}
}
```

```typescript
// Actual WASM call - first arg is out pointer!
const outPtr = 1024; // or allocate properly
this.exports.make_point(outPtr, x, y);

const view = new DataView(this.memory.buffer);
const point = {
  x: view.getFloat64(outPtr, true),
  y: view.getFloat64(outPtr + 8, true),
};
```

This is implicit and easy to get wrong. **The explicit pointer approach is recommended** - it's clearer what's happening and matches the actual calling convention.

See `examples/foundation/` for working examples of both patterns.
