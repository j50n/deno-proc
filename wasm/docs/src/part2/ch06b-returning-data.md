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

See `examples/foundation/` for a working implementation.
