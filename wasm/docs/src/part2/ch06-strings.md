# String Handling

WASM doesn't have strings—only bytes in memory. Every string operation requires marshalling.

## The Pattern

1. Encode string as UTF-8 bytes
2. Write to WASM memory
3. Pass pointer and length
4. Read results back
5. Decode to JavaScript string

```typescript
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function writeString(memory: WebAssembly.Memory, str: string, ptr: number): number {
  const bytes = encoder.encode(str);
  new Uint8Array(memory.buffer).set(bytes, ptr);
  return bytes.length;
}

function readString(memory: WebAssembly.Memory, ptr: number, len: number): string {
  return decoder.decode(new Uint8Array(memory.buffer, ptr, len));
}
```

## Memory Strategies

### Fixed Buffer

Reserve a region for string operations:

```typescript
class StringBuffer {
  constructor(
    private memory: WebAssembly.Memory,
    private ptr: number,
    private size: number
  ) {}
  
  write(str: string): { ptr: number; len: number } {
    const bytes = new TextEncoder().encode(str);
    if (bytes.length > this.size) throw new Error("String too long");
    new Uint8Array(this.memory.buffer).set(bytes, this.ptr);
    return { ptr: this.ptr, len: bytes.length };
  }
}
```

Simple but limited to one string at a time.

### WASM Allocator

Let WASM manage memory:

```odin
@(export)
allocate :: proc "c" (size: int) -> rawptr {
    return raw_data(make([]byte, size))
}

@(export)
deallocate :: proc "c" (ptr: rawptr, size: int) {
    free(ptr)
}
```

```typescript
writeString(str: string): { ptr: number; len: number } {
  const bytes = new TextEncoder().encode(str);
  const ptr = this.allocate(bytes.length);
  new Uint8Array(this.memory.buffer).set(bytes, ptr);
  return { ptr, len: bytes.length };
}
```

More flexible but requires careful cleanup.

### Arena Allocation

Allocate from a growing arena, free everything at once:

```typescript
class Arena {
  private offset = 0;
  
  constructor(
    private memory: WebAssembly.Memory,
    private base: number,
    private size: number
  ) {}
  
  alloc(bytes: number): number {
    if (this.offset + bytes > this.size) throw new Error("Arena exhausted");
    const ptr = this.base + this.offset;
    this.offset += bytes;
    return ptr;
  }
  
  reset(): void { this.offset = 0; }
}
```

Good for batch operations.

## Returning Strings from WASM

WASM writes to a provided buffer, returns actual length:

```odin
import "core:mem"

@(export)
get_greeting :: proc "c" (out: rawptr, max_len: int) -> int {
    greeting := "Hello, World!"
    len := min(len(greeting), max_len)
    mem.copy(out, raw_data(greeting), len)
    return len
}
```

```typescript
getGreeting(): string {
  const maxLen = 256;
  const ptr = this.allocate(maxLen);
  const actualLen = this.exports.get_greeting(ptr, maxLen);
  const result = readString(this.memory, ptr, actualLen);
  this.deallocate(ptr, maxLen);
  return result;
}
```

## Performance

Minimize boundary crossings. Pass entire strings, process in WASM:

```typescript
// Bad: character by character
for (const char of str) {
  wasmProcessChar(char.charCodeAt(0));
}

// Good: entire string at once
const { ptr, len } = writeString(str);
wasmProcessString(ptr, len);
```
