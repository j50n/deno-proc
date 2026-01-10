# Deno + Odin + WASM: AI Quick Reference

> **For AI assistants**: This is the authoritative reference for this project. Ignore the `docs/` book (it's for humans). Use `examples/foundation/` as your working reference.

## Build Command

```bash
odin build src.odin -file -target:js_wasm32 -out:module.wasm \
    -extra-linker-flags:"--import-memory --strip-all"
```

- `--import-memory`: JavaScript creates memory, passes to WASM (eliminates chicken-and-egg problem)
- `--strip-all`: Removes debug symbols (~50% size reduction)

## Instantiation Pattern

```typescript
const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
const runtime = new OdinRuntime(memory);
const instance = await WebAssembly.instantiate(wasmModule, {
  env: { memory },
  odin_env: runtime.env,
});
```

## OdinRuntime (Required Imports)

Odin's `js_wasm32` target requires `odin_env` imports. Minimal implementation:

```typescript
class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  get env(): Record<string, WebAssembly.ImportValue> {
    return {
      // Math (used by core:math)
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
      sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp,
      ln: Math.log, log10: Math.log10, log2: Math.log2,
      floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
      abs: Math.abs, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      ldexp: (x: number, exp: number) => x * Math.pow(2, exp),
      fmuladd: (x: number, y: number, z: number) => x * y + z,
      // I/O (used by fmt package)
      write: this.write.bind(this),
      // Error handling
      trap: () => { throw new Error("WASM trap"); },
      abort: () => { throw new Error("WASM abort"); },
      alert: (ptr: number, len: number) => {
        console.warn(new TextDecoder().decode(new Uint8Array(this.memory.buffer, ptr, len)));
      },
      evaluate: () => { throw new Error("eval disabled"); },
      // Time
      time_now: () => BigInt(Date.now()) * 1000000n,
      tick_now: () => performance.now(),
      time_sleep: () => {},
      // Random
      rand_bytes: (addr: number, len: number) => {
        crypto.getRandomValues(new Uint8Array(this.memory.buffer, addr, len));
      },
    };
  }

  write(fd: number, ptr: number, len: number): number {
    const text = new TextDecoder().decode(new Uint8Array(this.memory.buffer, ptr, len));
    fd === 1 ? console.log(text) : console.error(text);
    return len;
  }
}
```

## Type Mapping

| Odin | WASM | TypeScript |
|------|------|------------|
| `i32`, `int` | i32 | `number` |
| `i64` | i64 | `bigint` |
| `f32` | f32 | `number` |
| `f64` | f64 | `number` |
| `bool` | i32 | `number` (0/1) |
| `rawptr` | i32 | `number` (address) |
| `string` | — | ptr + len (see below) |
| `struct` | — | hidden out-param or ptr |

## Odin File Structure

```odin
package main

import "base:runtime"  // For context
import "core:fmt"      // For printing, aprintf
import "core:slice"    // For slice.from_ptr
import "core:math"     // For math functions

main :: proc() {}  // Required, can be empty

@(export)
add :: proc "c" (a: i32, b: i32) -> i32 {
    return a + b
}
```

## Odin Export Patterns

### Basic Function
```odin
@(export)
add :: proc "c" (a: i32, b: i32) -> i32 {
    return a + b
}
```

### Using Odin Standard Library
```odin
import "base:runtime"

@(export)
do_something :: proc "c" () {
    context = runtime.default_context()  // Required for allocations, fmt, etc.
    // Now you can use fmt.println, make(), new(), etc.
}
```

### String Input (JS → WASM)
```odin
import "core:slice"

@(export)
process_string :: proc "c" (ptr: rawptr, len: int) -> int {
    context = runtime.default_context()
    data := slice.from_ptr(cast(^u8)ptr, len)
    str := string(data)
    // Use str...
    return len
}
```

TypeScript side:
```typescript
const bytes = new TextEncoder().encode(str);
const ptr = (exports.alloc_string as Function)(bytes.length) as number;
new Uint8Array(memory.buffer).set(bytes, ptr);
const result = (exports.process_string as Function)(ptr, bytes.length);
(exports.free_string as Function)(ptr, bytes.length);
```

### String Output (WASM → JS)
Pack pointer and length into i64:
```odin
@(export)
create_string :: proc "c" () -> i64 {
    context = runtime.default_context()
    msg := fmt.aprintf("Hello!")
    ptr := i64(uintptr(raw_data(msg)))
    length := i64(len(msg))
    return (length << 32) | ptr
}
```

TypeScript side:
```typescript
const packed = (exports.create_string as Function)() as bigint;
const ptr = Number(packed & 0xFFFFFFFFn);
const len = Number(packed >> 32n);
const str = new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
(exports.free_buffer as Function)(ptr);
```

### Struct Return (By Value)
WASM uses hidden out-parameter for struct returns:
```odin
Point :: struct { x: f64, y: f64 }

@(export)
make_point :: proc "c" (x: f64, y: f64) -> Point {
    return Point{x, y}
}
```

TypeScript side:
```typescript
const outPtr = (exports.alloc_string as Function)(16) as number;
(exports.make_point as Function)(outPtr, x, y);  // First arg is hidden out-param
const view = new DataView(memory.buffer);
const point = { x: view.getFloat64(outPtr, true), y: view.getFloat64(outPtr + 8, true) };
(exports.free_string as Function)(outPtr, 16);
```

## Memory Management

WASM has two stacks:
- **Value stack**: VM-managed, for primitives, not addressable
- **Linear stack**: In linear memory at low addresses, for addressable locals and struct returns

This is why structs returned by value use a hidden out-parameter—the caller provides space on the linear stack.

Memory sizing:
- `initial`: Must match or exceed WASM module's declared minimum (check linker error)
- `maximum: 256` = 16MB cap (adjust as needed)
- Odin typically needs ~17 pages (~1.1MB) minimum due to runtime overhead
- Use `--initial-memory=N` linker flag to reduce (if your code fits)

Odin allocator functions to export:
```odin
@(export)
alloc_string :: proc "c" (size: int) -> rawptr {
    context = runtime.default_context()
    return raw_data(make([]byte, size))
}

@(export)
free_string :: proc "c" (ptr: rawptr, size: int) {}

@(export)
free_buffer :: proc "c" (ptr: rawptr) {
    context = runtime.default_context()
    free(ptr)
}
```

## Key Gotchas

1. **Always set context**: Any Odin proc using stdlib needs `context = runtime.default_context()`
2. **Use `proc "c"`**: Required for WASM exports (C calling convention)
3. **Memory.buffer invalidates**: After any WASM call that might allocate, re-read `memory.buffer`
4. **Struct alignment**: Use `DataView` with little-endian (`true`) for reading structs
5. **String encoding**: Always UTF-8 via `TextEncoder`/`TextDecoder`
6. **Empty main required**: Odin needs `main :: proc() {}` even if unused
7. **bigint for i64**: JavaScript receives i64 as `bigint`, not `number`

## Array/Slice Pattern

Passing typed arrays (e.g., `[]f64`):

```odin
@(export)
sum_array :: proc "c" (ptr: rawptr, len: int) -> f64 {
    context = runtime.default_context()
    data := slice.from_ptr(cast(^f64)ptr, len)
    total: f64 = 0
    for v in data { total += v }
    return total
}
```

TypeScript side:
```typescript
const arr = new Float64Array([1.0, 2.0, 3.0]);
const ptr = (exports.alloc_string as Function)(arr.byteLength) as number;
new Uint8Array(memory.buffer).set(new Uint8Array(arr.buffer), ptr);
const sum = (exports.sum_array as Function)(ptr, arr.length);
(exports.free_string as Function)(ptr, arr.byteLength);
```

## File Structure

```
project/
├── odin/
│   └── main.odin       # Odin source
├── module.wasm         # Built WASM
├── odin-runtime.ts     # OdinRuntime class
├── wrapper.ts          # TypeScript wrapper class
└── build.sh            # Build script
```

## Testing

```bash
deno test --allow-read
```

## Reference Implementation

See `examples/foundation/` for complete working code.
