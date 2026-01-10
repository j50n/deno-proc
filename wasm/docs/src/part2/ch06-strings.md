# String Handling

WASM has no string type. Strings are just bytes in linear memory, passed as a pointer and length.

## The Problem

JavaScript and Odin both have memory allocators. They don't know about each other. If you allocate memory from JavaScript and Odin's allocator later uses that same region, your data gets corrupted.

**Solution:** Let Odin handle all memory allocation. JavaScript just writes into memory that Odin allocated.

## Passing a String to Odin

Four steps:

1. Call Odin to allocate memory for the string
2. Write UTF-8 bytes into that memory from JavaScript
3. Call your Odin function with the pointer and length
4. Call Odin to free the memory

**Odin code:**

```odin
import "core:fmt"
import "core:slice"
import "base:runtime"

// Step 1: Odin allocates memory
@(export)
alloc_string :: proc "c" (size: int) -> rawptr {
    context = runtime.default_context()
    return raw_data(make([]byte, size))
}

// Step 4: Odin frees memory
@(export)
free_string :: proc "c" (ptr: rawptr, size: int) {}

// Step 3: Your function that uses the string
@(export)
print_string :: proc "c" (ptr: rawptr, len: int) -> int {
    context = runtime.default_context()
    str := string(slice.from_ptr(cast(^u8)ptr, len))
    fmt.println(str)
    return len
}
```

**TypeScript code:**

```typescript
printString(message: string): number {
  // Convert JS string to UTF-8 bytes
  const bytes = new TextEncoder().encode(message);
  
  // Step 1: Odin allocates
  const ptr = this.exports.alloc_string(bytes.length) as number;
  
  try {
    // Step 2: JavaScript writes into Odin's memory
    new Uint8Array(this.memory.buffer).set(bytes, ptr);
    
    // Step 3: Call Odin function
    return this.exports.print_string(ptr, bytes.length) as number;
  } finally {
    // Step 4: Always free, even if there's an error
    this.exports.free_string(ptr, bytes.length);
  }
}
```

## UTF-8 Matters

JavaScript strings are UTF-16 internally. `TextEncoder` converts them to UTF-8 bytes. The byte length can differ from the character count:

```typescript
const msg = "🎉 Hi";
const bytes = new TextEncoder().encode(msg);

bytes.length  // 7 bytes (emoji is 4 bytes)
msg.length    // 4 characters
```

Always pass the **byte length** to Odin, not the string length.

## Getting a String Back from Odin

Same pattern in reverse. Allocate a buffer, let Odin write into it, then decode:

```odin
import "core:mem"

@(export)
get_greeting :: proc "c" (out: rawptr, max_len: int) -> int {
    context = runtime.default_context()
    greeting := "Hello!"
    n := min(len(greeting), max_len)
    mem.copy(out, raw_data(greeting), n)
    return n  // Return actual length written
}
```

```typescript
getGreeting(): string {
  const maxLen = 256;
  const ptr = this.exports.alloc_string(maxLen) as number;
  
  try {
    const actualLen = this.exports.get_greeting(ptr, maxLen) as number;
    return new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, ptr, actualLen)
    );
  } finally {
    this.exports.free_string(ptr, maxLen);
  }
}
```

See `examples/foundation/` for a complete working example.


## Returning Dynamic Data from Odin

The previous example requires knowing the maximum size upfront. When Odin generates data of unknown size, it must allocate and return both the pointer and length.

**The challenge:** WASM functions can only return one value. We need to return two (pointer and length).

**Solution:** Return a packed i64, or use an out-parameter.

### Option 1: Packed Return Value

Pack pointer and length into a single 64-bit integer:

```odin
// Returns: high 32 bits = length, low 32 bits = pointer
@(export)
create_message :: proc "c" () -> i64 {
    context = runtime.default_context()
    msg := fmt.aprintf("Generated at {}", time.now())
    ptr := raw_data(msg)
    len := i64(len(msg))
    return (len << 32) | i64(uintptr(ptr))
}

@(export)
free_buffer :: proc "c" (ptr: rawptr, size: int) {
    context = runtime.default_context()
    free(ptr)
}
```

```typescript
getMessage(): string {
  const packed = this.exports.create_message() as bigint;
  const ptr = Number(packed & 0xFFFFFFFFn);
  const len = Number(packed >> 32n);
  
  try {
    return new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, ptr, len)
    );
  } finally {
    this.exports.free_buffer(ptr, len);
  }
}
```

### Option 2: Out-Parameter for Length

Pass a pointer where Odin writes the length:

```odin
// Writes length to len_out, returns data pointer
@(export)
create_message :: proc "c" (len_out: ^int) -> rawptr {
    context = runtime.default_context()
    msg := fmt.aprintf("Generated at {}", time.now())
    len_out^ = len(msg)
    return raw_data(msg)
}
```

```typescript
getMessage(): string {
  // Allocate 4 bytes for the length (i32)
  const lenPtr = this.exports.alloc_string(4) as number;
  
  try {
    const dataPtr = this.exports.create_message(lenPtr) as number;
    const len = new DataView(this.memory.buffer).getInt32(lenPtr, true);
    
    try {
      return new TextDecoder().decode(
        new Uint8Array(this.memory.buffer, dataPtr, len)
      );
    } finally {
      this.exports.free_buffer(dataPtr, len);
    }
  } finally {
    this.exports.free_string(lenPtr, 4);
  }
}
```

### Which to Use?

- **Packed i64**: Simpler TypeScript, but requires BigInt handling
- **Out-parameter**: More explicit, works naturally with 32-bit values

Both patterns ensure Odin controls allocation and JavaScript handles cleanup.
