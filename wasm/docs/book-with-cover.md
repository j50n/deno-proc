![](src/cover.png){ width=100% }

\\pagebreak

# WebAssembly with Deno and Odin

A practical guide for building WebAssembly applications using Deno and Odin.

## What This Book Covers

This is a hands-on guide that takes you from first WASM module to production deployment. We use Odin as our systems language (clean syntax, excellent WASM support) and Deno as our runtime (first-class WASM integration).

By the end, you'll understand:

- The runtime bridge between WASM and JavaScript
- Memory management patterns that work
- How to build, test, and deploy WASM modules

## Prerequisites

You should be comfortable with TypeScript and Deno. Prior Odin experience isn't required—we cover what you need as we go.

## Structure

**Part I: Getting Started** — Environment setup, the runtime bridge, testing patterns.

**Part II: Core Concepts** — Numbers, memory, strings, error handling.

**Part III: Advanced Patterns** — Memory management, multiple instances, real-world applications.

**Part IV: Building & Shipping** — Build automation, performance, deployment.

## The Foundation Example

Throughout this book, we build and extend a single example in `examples/foundation/`. It starts simple and grows with your understanding.

Let's get started.
# Getting Started

WebAssembly lets you run compiled code in JavaScript environments. You know this. What you need to know is how to actually use it with Deno and Odin.

## Why Odin?

You could write WebAssembly in Rust, C, C++, or Go. We're using Odin because:

- **Clean syntax** — Reads like pseudocode. No fighting the language.
- **Explicit control** — Manual memory management without the pain.
- **First-class WASM support** — Compiles to WASM without ceremony.
- **Small output** — Odin WASM modules are tiny compared to alternatives.

Here's a taste:

```odin
calculate_area :: proc(radius: f64) -> f64 {
    return 3.14159 * radius * radius
}
```

If you can read that, you can read Odin.

## Build Target

Odin supports several WebAssembly targets:

| Target | Runtime | Use Case |
|--------|---------|----------|
| `js_wasm32` | Full | JavaScript host with `odin_env` imports |
| `js_wasm64p32` | Full | 64-bit WASM with 32-bit pointers for JS |
| `wasi_wasm32` | Full | WASI-compatible runtimes (Wasmtime, etc.) |
| `wasi_wasm64p32` | Full | 64-bit WASI with 32-bit pointers |
| `freestanding_wasm32` | None | Bare metal, no runtime, tiny output |
| `freestanding_wasm64p32` | None | 64-bit bare metal |

**This book uses `js_wasm32` exclusively.** It provides the full standard library (`fmt`, `core:math`, allocators) and targets JavaScript/Deno hosts.

Why not `freestanding_wasm32`? It produces tiny binaries but lobotomizes Odin—no `fmt`, no allocators, no standard library. You're left reimplementing basics. The ~30KB overhead of `js_wasm32` loads in under 0.1ms (see [Performance](../part4/ch11-performance.md)). You won't notice it, and you get all of Odin.

> ⚠️ **Avoid WASI targets with Deno.** Deno's WASI support is incomplete and poorly documented. The `wasi_wasm32` target looks appealing but leads to hours of frustration. Stick with `js_wasm32`.

```bash
odin build . -target:js_wasm32
```

Output is typically ~30-40KB for simple modules. The runtime requires `odin_env` imports that your JavaScript host must implement (covered in Part 2).

## Project Structure

```
foundation/
├── odin/
│   └── math_demo.odin    # Odin source
├── math-demo.ts          # TypeScript wrapper
├── math-demo.test.ts     # Tests
├── math-demo.wasm        # Compiled output
├── build.sh              # Build script
└── deno.json             # Deno config
```

## Build Script

Create `build.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building math_demo.wasm..."
odin build odin/ \
    -target:js_wasm32 \
    -out:math-demo.wasm \
    -o:speed

echo "✅ Build: math-demo.wasm ($(du -h math-demo.wasm | cut -f1))"
```

The `-o:speed` flag optimizes for performance. Use `-o:size` for smaller output, `-o:none` for faster compilation during development.

## Deno Configuration

Create `deno.json`:

```json
{
  "imports": {
    "@std/assert": "jsr:@std/assert@1"
  }
}
```

## Verify Your Setup

Create `odin/math_demo.odin`:

```odin
package main

@(export)
add :: proc "c" (a: i32, b: i32) -> i32 {
    return a + b
}
```

Build it:

```bash
chmod +x build.sh
./build.sh
```

If you see the success message and a `.wasm` file appears, you're ready.
# Building the Runtime Bridge

When you call a WASM function from JavaScript, something has to translate between the two worlds. That's the runtime bridge—the `env` object you pass during instantiation.

## The Minimal Example

Let's start with Odin code that does something useful:

```odin
package main

import "core:math"

@(export)
calculate_circle :: proc "c" (radius: f64) -> f64 {
    return math.PI * radius * radius
}

@(export)
fibonacci :: proc "c" (n: int) -> int {
    if n <= 1 do return n
    
    a, b := 0, 1
    for _ in 2..=n {
        a, b = b, a + b
    }
    return b
}
```

Key points:
- `@(export)` makes functions visible to JavaScript
- `proc "c"` uses C calling convention (required for WASM exports)
- `core:math` works because we're targeting `js_wasm32`

## What Odin Expects

WASM modules compiled with `js_wasm32` expect certain functions in the `env` object. If they're missing, instantiation fails with a `LinkError`.

Required imports:

```typescript
// Math functions (core:math delegates to these)
sin(x: number): number
cos(x: number): number
sqrt(x: number): number
pow(x: number, y: number): number
ln(x: number): number
exp(x: number): number
ldexp(x: number, exp: number): number
fmuladd(a: number, b: number, c: number): number

// Output (fmt.print uses this)
write(fd: number, ptr: number, len: number): number

// Error handling
trap(): never
abort(): never
```

## The Complete Runtime

Here's a runtime class that provides everything Odin needs:

```typescript
class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  // Math
  sin(x: number): number { return Math.sin(x); }
  cos(x: number): number { return Math.cos(x); }
  sqrt(x: number): number { return Math.sqrt(x); }
  pow(x: number, y: number): number { return Math.pow(x, y); }
  ln(x: number): number { return Math.log(x); }
  exp(x: number): number { return Math.exp(x); }
  ldexp(x: number, exp: number): number { return x * Math.pow(2, exp); }
  fmuladd(a: number, b: number, c: number): number { return a * b + c; }

  // Output
  write(fd: number, ptr: number, len: number): number {
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    const text = new TextDecoder().decode(bytes);
    if (fd === 1) console.log(text);
    else if (fd === 2) console.error(text);
    return len;
  }

  // Errors
  trap(): never { throw new Error("WASM trap"); }
  abort(): never { throw new Error("WASM abort"); }

  createEnv(): Record<string, WebAssembly.ImportValue> {
    const env: Record<string, WebAssembly.ImportValue> = {};
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      if (name !== "constructor" && name !== "createEnv") {
        env[name] = (this as any)[name].bind(this);
      }
    }
    return env;
  }
}
```

The `createEnv()` method collects all methods into an object suitable for WASM imports. The `.bind(this)` is crucial—without it, methods lose their `this` context when called from WASM.

## Wrapping It Up

Now wrap everything in a clean API:

```typescript
export class MathDemo {
  private constructor(
    private instance: WebAssembly.Instance,
    public memory: WebAssembly.Memory,
  ) {}

  static async create(): Promise<MathDemo> {
    const wasmPath = new URL("./math-demo.wasm", import.meta.url).pathname;
    const wasmBytes = await Deno.readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBytes);

    const memory = new WebAssembly.Memory({ initial: 1, maximum: 256 });
    const runtime = new OdinRuntime(memory);

    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { memory, ...runtime.createEnv() },
    });

    return new MathDemo(instance, memory);
  }

  calculateCircle(radius: number): number {
    return (this.instance.exports.calculate_circle as (r: number) => number)(radius);
  }

  fibonacci(n: number): number {
    return (this.instance.exports.fibonacci as (n: number) => number)(n);
  }

  // Memory allocation (we'll expand these in later chapters)
  allocate(size: number): number {
    return (this.instance.exports.allocate as (size: number) => number)(size);
  }

  deallocate(ptr: number, size: number): void {
    (this.instance.exports.deallocate as (ptr: number, size: number) => void)(ptr, size);
  }
}
```

Usage:

```typescript
const demo = await MathDemo.create();
console.log(demo.calculateCircle(5));  // 78.53981633974483
console.log(demo.fibonacci(10));       // 55
// No cleanup needed - instances are garbage collected like any JS object
```

## The Import/Export Contract

This is the fundamental pattern:

- **Exports**: Functions WASM provides to JavaScript (marked with `@(export)`)
- **Imports**: Functions JavaScript provides to WASM (the `env` object)

The `env` namespace is conventional—Odin expects it. Other languages might use different names.

## Extending the Runtime

Add custom functions by extending the runtime:

```typescript
class CustomRuntime extends OdinRuntime {
  log(ptr: number, len: number): void {
    const text = new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, ptr, len)
    );
    console.log(`[WASM] ${text}`);
  }
}
```

Then in Odin:

```odin
foreign import env {
    log :: proc "c" (ptr: rawptr, len: int) ---
}

debug :: proc(msg: string) {
    env.log(raw_data(msg), len(msg))
}
```

## Performance Note

Every call across the WASM-JavaScript boundary has overhead—roughly 5-10 nanoseconds per call in V8. That's tiny for individual calls, but adds up in tight loops:

```typescript
// 1 million boundary crossings ≈ 5-10ms overhead
for (let i = 0; i < 1000000; i++) {
  result += wasmAdd(i, 1);
}

// One crossing, loop in WASM ≈ 0.00001ms overhead
result = wasmSumRange(0, 1000000);
```

For most applications this overhead is negligible. It only matters when you're calling tiny functions millions of times—keep those hot loops inside WASM.
# Testing WASM Integration

WASM errors are cryptic. Tests are your safety net.

## The Essential Tests

Start with instantiation—if this fails, nothing else matters:

```typescript
import { assertEquals, assertAlmostEquals } from "@std/assert";
import { MathDemo } from "./math-demo.ts";

Deno.test("MathDemo - instantiation", async () => {
  const demo = await MathDemo.create();
  assertEquals(demo.fibonacci(5), 5);
});
```

This catches corrupted WASM files, missing imports, and runtime initialization failures.

## Floating-Point Tolerance

WASM and JavaScript both follow IEEE 754, but implementation details can cause tiny differences. Use `assertAlmostEquals`:

```typescript
Deno.test("MathDemo - circle calculation", async () => {
  const demo = await MathDemo.create();
  
  const result = demo.calculateCircle(5.0);
  assertAlmostEquals(result, Math.PI * 25, 1e-10);
});
```

Exact equality checks will fail spuriously.

## Instance Isolation

WASM instances should be independent. Verify this:

```typescript
Deno.test("MathDemo - instance isolation", async () => {
  const demo1 = await MathDemo.create();
  const demo2 = await MathDemo.create();
  
  // Modify state in one instance (if your module has state)
  // Verify the other is unaffected
  
  const [r1, r2] = await Promise.all([
    Promise.resolve(demo1.calculateCircle(3)),
    Promise.resolve(demo2.fibonacci(8)),
  ]);
  
  assertAlmostEquals(r1, Math.PI * 9, 1e-10);
  assertEquals(r2, 21);
});
```

## Edge Cases

Test boundaries and unusual inputs:

```typescript
Deno.test("MathDemo - edge cases", async () => {
  const demo = await MathDemo.create();
  
  // Zero
  assertEquals(demo.calculateCircle(0), 0);
  
  // Negative (behavior depends on your implementation)
  const negResult = demo.fibonacci(-1);
  assertEquals(typeof negResult, "number"); // At minimum, shouldn't crash
});
```

## Memory Operations

When testing memory-related functions, verify bounds and cleanup:

```typescript
Deno.test("MathDemo - memory allocation", async () => {
  const demo = await MathDemo.create();
  
  const ptr = demo.allocate(1024);
  assertEquals(typeof ptr, "number");
  assertEquals(ptr > 0, true);
  
  // Write and read back
  const bytes = new Uint8Array(demo.memory.buffer, ptr, 4);
  bytes.set([1, 2, 3, 4]);
  assertEquals(bytes[0], 1);
  
  demo.deallocate(ptr, 1024);
});
```

## Build Integration

Add tests to your build script:

```bash
#!/bin/bash
set -e

odin build odin/ -target:js_wasm32 -out:math-demo.wasm -o:speed
deno fmt --check *.ts
deno lint *.ts
deno check *.ts
deno test --allow-read

echo "✅ All checks passed"
```

Now every build verifies correctness.

## Debugging Failures

When tests fail:

1. **Check if you rebuilt** — Stale WASM is a common cause
2. **List exports** — `console.log(Object.keys(instance.exports))`
3. **Check import errors** — Missing runtime functions cause `LinkError`
4. **Add logging** — Temporarily add `console.log` in your runtime's `write` function
# Working with Numbers

Numbers are the simplest data to pass between JavaScript and WASM. No memory management, no encoding—just values.

## Type Mapping

| Odin | WASM | JavaScript |
|------|------|------------|
| `i8`, `i16`, `i32`, `int` | `i32` | `number` |
| `i64` | `i64` | `bigint` |
| `f32`, `f64` | `f32`, `f64` | `number` |
| `bool` | `i32` | `number` (0/1) |

## The i64 Complication

JavaScript's `number` loses precision above 2^53. WASM returns `i64` as `bigint`:

```odin
@(export)
big_add :: proc "c" (a: i64, b: i64) -> i64 {
    return a + b
}
```

```typescript
const bigAdd = instance.exports.big_add as (a: bigint, b: bigint) => bigint;
console.log(bigAdd(9007199254740993n, 1n)); // Note the 'n' suffix
```

## Floating-Point Precision

Use `f64` unless you have a specific reason for `f32`. JavaScript numbers are 64-bit floats internally, so `f64` avoids conversion overhead.

Precision differences between WASM and JavaScript are typically around 10^-15 for `f64`—negligible for most purposes, but use tolerance in tests.

## Booleans

Odin booleans become `i32` (0 or 1). Wrap for cleaner TypeScript:

```typescript
isEven(n: number): boolean {
  return (this.instance.exports.is_even as (n: number) => number)(n) !== 0;
}
```

## Multiple Return Values

WASM functions return one value. Options for multiple results:

**Write to memory** (most flexible):
```odin
@(export)
get_point :: proc "c" (out: ^f64) {
    out[0] = state.x
    out[1] = state.y
}
```

**Pack into one value** (for small integers):
```odin
@(export)
get_packed :: proc "c" () -> i32 {
    return i32(x) | (i32(y) << 16)
}
```

## Computational Patterns

Numbers are where WASM shines. Keep loops inside WASM:

```odin
@(export)
sum_range :: proc "c" (start, end: int) -> int {
    sum := 0
    for i in start..<end {
        sum += i
    }
    return sum
}
```

One boundary crossing beats a million.
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

When you know the maximum size, allocate a buffer and let Odin write into it:

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

For dynamic data where you don't know the size upfront, see [Returning Dynamic Data](./ch06b-returning-data.md).

See `examples/foundation/` for working examples.
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
# Error Handling

WASM errors are different from JavaScript errors. When something goes wrong, you need to catch it, understand it, and recover.

## Error Types

### Traps (RuntimeError)

Catastrophic failures: division by zero, out-of-bounds access, unreachable code.

```typescript
try {
  wasmFunction();
} catch (e) {
  if (e instanceof WebAssembly.RuntimeError) {
    console.error("WASM trap:", e.message);
  }
}
```

### Link Errors

Import mismatches during instantiation:

```typescript
try {
  await WebAssembly.instantiate(wasmModule, imports);
} catch (e) {
  if (e instanceof WebAssembly.LinkError) {
    console.error("Missing import:", e.message);
  }
}
```

### Compile Errors

Invalid WASM binary:

```typescript
try {
  await WebAssembly.compile(wasmBytes);
} catch (e) {
  if (e instanceof WebAssembly.CompileError) {
    console.error("Invalid WASM:", e.message);
  }
}
```

## Odin Error Mechanisms

### Assertions

```odin
assert(x > 0, "x must be positive")
```

Calls `evaluate_assertion` in your runtime:

```typescript
evaluate_assertion(
  file_ptr: number, file_len: number,
  line: number, column: number,
  msg_ptr: number, msg_len: number
): never {
  const file = this.readString(file_ptr, file_len);
  const msg = this.readString(msg_ptr, msg_len);
  throw new Error(`Assertion failed at ${file}:${line}:${column} - ${msg}`);
}
```

### Panic

```odin
panic("Something went wrong")
```

Calls `trap()` in your runtime. Less informative than assertions.

## Defensive Programming

Validate before crossing the boundary:

```typescript
calculateCircle(radius: number): number {
  if (!Number.isFinite(radius)) throw new Error("radius must be finite");
  if (radius < 0) throw new Error("radius must be non-negative");
  return this.exports.calculate_circle(radius);
}
```

JavaScript errors are easier to debug than WASM traps.

## Error Recovery

WASM errors may corrupt instance state. For critical applications:

```typescript
class ResilientWasm {
  private instance: MathDemo | null = null;
  
  async calculate(radius: number): Promise<number> {
    try {
      if (!this.instance) this.instance = await MathDemo.create();
      return this.instance.calculateCircle(radius);
    } catch {
      this.instance = null;  // Allow GC, will recreate on next call
      throw e;
    }
  }
}
```

Recreate the instance after errors to ensure clean state.

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `unreachable executed` | Assertion/panic/missing case | Check Odin code logic |
| `out of bounds memory access` | Bad pointer/index | Verify bounds |
| `import odin_env::xyz not found` | Missing runtime function | Add to OdinRuntime |
| `call stack exhausted` | Infinite recursion | Fix recursion base case |
# Advanced Memory Management

You understand the basics—linear memory, pointers, reading and writing bytes. Now let's explore patterns for managing memory effectively in real applications.

## Allocation Strategies

### The Simple Bump Allocator

The simplest allocator just increments a pointer:

```odin
allocator_offset: int = 1024  // Start after reserved space

@(export)
bump_alloc :: proc "c" (size: int) -> rawptr {
    ptr := rawptr(uintptr(allocator_offset))
    allocator_offset += size
    return ptr
}
```

Fast and simple. The catch? Memory is never freed. Works great for:
- Short-lived instances
- Batch processing where you reset between batches
- Situations where total allocation is bounded

### Arena Allocation

Arenas group allocations that share a lifetime:

```typescript
class MemoryArena {
  private base: number;
  private offset: number;
  private capacity: number;
  
  constructor(
    private memory: WebAssembly.Memory,
    base: number,
    capacity: number
  ) {
    this.base = base;
    this.offset = 0;
    this.capacity = capacity;
  }
  
  alloc(size: number, align: number = 8): number {
    // Align the offset
    const aligned = (this.base + this.offset + align - 1) & ~(align - 1);
    const newOffset = aligned - this.base + size;
    
    if (newOffset > this.capacity) {
      throw new Error("Arena exhausted");
    }
    
    this.offset = newOffset;
    return aligned;
  }
  
  reset(): void {
    this.offset = 0;
  }
  
  used(): number {
    return this.offset;
  }
}
```

Use arenas when you have clear phases:

```typescript
const arena = new MemoryArena(memory, 65536, 1024 * 1024);

// Process batch 1
const ptr1 = arena.alloc(1000);
const ptr2 = arena.alloc(2000);
processBatch(ptr1, ptr2);
arena.reset();

// Process batch 2 - reuses same memory
const ptr3 = arena.alloc(1500);
processBatch(ptr3);
arena.reset();
```

### Pool Allocation

For fixed-size objects, pools are efficient:

```typescript
class ObjectPool<T> {
  private freeList: number[] = [];
  private objectSize: number;
  
  constructor(
    private memory: WebAssembly.Memory,
    private base: number,
    objectSize: number,
    count: number
  ) {
    this.objectSize = objectSize;
    
    // Initialize free list
    for (let i = count - 1; i >= 0; i--) {
      this.freeList.push(base + i * objectSize);
    }
  }
  
  alloc(): number {
    const ptr = this.freeList.pop();
    if (ptr === undefined) {
      throw new Error("Pool exhausted");
    }
    return ptr;
  }
  
  free(ptr: number): void {
    this.freeList.push(ptr);
  }
}
```

Pools give O(1) allocation and deallocation with zero fragmentation.

## Growing Memory

When you need more memory than initially allocated:

```typescript
function ensureCapacity(memory: WebAssembly.Memory, needed: number): void {
  const current = memory.buffer.byteLength;
  if (needed <= current) return;
  
  const pagesNeeded = Math.ceil((needed - current) / 65536);
  const result = memory.grow(pagesNeeded);
  
  if (result === -1) {
    throw new Error(`Failed to grow memory by ${pagesNeeded} pages`);
  }
}
```

Remember: after `memory.grow()`, all existing `ArrayBuffer` views are detached. Recreate them:

```typescript
class SafeMemoryView {
  private memory: WebAssembly.Memory;
  private _bytes: Uint8Array | null = null;
  
  constructor(memory: WebAssembly.Memory) {
    this.memory = memory;
  }
  
  get bytes(): Uint8Array {
    // Always create fresh view
    return new Uint8Array(this.memory.buffer);
  }
  
  // Or cache with invalidation
  invalidate(): void {
    this._bytes = null;
  }
  
  get cachedBytes(): Uint8Array {
    if (!this._bytes || this._bytes.buffer !== this.memory.buffer) {
      this._bytes = new Uint8Array(this.memory.buffer);
    }
    return this._bytes;
  }
}
```

## Alignment

Different data types have alignment requirements:

| Type | Alignment |
|------|-----------|
| `i8`, `u8` | 1 byte |
| `i16`, `u16` | 2 bytes |
| `i32`, `u32`, `f32` | 4 bytes |
| `i64`, `u64`, `f64` | 8 bytes |

Misaligned access works but may be slower. Some platforms trap on misalignment.

Align allocations:

```typescript
function alignUp(value: number, alignment: number): number {
  return (value + alignment - 1) & ~(alignment - 1);
}

function allocAligned(arena: MemoryArena, size: number, align: number): number {
  return arena.alloc(size, align);
}
```

## Memory Layout for Structures

When passing structures between JavaScript and WASM, layout matters.

Odin structure:
```odin
Point :: struct {
    x: f64,  // offset 0, size 8
    y: f64,  // offset 8, size 8
}
```

JavaScript reading:
```typescript
function readPoint(memory: WebAssembly.Memory, ptr: number): { x: number; y: number } {
  const view = new DataView(memory.buffer);
  return {
    x: view.getFloat64(ptr, true),      // true = little-endian
    y: view.getFloat64(ptr + 8, true),
  };
}
```

JavaScript writing:
```typescript
function writePoint(memory: WebAssembly.Memory, ptr: number, x: number, y: number): void {
  const view = new DataView(memory.buffer);
  view.setFloat64(ptr, x, true);
  view.setFloat64(ptr + 8, y, true);
}
```

Use `DataView` for structured data—it handles alignment and endianness correctly.

## Debugging Memory Issues

### Memory Dump

```typescript
function hexDump(memory: WebAssembly.Memory, start: number, length: number): void {
  const bytes = new Uint8Array(memory.buffer, start, length);
  const lines: string[] = [];
  
  for (let i = 0; i < length; i += 16) {
    const hex = Array.from(bytes.slice(i, i + 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    
    const ascii = Array.from(bytes.slice(i, i + 16))
      .map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.')
      .join('');
    
    lines.push(`${(start + i).toString(16).padStart(8, '0')}  ${hex.padEnd(48)}  ${ascii}`);
  }
  
  console.log(lines.join('\n'));
}
```

### Memory Statistics

```typescript
class MemoryStats {
  constructor(private memory: WebAssembly.Memory) {}
  
  report(): void {
    const total = this.memory.buffer.byteLength;
    const pages = total / 65536;
    
    console.log(`Memory: ${total} bytes (${pages} pages)`);
    console.log(`  ${(total / 1024 / 1024).toFixed(2)} MB`);
  }
}
```

### Canary Values

Detect buffer overflows with canary values:

```typescript
const CANARY = 0xDEADBEEF;

function allocWithCanary(arena: MemoryArena, size: number): number {
  const ptr = arena.alloc(size + 8); // Extra space for canaries
  const view = new DataView(arena.memory.buffer);
  
  view.setUint32(ptr, CANARY, true);
  view.setUint32(ptr + size + 4, CANARY, true);
  
  return ptr + 4; // Return pointer past first canary
}

function checkCanary(memory: WebAssembly.Memory, ptr: number, size: number): boolean {
  const view = new DataView(memory.buffer);
  const before = view.getUint32(ptr - 4, true);
  const after = view.getUint32(ptr + size, true);
  
  if (before !== CANARY || after !== CANARY) {
    console.error(`Buffer overflow detected at ${ptr}`);
    return false;
  }
  return true;
}
```

## Memory Patterns in Practice

### Request-Response Pattern

```typescript
class RequestBuffer {
  private requestPtr: number;
  private responsePtr: number;
  private maxSize: number;
  
  constructor(memory: WebAssembly.Memory, base: number, maxSize: number) {
    this.requestPtr = base;
    this.responsePtr = base + maxSize;
    this.maxSize = maxSize;
  }
  
  async process(request: Uint8Array): Promise<Uint8Array> {
    if (request.length > this.maxSize) {
      throw new Error("Request too large");
    }
    
    // Write request
    new Uint8Array(memory.buffer).set(request, this.requestPtr);
    
    // Process
    const responseLen = wasmProcess(
      this.requestPtr, request.length,
      this.responsePtr, this.maxSize
    );
    
    // Read response
    return new Uint8Array(memory.buffer, this.responsePtr, responseLen).slice();
  }
}
```

### Double Buffering

For streaming or animation:

```typescript
class DoubleBuffer {
  private buffers: [number, number];
  private current = 0;
  
  constructor(arena: MemoryArena, size: number) {
    this.buffers = [
      arena.alloc(size),
      arena.alloc(size),
    ];
  }
  
  front(): number {
    return this.buffers[this.current];
  }
  
  back(): number {
    return this.buffers[1 - this.current];
  }
  
  swap(): void {
    this.current = 1 - this.current;
  }
}
```

Memory management is where WASM development differs most from typical JavaScript. Master these patterns and you'll handle any data exchange scenario.
# Multiple Instances

So far we've worked with single WASM instances. But sometimes you need more than one—for isolation, parallelism, or architectural reasons.

## Why Multiple Instances?

### Isolation

Each instance has its own memory. One instance can't corrupt another's state:

```typescript
const instance1 = await MathDemo.create();
const instance2 = await MathDemo.create();

// These operate on completely separate memory
instance1.processData(data1);
instance2.processData(data2);
```

Useful when processing untrusted input or when different parts of your application shouldn't share state.

### Parallelism

WASM instances can run concurrently in Web Workers:

```typescript
// worker.ts
const demo = await MathDemo.create();

self.onmessage = (e) => {
  const result = demo.calculate(e.data);
  self.postMessage(result);
};
```

```typescript
// main.ts
const workers = [
  new Worker("worker.ts", { type: "module" }),
  new Worker("worker.ts", { type: "module" }),
  new Worker("worker.ts", { type: "module" }),
];

// Distribute work across workers
const results = await Promise.all(
  chunks.map((chunk, i) => {
    return new Promise((resolve) => {
      workers[i % workers.length].onmessage = (e) => resolve(e.data);
      workers[i % workers.length].postMessage(chunk);
    });
  })
);
```

### Different Configurations

Same module, different setups:

```typescript
const smallInstance = await MathDemo.create({ memoryPages: 1 });
const largeInstance = await MathDemo.create({ memoryPages: 256 });
```

## Creating Multiple Instances

The pattern is straightforward—just call your factory multiple times:

```typescript
const instances: MathDemo[] = [];

for (let i = 0; i < 4; i++) {
  instances.push(await MathDemo.create());
}
```

Each instance gets its own:
- Memory buffer
- Global variables
- Internal state

They share:
- The compiled module (efficient)
- Import functions (your runtime)

## Sharing the Compiled Module

Compiling WASM is expensive. Compile once, instantiate many times:

```typescript
class MathDemoFactory {
  private module: WebAssembly.Module | null = null;
  
  async compile(): Promise<void> {
    if (this.module) return;
    
    const wasmPath = new URL("./math-demo.wasm", import.meta.url).pathname;
    const wasmBytes = await Deno.readFile(wasmPath);
    this.module = await WebAssembly.compile(wasmBytes);
  }
  
  async create(): Promise<MathDemo> {
    await this.compile();
    
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 256 });
    const runtime = new OdinRuntime(memory);
    
    const instance = await WebAssembly.instantiate(this.module!, {
      env: runtime.createEnv(),
    });
    
    return new MathDemo(instance, memory, runtime);
  }
}

// Usage
const factory = new MathDemoFactory();
await factory.compile();

const instance1 = await factory.create(); // Fast - module already compiled
const instance2 = await factory.create(); // Fast
const instance3 = await factory.create(); // Fast
```

## Instance Pooling

For high-throughput scenarios, maintain a pool of ready instances:

```typescript
class InstancePool {
  private available: MathDemo[] = [];
  private inUse = new Set<MathDemo>();
  private factory: MathDemoFactory;
  
  constructor(private maxSize: number) {
    this.factory = new MathDemoFactory();
  }
  
  async initialize(count: number): Promise<void> {
    await this.factory.compile();
    
    for (let i = 0; i < count; i++) {
      this.available.push(await this.factory.create());
    }
  }
  
  async acquire(): Promise<MathDemo> {
    let instance = this.available.pop();
    
    if (!instance && this.inUse.size < this.maxSize) {
      instance = await this.factory.create();
    }
    
    if (!instance) {
      throw new Error("Pool exhausted");
    }
    
    this.inUse.add(instance);
    return instance;
  }
  
  release(instance: MathDemo): void {
    if (!this.inUse.has(instance)) {
      throw new Error("Instance not from this pool");
    }
    
    this.inUse.delete(instance);
    // Reset instance state if needed
    this.available.push(instance);
  }
  
  async withInstance<T>(fn: (instance: MathDemo) => Promise<T>): Promise<T> {
    const instance = await this.acquire();
    try {
      return await fn(instance);
    } finally {
      this.release(instance);
    }
  }
}

// Usage
const pool = new InstancePool(10);
await pool.initialize(4);

const result = await pool.withInstance(async (demo) => {
  return demo.calculateCircle(5);
});
```

## Shared Memory (Advanced)

Normally, each instance has separate memory. But you can share memory between instances:

```typescript
// Create shared memory
const sharedMemory = new WebAssembly.Memory({ 
  initial: 1, 
  maximum: 256,
  shared: true  // Enable sharing
});

// Both instances use the same memory
const instance1 = await createInstance(sharedMemory);
const instance2 = await createInstance(sharedMemory);
```

**Warning**: Shared memory requires careful synchronization. Without it, you'll have race conditions. This is advanced territory—use only when you understand the implications.

## Communication Between Instances

Instances can't directly call each other. Communication goes through JavaScript:

```typescript
class InstanceCoordinator {
  private instances: MathDemo[];
  
  constructor(instances: MathDemo[]) {
    this.instances = instances;
  }
  
  // Fan-out: same operation on all instances
  async broadcast(fn: (demo: MathDemo) => Promise<number>): Promise<number[]> {
    return Promise.all(this.instances.map(fn));
  }
  
  // Pipeline: output of one feeds input of next
  async pipeline(input: number): Promise<number> {
    let value = input;
    for (const instance of this.instances) {
      value = instance.transform(value);
    }
    return value;
  }
  
  // Map-reduce: distribute work, combine results
  async mapReduce(
    data: number[],
    map: (demo: MathDemo, chunk: number[]) => number,
    reduce: (results: number[]) => number
  ): Promise<number> {
    const chunkSize = Math.ceil(data.length / this.instances.length);
    const chunks = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    const results = await Promise.all(
      chunks.map((chunk, i) => map(this.instances[i], chunk))
    );
    
    return reduce(results);
  }
}
```

## Testing Multiple Instances

Verify instances are truly independent:

```typescript
Deno.test("Multiple instances are isolated", async () => {
  const demo1 = await MathDemo.create();
  const demo2 = await MathDemo.create();
  
  // Modify state in instance 1
  demo1.setState(42);
  
  // Instance 2 should be unaffected
  assertEquals(demo2.getState(), 0); // Default value
});

Deno.test("Instances can run concurrently", async () => {
  const demo1 = await MathDemo.create();
  const demo2 = await MathDemo.create();
  
  // Run simultaneously
  const [result1, result2] = await Promise.all([
    demo1.heavyComputation(1000),
    demo2.heavyComputation(1000),
  ]);
  
  // Both should complete successfully
  assertEquals(typeof result1, "number");
  assertEquals(typeof result2, "number");
});
```

## Performance Considerations

**Instance creation cost**: Creating instances is fast (~0.1ms median). Pooling is rarely necessary.

**Memory overhead**: Each instance has its own memory. 10 instances with 1MB each = 10MB total.

**Module sharing**: Always share the compiled module. Compilation is the expensive part.

**Boundary crossings**: Communication between instances goes through JavaScript. Minimize back-and-forth.

## When to Use Multiple Instances

**Use multiple instances when**:
- Processing untrusted or isolated data
- Parallelizing CPU-intensive work
- Different parts of your app need different configurations
- You need to reset state cleanly between operations

**Stick to single instance when**:
- Memory is constrained
- Operations are sequential anyway
- State sharing is required
- Simplicity matters more than isolation

Multiple instances are a powerful tool. Use them when the architecture calls for it, but don't add complexity without clear benefit.
# Real-World Applications

This is where WASM earns its keep. Heavy computation that would choke JavaScript runs smoothly in WASM.

## Computational Workloads

### Batch Processing

Move loops into WASM. One boundary crossing beats a million:

```odin
@(export)
mandelbrot_row :: proc "c" (
    y: int, width: int,
    x_min, x_max, y_val: f64,
    max_iter: int, out: [^]u8,
) {
    x_step := (x_max - x_min) / f64(width)
    for px in 0..<width {
        cx := x_min + f64(px) * x_step
        escape := mandelbrot_escape(cx, y_val, max_iter)
        out[px] = u8(escape * 255 / max_iter)
    }
}

mandelbrot_escape :: proc(cx, cy: f64, max_iter: int) -> int {
    x, y: f64 = 0, 0
    for i in 0..<max_iter {
        if x*x + y*y > 4.0 do return i
        x, y = x*x - y*y + cx, 2*x*y + cy
    }
    return max_iter
}
```

```typescript
function renderMandelbrot(demo: MathDemo, width: number, height: number): Uint8Array {
  const rowPtr = demo.allocate(width);
  const pixels = new Uint8Array(width * height);
  
  for (let py = 0; py < height; py++) {
    const yVal = -2 + py * 4 / height;
    demo.mandelbrotRow(py, width, -2, 2, yVal, 256, rowPtr);
    pixels.set(new Uint8Array(demo.memory.buffer, rowPtr, width), py * width);
  }
  
  demo.deallocate(rowPtr, width);
  return pixels;
}
```

### Matrix Operations

```odin
@(export)
matrix_multiply :: proc "c" (a, b, c: [^]f64, m, k, n: int) {
    for i in 0..<m {
        for j in 0..<n {
            sum: f64 = 0
            for p in 0..<k {
                sum += a[i*k + p] * b[p*n + j]
            }
            c[i*n + j] = sum
        }
    }
}
```

### Statistics

```odin
@(export)
statistics :: proc "c" (data: [^]f64, len: int, out: [^]f64) {
    // out: [mean, variance, min, max]
    if len == 0 { out[0], out[1], out[2], out[3] = 0, 0, 0, 0; return }
    
    sum, min_val, max_val: f64 = 0, data[0], data[0]
    for i in 0..<len {
        sum += data[i]
        if data[i] < min_val do min_val = data[i]
        if data[i] > max_val do max_val = data[i]
    }
    mean := sum / f64(len)
    
    var_sum: f64 = 0
    for i in 0..<len {
        diff := data[i] - mean
        var_sum += diff * diff
    }
    
    out[0], out[1], out[2], out[3] = mean, var_sum / f64(len), min_val, max_val
}
```

## Data Structures

### Passing Arrays

```typescript
function processArray(demo: MathDemo, values: number[]): Float64Array {
  const data = new Float64Array(values);
  const ptr = demo.allocate(data.byteLength);
  new Float64Array(demo.memory.buffer, ptr, data.length).set(data);
  
  demo.processInPlace(ptr, data.length);
  
  const result = new Float64Array(demo.memory.buffer, ptr, data.length).slice();
  demo.deallocate(ptr, data.byteLength);
  return result;
}
```

### Structures

Match layouts in both languages:

```odin
Point :: struct {
    x: f64,  // offset 0
    y: f64,  // offset 8
}
```

```typescript
const POINT_SIZE = 16;

function writePoint(memory: WebAssembly.Memory, ptr: number, p: {x: number, y: number}) {
  const view = new DataView(memory.buffer);
  view.setFloat64(ptr, p.x, true);
  view.setFloat64(ptr + 8, p.y, true);
}

function readPoint(memory: WebAssembly.Memory, ptr: number): {x: number, y: number} {
  const view = new DataView(memory.buffer);
  return { x: view.getFloat64(ptr, true), y: view.getFloat64(ptr + 8, true) };
}
```

### Arrays of Structures

```odin
@(export)
closest_point :: proc "c" (points: [^]Point, count: int, target: ^Point) -> int {
    if count == 0 do return -1
    best_idx, best_dist := 0, distance(&points[0], target)
    for i in 1..<count {
        if d := distance(&points[i], target); d < best_dist {
            best_dist, best_idx = d, i
        }
    }
    return best_idx
}
```

```typescript
function closestPoint(demo: MathDemo, points: Point[], target: Point): number {
  const arrayPtr = demo.allocate(points.length * POINT_SIZE);
  const targetPtr = demo.allocate(POINT_SIZE);
  
  for (let i = 0; i < points.length; i++) {
    writePoint(demo.memory, arrayPtr + i * POINT_SIZE, points[i]);
  }
  writePoint(demo.memory, targetPtr, target);
  
  const result = demo.closestPoint(arrayPtr, points.length, targetPtr);
  
  demo.deallocate(arrayPtr, points.length * POINT_SIZE);
  demo.deallocate(targetPtr, POINT_SIZE);
  return result;
}
```

## When WASM Wins

WASM excels at:
- Tight loops with numeric computation
- Large array operations
- Predictable memory access patterns

WASM doesn't help with:
- I/O-bound operations
- Small, infrequent calculations
- Operations dominated by boundary crossing

Profile first. Optimize where it matters.
# Build Automation

Manual builds get old fast. A good build script catches errors early, runs tests automatically, and produces consistent output.

## A Complete Build Script

Here's a production-ready `build.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building math_demo.wasm..."
odin build odin/ \
    -target:js_wasm32 \
    -out:math-demo.wasm \
    -o:speed

echo "✅ Build: math-demo.wasm ($(du -h math-demo.wasm | cut -f1))"

echo "🎨 Formatting..."
deno fmt --check *.ts || deno fmt *.ts

echo "🔍 Linting..."
deno lint *.ts
deno check *.ts

echo "🧪 Testing..."
deno test --allow-read

echo "🎉 All checks passed!"
```

## Odin Compilation Flags

```bash
odin build odin/ \
    -target:js_wasm32 \    # WASM with runtime
    -out:math-demo.wasm \  # Output file
    -o:speed               # Optimize for performance
```

Optimization options:
- `-o:none` — Fast compile, no optimization
- `-o:size` — Optimize for small output
- `-o:speed` — Optimize for performance

## Watch Mode

Rebuild on file changes:

```bash
deno test --allow-read --watch
```

Or with inotifywait:

```bash
while true; do
    ./build.sh
    inotifywait -q -e modify odin/*.odin *.ts
done
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build and Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
      - name: Install Odin
        run: |
          wget https://github.com/odin-lang/Odin/releases/latest/download/odin-ubuntu-latest.zip
          unzip odin-ubuntu-latest.zip
          echo "$PWD/odin" >> $GITHUB_PATH
      - run: ./build.sh
```

## Build Variants

```bash
case "$1" in
  dev)    odin build odin/ -target:js_wasm32 -out:math-demo.wasm -o:none ;;
  release) odin build odin/ -target:js_wasm32 -out:math-demo.wasm -o:speed ;;
  size)   odin build odin/ -target:js_wasm32 -out:math-demo.wasm -o:size ;;
esac
```

Good build automation is invisible when it works and invaluable when something breaks.
# Performance Optimization

WASM is fast, but not automatically fast. Understanding where time goes helps you optimize effectively.

## Measuring Performance

Before optimizing, measure. Deno provides good timing tools:

```typescript
// Simple timing
const start = performance.now();
const result = demo.heavyComputation(data);
const elapsed = performance.now() - start;
console.log(`Computation took ${elapsed.toFixed(2)}ms`);
```

For more detail:

```typescript
function benchmark(name: string, fn: () => void, iterations = 1000): void {
  // Warmup
  for (let i = 0; i < 100; i++) fn();
  
  // Measure
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const mean = times.reduce((a, b) => a + b) / times.length;
  
  console.log(`${name}:`);
  console.log(`  median: ${median.toFixed(3)}ms`);
  console.log(`  mean:   ${mean.toFixed(3)}ms`);
  console.log(`  p95:    ${p95.toFixed(3)}ms`);
}
```

## Boundary Crossing Overhead

The biggest performance trap is excessive boundary crossings. Each call from JavaScript to WASM (and back) has overhead.

**Measure it:**

```typescript
// Measure call overhead
benchmark("empty WASM call", () => {
  demo.noop(); // WASM function that does nothing
});

// Compare to pure JS
benchmark("empty JS call", () => {
  (() => {})();
});
```

You'll find WASM calls are 10-100x slower than JS function calls. This overhead is fixed per call, regardless of what the function does.

**Implications:**

Bad:
```typescript
// 1 million boundary crossings
let sum = 0;
for (let i = 0; i < 1000000; i++) {
  sum += wasmIncrement(sum);
}
```

Good:
```typescript
// 1 boundary crossing
const sum = wasmSumRange(0, 1000000);
```

Move loops inside WASM. Cross the boundary for setup and results, not for each iteration.

## Instance Startup Overhead

You might wonder: how expensive is it to create a new WASM instance? Should you pool instances?

**Benchmark results** (Chromebook Plus in Crostini VM—modest hardware):

```
WASM Instance Startup (100,000 iterations, after 10k warmup + 3s sleep)
──────────────────────────────────────────────────
Average: 0.181 ms
Min:     0.055 ms
P50:     0.083 ms
P99:     2.913 ms
Max:     7.857 ms
```

Creating a fresh instance, calling a function, and disposing takes ~0.08ms median. That's fast enough to create ~12,000 instances per second on mediocre hardware.

**Implications:**

- Instance pooling is rarely necessary
- Creating instances on-demand is fine for most use cases
- The P99 spikes (~3ms) are GC pauses, not WASM overhead

**When pooling might help:**

- Sub-millisecond latency requirements
- Creating hundreds of instances per second
- Memory-constrained environments where you want to reuse allocations

For most applications, just create instances when you need them and let them get garbage collected.

See `examples/startup-bench/` for the benchmark code.

## Memory Access Patterns

How you access WASM memory affects performance.

**Create views once:**

```typescript
// Bad - creates new view each time
function readByte(ptr: number): number {
  return new Uint8Array(memory.buffer)[ptr];
}

// Good - reuse view
const bytes = new Uint8Array(memory.buffer);
function readByte(ptr: number): number {
  return bytes[ptr];
}
```

**Batch operations:**

```typescript
// Bad - many small copies
for (let i = 0; i < 1000; i++) {
  bytes[ptr + i] = data[i];
}

// Good - single copy
bytes.set(data, ptr);
```

**Use typed arrays appropriately:**

```typescript
// Reading f64 values
// Bad - byte-by-byte
const value = 
  bytes[ptr] | 
  (bytes[ptr+1] << 8) | 
  // ... 8 operations

// Good - typed view
const floats = new Float64Array(memory.buffer, ptr, 1);
const value = floats[0];

// Best for multiple values
const floats = new Float64Array(memory.buffer, ptr, count);
// Now floats[i] gives you each value directly
```

## Odin Optimization

### Compiler Flags

```bash
# Development - fast compile
odin build . -target:js_wasm32 -o:none

# Release - optimized
odin build . -target:js_wasm32 -o:speed

# Size-constrained
odin build . -target:js_wasm32 -o:size
```

### Code Patterns

**Avoid allocations in hot paths:**

```odin
// Bad - allocates each call
process :: proc(data: []byte) -> []byte {
    result := make([]byte, len(data))
    // ...
    return result
}

// Good - caller provides buffer
process :: proc(data: []byte, result: []byte) {
    // ...
}
```

**Use appropriate types:**

```odin
// If you only need 32-bit precision
calculate :: proc(x: f32) -> f32  // Faster on some platforms

// If you need full precision
calculate :: proc(x: f64) -> f64
```

**Inline small functions:**

```odin
@(inline)
square :: proc(x: f64) -> f64 {
    return x * x
}
```

## Bundle Size

Smaller WASM files load faster. Measure your bundle:

```bash
ls -la math-demo.wasm
wc -c math-demo.wasm
```

### Reducing Size

**Strip debug info:**
```bash
odin build . -target:js_wasm32 -o:size
```

**Remove unused exports:**
Only export what you need. Each export adds to the binary.

**Compress for transfer:**
```bash
gzip -9 math-demo.wasm
# or
brotli -9 math-demo.wasm
```

Servers can serve compressed WASM with appropriate headers.

## Profiling

### Deno Profiling

```bash
deno run --v8-flags=--prof script.ts
```

This generates a V8 profile you can analyze.

### Custom Profiling

```typescript
class Profiler {
  private timings = new Map<string, number[]>();
  
  start(name: string): () => void {
    const start = performance.now();
    return () => {
      const elapsed = performance.now() - start;
      const times = this.timings.get(name) || [];
      times.push(elapsed);
      this.timings.set(name, times);
    };
  }
  
  report(): void {
    for (const [name, times] of this.timings) {
      const total = times.reduce((a, b) => a + b, 0);
      const avg = total / times.length;
      console.log(`${name}: ${times.length} calls, ${total.toFixed(2)}ms total, ${avg.toFixed(3)}ms avg`);
    }
  }
}

const profiler = new Profiler();

// Usage
const end = profiler.start("calculateCircle");
demo.calculateCircle(5);
end();

// Later
profiler.report();
```

## Common Optimizations

### Batch Processing

```typescript
// Instead of
for (const item of items) {
  results.push(wasmProcess(item));
}

// Do
const inputPtr = writeArray(items);
const outputPtr = allocate(items.length * 8);
wasmProcessBatch(inputPtr, outputPtr, items.length);
const results = readArray(outputPtr, items.length);
```

### Caching

```typescript
class CachedDemo {
  private cache = new Map<string, number>();
  
  calculate(input: number): number {
    const key = String(input);
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const result = this.demo.calculate(input);
    this.cache.set(key, result);
    return result;
  }
}
```

### Lazy Loading

```typescript
class LazyDemo {
  private instance: MathDemo | null = null;
  
  private async ensure(): Promise<MathDemo> {
    if (!this.instance) {
      this.instance = await MathDemo.create();
    }
    return this.instance;
  }
  
  async calculate(x: number): Promise<number> {
    const demo = await this.ensure();
    return demo.calculateCircle(x);
  }
}
```

## When Not to Optimize

Premature optimization wastes time. Optimize when:

- Profiling shows a clear bottleneck
- Users experience noticeable delays
- Resource usage exceeds acceptable limits

Don't optimize when:

- Code is already fast enough
- Optimization would hurt readability significantly
- You're guessing at the bottleneck

Measure first. Optimize second. Measure again to verify.
# Production Deployment

Your WASM module works in development. Now let's make it production-ready.

## Distribution Strategies

### Bundled with Application

The simplest approach—include the `.wasm` file with your application:

```
my-app/
├── src/
│   ├── main.ts
│   └── math-demo.ts
├── wasm/
│   └── math-demo.wasm
└── deno.json
```

Load relative to your module:

```typescript
const wasmPath = new URL("../wasm/math-demo.wasm", import.meta.url).pathname;
```

### CDN Distribution

For web applications, serve WASM from a CDN:

```typescript
const wasmUrl = "https://cdn.example.com/wasm/math-demo.wasm";
const response = await fetch(wasmUrl);
const wasmBytes = await response.arrayBuffer();
const module = await WebAssembly.compile(wasmBytes);
```

Set appropriate headers:
```
Content-Type: application/wasm
Cache-Control: public, max-age=31536000, immutable
```

### NPM/JSR Package

Publish as a package with the WASM file included:

```json
// deno.json
{
  "name": "@yourname/math-demo",
  "version": "1.0.0",
  "exports": "./mod.ts"
}
```

```typescript
// mod.ts
export { MathDemo } from "./math-demo.ts";
```

Users install and use:
```typescript
import { MathDemo } from "@yourname/math-demo";
const demo = await MathDemo.create();
```

## Loading Optimization

### Streaming Compilation

For large modules, compile while downloading:

```typescript
const response = await fetch(wasmUrl);
const module = await WebAssembly.compileStreaming(response);
```

This starts compilation before the download completes—faster than waiting for the full file.

### Caching Compiled Modules

Compilation is expensive. Cache the result:

```typescript
class ModuleCache {
  private static cache = new Map<string, WebAssembly.Module>();
  
  static async get(url: string): Promise<WebAssembly.Module> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    
    const response = await fetch(url);
    const module = await WebAssembly.compileStreaming(response);
    this.cache.set(url, module);
    return module;
  }
}
```

For persistence across page loads (browser), use IndexedDB:

```typescript
async function getCachedModule(url: string): Promise<WebAssembly.Module> {
  const db = await openDB("wasm-cache", 1, {
    upgrade(db) {
      db.createObjectStore("modules");
    },
  });
  
  let module = await db.get("modules", url);
  
  if (!module) {
    const response = await fetch(url);
    module = await WebAssembly.compileStreaming(response);
    await db.put("modules", module, url);
  }
  
  return module;
}
```

### Preloading

Load WASM before it's needed:

```typescript
// Start loading immediately
const modulePromise = WebAssembly.compileStreaming(fetch(wasmUrl));

// Later, when needed
async function createDemo(): Promise<MathDemo> {
  const module = await modulePromise; // Already loaded
  return MathDemo.fromModule(module);
}
```

## Security Considerations

### Content Security Policy

If using CSP, allow WASM:

```
Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'
```

The `wasm-unsafe-eval` directive permits WASM compilation.

### Input Validation

Never trust input to WASM functions:

```typescript
calculateCircle(radius: number): number {
  // Validate before passing to WASM
  if (!Number.isFinite(radius)) {
    throw new Error("Invalid radius: must be finite");
  }
  if (radius < 0) {
    throw new Error("Invalid radius: must be non-negative");
  }
  if (radius > 1e10) {
    throw new Error("Invalid radius: too large");
  }
  
  return this.exports.calculate_circle(radius);
}
```

### Memory Bounds

Ensure pointers stay within bounds:

```typescript
function safeRead(memory: WebAssembly.Memory, ptr: number, len: number): Uint8Array {
  const maxAddr = memory.buffer.byteLength;
  
  if (ptr < 0 || len < 0 || ptr + len > maxAddr) {
    throw new Error(`Out of bounds: ptr=${ptr}, len=${len}, max=${maxAddr}`);
  }
  
  return new Uint8Array(memory.buffer, ptr, len);
}
```

### Sandboxing

WASM is sandboxed by design—it can only access what you provide. Keep imports minimal:

```typescript
// Only provide what's necessary
const imports = {
  env: {
    // Math functions - safe
    sin: Math.sin,
    cos: Math.cos,
    
    // Don't expose file system, network, etc.
  },
};
```

## Error Monitoring

### Structured Error Handling

```typescript
class WasmError extends Error {
  constructor(
    message: string,
    public readonly wasmFunction: string,
    public readonly inputs: unknown[],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "WasmError";
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      wasmFunction: this.wasmFunction,
      inputs: this.inputs,
      stack: this.stack,
    };
  }
}

function wrapWasmCall<T>(
  name: string,
  fn: (...args: unknown[]) => T,
  ...args: unknown[]
): T {
  try {
    return fn(...args);
  } catch (e) {
    throw new WasmError(
      `WASM call failed: ${name}`,
      name,
      args,
      e instanceof Error ? e : undefined
    );
  }
}
```

### Logging

```typescript
class WasmLogger {
  private logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    data?: unknown;
  }> = [];
  
  log(level: string, message: string, data?: unknown): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });
    
    // Also send to monitoring service
    if (level === "error") {
      this.reportError(message, data);
    }
  }
  
  private reportError(message: string, data?: unknown): void {
    // Send to your error tracking service
    // e.g., Sentry, DataDog, etc.
  }
  
  getLogs(): typeof this.logs {
    return [...this.logs];
  }
}
```

## Health Checks

Verify WASM is working:

```typescript
class HealthCheck {
  static async verify(demo: MathDemo): Promise<boolean> {
    try {
      // Test basic functionality
      const result = demo.calculateCircle(1);
      if (Math.abs(result - Math.PI) > 0.0001) {
        throw new Error("Calculation mismatch");
      }
      
      // Test memory operations
      const testData = new Uint8Array([1, 2, 3, 4]);
      // ... verify memory read/write
      
      return true;
    } catch (e) {
      console.error("Health check failed:", e);
      return false;
    }
  }
}

// On startup
const demo = await MathDemo.create();
if (!await HealthCheck.verify(demo)) {
  throw new Error("WASM module failed health check");
}
```

## Graceful Degradation

Have a fallback when WASM fails:

```typescript
class MathService {
  private wasmDemo: MathDemo | null = null;
  
  async initialize(): Promise<void> {
    try {
      this.wasmDemo = await MathDemo.create();
    } catch (e) {
      console.warn("WASM unavailable, using JS fallback:", e);
    }
  }
  
  calculateCircle(radius: number): number {
    if (this.wasmDemo) {
      return this.wasmDemo.calculateCircle(radius);
    }
    // JavaScript fallback
    return Math.PI * radius * radius;
  }
}
```

## Deployment Checklist

Before deploying:

- [ ] All tests pass
- [ ] WASM file is optimized (`-o:speed` or `-o:size`)
- [ ] Bundle size is acceptable
- [ ] Error handling covers all edge cases
- [ ] Input validation is in place
- [ ] Health checks are implemented
- [ ] Monitoring is configured
- [ ] Fallbacks exist for critical functionality
- [ ] CSP headers allow WASM (if applicable)
- [ ] Caching headers are set correctly
- [ ] Documentation is updated

Production WASM is about reliability as much as performance. Build for both.
# Odin Language Reference

A quick reference for Odin features commonly used in WASM development.

## Basic Syntax

### Variables and Constants

```odin
// Variables
x: int = 42
y := 3.14  // Type inferred

// Constants
PI :: 3.14159
MAX_SIZE :: 1024
```

### Functions (Procedures)

```odin
// Basic procedure
add :: proc(a, b: int) -> int {
    return a + b
}

// Multiple return values
divmod :: proc(a, b: int) -> (int, int) {
    return a / b, a % b
}

// C calling convention (required for WASM exports)
@(export)
wasm_add :: proc "c" (a, b: i32) -> i32 {
    return a + b
}
```

### Control Flow

```odin
// If statement
if x > 0 {
    // ...
} else if x < 0 {
    // ...
} else {
    // ...
}

// Single-line if
if x > 0 do return x

// For loop
for i in 0..<10 {
    // i goes from 0 to 9
}

// While-style loop
for x > 0 {
    x -= 1
}

// Infinite loop
for {
    if done do break
}

// Switch
switch value {
case 1:
    // ...
case 2, 3:
    // ...
case:
    // default
}
```

## Types

### Numeric Types

| Type | Size | Description |
|------|------|-------------|
| `i8`, `i16`, `i32`, `i64` | 1-8 bytes | Signed integers |
| `u8`, `u16`, `u32`, `u64` | 1-8 bytes | Unsigned integers |
| `int` | Platform-dependent | Signed integer |
| `uint` | Platform-dependent | Unsigned integer |
| `f32`, `f64` | 4-8 bytes | Floating point |
| `bool` | 1 byte | Boolean |

### Strings

```odin
// String literal
s := "Hello, World!"

// String is a struct: { data: ^u8, len: int }
len(s)        // Length
raw_data(s)   // Pointer to bytes
```

### Arrays and Slices

```odin
// Fixed array
arr: [5]int = {1, 2, 3, 4, 5}

// Slice (view into array)
slice: []int = arr[1:4]  // Elements 1, 2, 3

// Dynamic array (requires allocator)
dyn := make([dynamic]int)
append(&dyn, 42)
delete(dyn)

// Multi-pointer (for WASM interop)
ptr: [^]int  // Pointer to array of unknown size
```

### Structs

```odin
Point :: struct {
    x, y: f64,
}

// Packed struct (no padding)
PackedPoint :: struct #packed {
    x, y: f64,
}

// Usage
p := Point{x = 1.0, y = 2.0}
p.x = 3.0
```

### Pointers

```odin
x: int = 42
ptr: ^int = &x    // Pointer to x
value := ptr^     // Dereference

// Raw pointer (for WASM interop)
raw: rawptr = rawptr(&x)
```

## WASM-Specific Features

### Export Attribute

```odin
@(export)
my_function :: proc "c" () {
    // Visible to JavaScript
}
```

### Foreign Imports

```odin
foreign import env {
    // Import from JavaScript
    sin :: proc "c" (x: f64) -> f64 ---
    cos :: proc "c" (x: f64) -> f64 ---
}
```

### Memory Operations

```odin
import "core:mem"

// Copy memory
mem.copy(dest, src, size)

// Zero memory
mem.zero(ptr, size)

// Compare memory
mem.compare(a, b, size)
```

## Common Patterns

### Error Handling

```odin
// Return error indicator
divide :: proc "c" (a, b: f64) -> f64 {
    if b == 0 do return math.NAN
    return a / b
}

// Multiple returns with success flag
parse :: proc "c" (ptr: rawptr, len: int) -> (result: int, ok: bool) {
    // ...
    return value, true
}
```

### Working with Slices from Pointers

```odin
@(export)
process_array :: proc "c" (ptr: [^]f64, len: int) -> f64 {
    // Create slice from pointer
    data := ptr[:len]
    
    sum: f64 = 0
    for v in data {
        sum += v
    }
    return sum
}
```

### Compile-Time Configuration

```odin
VERSION :: #config(VERSION, "dev")
DEBUG :: #config(DEBUG, false)

when DEBUG {
    // Debug-only code
}
```

## Useful Packages

```odin
import "core:math"      // Math functions
import "core:mem"       // Memory operations
import "core:slice"     // Slice utilities
import "core:strings"   // String manipulation
```

## Further Reading

- [Odin Language Specification](https://odin-lang.org/docs/spec/)
- [Odin Overview](https://odin-lang.org/docs/overview/)
- [Core Library Documentation](https://pkg.odin-lang.org/core/)
# Odin WASM Environment Functions

This reference documents the environment functions that Odin's WebAssembly backend expects from the host environment. These functions are automatically imported by the Odin compiler when WASM code uses corresponding standard library features.

## Core Runtime Functions

### I/O Operations

#### `write(fd: i32, ptr: i32, len: i32) -> i32`
Writes data to a file descriptor.
- `fd`: File descriptor (1 for stdout, 2 for stderr)
- `ptr`: Pointer to data in WASM memory
- `len`: Number of bytes to write
- Returns: Number of bytes written

### Error Handling

#### `trap()`
Triggers a WebAssembly trap, terminating execution.

#### `abort(file_ptr: i32, file_len: i32, line: i32, column: i32)`
Aborts execution with location information.
- `file_ptr`: Pointer to filename string
- `file_len`: Length of filename
- `line`: Line number
- `column`: Column number

#### `alert(ptr: i32, len: i32)`
Displays an alert message (typically for debugging).
- `ptr`: Pointer to message string
- `len`: Length of message

### Evaluation

#### `evaluate(str_ptr: i32, str_len: i32) -> f64`
Evaluates a string expression and returns the result.
- `str_ptr`: Pointer to expression string
- `str_len`: Length of expression
- Returns: Evaluation result

### Time Operations

#### `time_now() -> f64`
Returns current time as seconds since Unix epoch.

#### `tick_now() -> f64`
Returns high-resolution timestamp for performance measurement.

#### `time_sleep(duration: f64)`
Sleeps for the specified duration in seconds.

### Random Number Generation

#### `rand_bytes(ptr: i32, len: i32)`
Fills buffer with cryptographically secure random bytes.
- `ptr`: Pointer to buffer
- `len`: Number of bytes to generate

## Math Functions

### Basic Math Operations

#### `sin(x: f64) -> f64`
Sine function.

#### `cos(x: f64) -> f64`
Cosine function.

#### `sqrt(x: f64) -> f64`
Square root function.

#### `pow(x: f64, y: f64) -> f64`
Power function (x^y).

#### `ln(x: f64) -> f64`
Natural logarithm.

#### `exp(x: f64) -> f64`
Exponential function (e^x).

#### `ldexp(x: f64, exp: i32) -> f64`
Multiplies x by 2^exp.

#### `fmuladd(x: f64, y: f64, z: f64) -> f64`
Fused multiply-add operation (x*y + z).

### Extended Math Functions

#### `tan(x: f64) -> f64`
Tangent function.

#### `asin(x: f64) -> f64`
Arcsine function.

#### `acos(x: f64) -> f64`
Arccosine function.

#### `atan(x: f64) -> f64`
Arctangent function.

#### `atan2(y: f64, x: f64) -> f64`
Two-argument arctangent function.

#### `log10(x: f64) -> f64`
Base-10 logarithm.

#### `log2(x: f64) -> f64`
Base-2 logarithm.

#### `floor(x: f64) -> f64`
Floor function (largest integer ≤ x).

#### `ceil(x: f64) -> f64`
Ceiling function (smallest integer ≥ x).

#### `round(x: f64) -> f64`
Round to nearest integer.

#### `trunc(x: f64) -> f64`
Truncate to integer (towards zero).

#### `abs(x: f64) -> f64`
Absolute value.

### Hyperbolic Functions

#### `sinh(x: f64) -> f64`
Hyperbolic sine.

#### `cosh(x: f64) -> f64`
Hyperbolic cosine.

#### `tanh(x: f64) -> f64`
Hyperbolic tangent.

## Implementation Notes

- All functions are imported from the `env` module
- Math functions are required when Odin code uses corresponding `math` package procedures
- Runtime functions handle operations that WebAssembly cannot perform natively
- The host environment must provide these implementations for Odin WASM modules to function correctly

## Reference Implementation

See the [thetarnav/odin-wasm](https://github.com/thetarnav/odin-wasm) repository for the authoritative implementation of these environment functions.

## Usage in TypeScript/Deno

```typescript
class OdinRuntime {
  constructor(memory: WebAssembly.Memory) {
    this.env = {
      // Core runtime functions
      write: (fd: number, ptr: number, len: number) => { /* implementation */ },
      trap: () => { throw new Error("WASM trap"); },
      abort: (file_ptr: number, file_len: number, line: number, column: number) => { /* implementation */ },
      
      // Math functions
      sin: Math.sin,
      cos: Math.cos,
      sqrt: Math.sqrt,
      pow: Math.pow,
      
      // ... other functions
    };
  }
}
```
# Deno WASM API Reference

A quick reference for Deno's WebAssembly APIs.

## Loading WASM

### From File

```typescript
// Read and compile
const wasmBytes = await Deno.readFile("module.wasm");
const wasmModule = await WebAssembly.compile(wasmBytes);

// Instantiate with imports
const instance = await WebAssembly.instantiate(wasmModule, imports);
```

### From URL (Browser/Web)

```typescript
// Streaming compilation (most efficient)
const response = await fetch("module.wasm");
const wasmModule = await WebAssembly.compileStreaming(response);

// Or combined
const instance = await WebAssembly.instantiateStreaming(
  fetch("module.wasm"),
  imports
);
```

### One-Step Loading

```typescript
// Compile and instantiate together
const { module, instance } = await WebAssembly.instantiate(
  wasmBytes,
  imports
);
```

## WebAssembly.Memory

### Creating Memory

```typescript
const memory = new WebAssembly.Memory({
  initial: 1,      // Initial pages (1 page = 64KB)
  maximum: 256,    // Maximum pages (optional)
  shared: false,   // Shared memory (optional)
});
```

### Accessing Memory

```typescript
// Get the underlying buffer
const buffer: ArrayBuffer = memory.buffer;

// Create typed views
const bytes = new Uint8Array(memory.buffer);
const ints = new Int32Array(memory.buffer);
const floats = new Float64Array(memory.buffer);

// View at specific offset
const slice = new Uint8Array(memory.buffer, offset, length);

// DataView for mixed types
const view = new DataView(memory.buffer);
view.getInt32(offset, true);  // true = little-endian
view.setFloat64(offset, value, true);
```

### Growing Memory

```typescript
const oldPages = memory.grow(additionalPages);
// Returns -1 on failure

// After grow, buffer reference changes!
// Recreate all views
```

### Memory Properties

```typescript
memory.buffer.byteLength  // Total bytes
memory.buffer.byteLength / 65536  // Total pages
```

## WebAssembly.Instance

### Accessing Exports

```typescript
// Functions
const add = instance.exports.add as (a: number, b: number) => number;
const result = add(1, 2);

// Memory (if exported)
const memory = instance.exports.memory as WebAssembly.Memory;

// Globals (if exported)
const counter = instance.exports.counter as WebAssembly.Global;
counter.value;  // Read
counter.value = 42;  // Write (if mutable)

// Tables (if exported)
const table = instance.exports.table as WebAssembly.Table;
```

## Import Object Structure

```typescript
const imports = {
  env: {
    // Functions
    log: (x: number) => console.log(x),
    
    // Memory (if not exported by WASM)
    memory: new WebAssembly.Memory({ initial: 1 }),
    
    // Globals
    globalVar: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
  },
  
  // Additional namespaces
  math: {
    sin: Math.sin,
    cos: Math.cos,
  },
};
```

## WebAssembly.Global

```typescript
// Create global
const global = new WebAssembly.Global(
  { value: "i32", mutable: true },
  initialValue
);

// Access
global.value;      // Read
global.value = 42; // Write

// Value types: "i32", "i64", "f32", "f64"
```

## WebAssembly.Table

```typescript
// Create table (for function references)
const table = new WebAssembly.Table({
  initial: 10,
  maximum: 100,
  element: "anyfunc",
});

// Access
table.length;
table.get(index);
table.set(index, func);
table.grow(additionalSlots);
```

## Error Types

```typescript
try {
  // WASM operations
} catch (e) {
  if (e instanceof WebAssembly.CompileError) {
    // Invalid WASM binary
  } else if (e instanceof WebAssembly.LinkError) {
    // Import/export mismatch
  } else if (e instanceof WebAssembly.RuntimeError) {
    // Runtime trap (div by zero, out of bounds, etc.)
  }
}
```

## Validation

```typescript
// Check if bytes are valid WASM
const isValid = WebAssembly.validate(wasmBytes);
```

## Type Conversions

### JavaScript to WASM

| JavaScript | WASM |
|------------|------|
| `number` | `i32`, `f32`, `f64` |
| `bigint` | `i64` |
| `boolean` | `i32` (0 or 1) |

### WASM to JavaScript

| WASM | JavaScript |
|------|------------|
| `i32`, `f32`, `f64` | `number` |
| `i64` | `bigint` |

## Typed Array Reference

| TypedArray | Element Size | Use For |
|------------|--------------|---------|
| `Uint8Array` | 1 byte | Bytes, strings |
| `Int8Array` | 1 byte | Signed bytes |
| `Uint16Array` | 2 bytes | u16 |
| `Int16Array` | 2 bytes | i16 |
| `Uint32Array` | 4 bytes | u32 |
| `Int32Array` | 4 bytes | i32 |
| `Float32Array` | 4 bytes | f32 |
| `Float64Array` | 8 bytes | f64 |
| `BigInt64Array` | 8 bytes | i64 |
| `BigUint64Array` | 8 bytes | u64 |

## DataView Methods

```typescript
const view = new DataView(buffer);

// Reading (offset, littleEndian)
view.getInt8(offset);
view.getUint8(offset);
view.getInt16(offset, true);
view.getUint16(offset, true);
view.getInt32(offset, true);
view.getUint32(offset, true);
view.getFloat32(offset, true);
view.getFloat64(offset, true);
view.getBigInt64(offset, true);
view.getBigUint64(offset, true);

// Writing (offset, value, littleEndian)
view.setInt32(offset, value, true);
// ... etc
```

## Further Reading

- [MDN WebAssembly Documentation](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [Deno Manual](https://deno.land/manual)
- [WebAssembly Specification](https://webassembly.github.io/spec/)
# Troubleshooting Guide

Common problems and their solutions.

## Compilation Errors

### "undefined identifier"

```
Error: undefined identifier 'math'
```

**Cause**: Missing import.

**Solution**: Add the import at the top of your file:
```odin
import "core:math"
```

### "cannot export procedure with non-C calling convention"

```
Error: cannot export procedure 'my_func' with non-C calling convention
```

**Cause**: Exported functions must use C calling convention.

**Solution**: Add `"c"` to the procedure signature:
```odin
@(export)
my_func :: proc "c" () {  // Note the "c"
    // ...
}
```

### "invalid target"

```
Error: invalid target 'wasm32'
```

**Cause**: Wrong target name.

**Solution**: Use the correct target:
```bash
odin build . -target:js_wasm32
```

## Link Errors

### "LinkError: import odin_env::xyz not found"

```
LinkError: WebAssembly.instantiate(): Import #0 module="odin_env" function="sin" error: function import requires a callable
```

**Cause**: WASM module expects a function that isn't in your imports.

**Solution**: Add the missing function to your runtime:
```typescript
const imports = {
  odin_env: {
    sin: Math.sin,  // Add missing function
    // ...
  },
};
```

### "LinkError: memory import has wrong type"

**Cause**: Memory configuration mismatch.

**Solution**: Ensure memory is created with compatible settings:
```typescript
const memory = new WebAssembly.Memory({
  initial: 1,
  maximum: 256,
});
```

## Runtime Errors

### "RuntimeError: unreachable executed"

**Cause**: Code hit an unreachable instruction. Common causes:
- Assertion failure
- Panic
- Unhandled switch case
- Explicit `unreachable()` call

**Solution**: Check your Odin code for:
- Failed assertions
- Panic calls
- Missing switch cases

Add logging to narrow down the location.

### "RuntimeError: out of bounds memory access"

**Cause**: Reading or writing outside allocated memory.

**Solution**: 
1. Check array indices
2. Verify pointer arithmetic
3. Ensure buffers are large enough
4. Check for off-by-one errors

```typescript
// Add bounds checking
if (ptr < 0 || ptr + len > memory.buffer.byteLength) {
  throw new Error(`Out of bounds: ${ptr} + ${len}`);
}
```

### "RuntimeError: call stack exhausted"

**Cause**: Stack overflow from deep recursion.

**Solution**:
1. Check for infinite recursion
2. Convert recursive algorithms to iterative
3. Reduce recursion depth

### "TypeError: Cannot read properties of undefined"

**Cause**: Accessing an export that doesn't exist.

**Solution**: 
1. Verify the function is exported in Odin (`@(export)`)
2. Check the exact function name (case-sensitive)
3. Rebuild the WASM module

```typescript
// Debug: list all exports
console.log(Object.keys(instance.exports));
```

## Memory Issues

### "RangeError: Invalid typed array length"

**Cause**: Trying to create a view larger than available memory.

**Solution**: Check memory size before creating views:
```typescript
const available = memory.buffer.byteLength;
if (offset + length > available) {
  throw new Error(`Need ${offset + length} bytes, have ${available}`);
}
```

### Detached ArrayBuffer

```
TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer
```

**Cause**: Memory grew, invalidating existing views.

**Solution**: Recreate views after any operation that might grow memory:
```typescript
memory.grow(1);
// Old views are now invalid!
bytes = new Uint8Array(memory.buffer);  // Create new view
```

### Memory Leak

**Symptoms**: Memory usage grows over time.

**Cause**: Allocating without freeing.

**Solution**:
1. Track allocations
2. Ensure every `allocate` has a matching `deallocate`
3. Use arenas for batch operations

## Performance Issues

### Slow Execution

**Possible causes**:
1. Too many boundary crossings
2. Unoptimized build
3. Inefficient algorithm

**Solutions**:
1. Move loops inside WASM
2. Build with `-o:speed`
3. Profile to find bottlenecks

### Large Bundle Size

**Cause**: Debug builds include extra information.

**Solutions**:
1. Build with `-o:size`
2. Compress the WASM file (gzip/brotli)

## Build Issues

### "Permission denied" on build.sh

**Solution**:
```bash
chmod +x build.sh
```

### WASM file not updating

**Cause**: Build failed silently or wrong output path.

**Solution**:
1. Check build output for errors
2. Verify `-out:` path matches what you're loading
3. Delete old WASM file and rebuild

### Tests pass locally but fail in CI

**Possible causes**:
1. Different Odin/Deno versions
2. Missing dependencies
3. Path issues

**Solutions**:
1. Pin versions in CI
2. Use absolute paths
3. Check CI logs carefully

## Debugging Tips

### Print from WASM

Ensure your runtime's `write` function works:
```typescript
write(fd: number, ptr: number, len: number): number {
  const text = new TextDecoder().decode(
    new Uint8Array(this.memory.buffer, ptr, len)
  );
  console.log("[WASM]", text);
  return len;
}
```

### Hex Dump Memory

```typescript
function hexDump(memory: WebAssembly.Memory, start: number, len: number) {
  const bytes = new Uint8Array(memory.buffer, start, len);
  console.log(Array.from(bytes).map(b => 
    b.toString(16).padStart(2, '0')
  ).join(' '));
}
```

### List Exports

```typescript
console.log("Exports:", Object.keys(instance.exports));
```

### Check Memory Size

```typescript
console.log(`Memory: ${memory.buffer.byteLength} bytes`);
```

## Getting Help

If you're stuck:

1. Check the error message carefully
2. Search the Odin Discord/forums
3. Check Deno's GitHub issues
4. Create a minimal reproduction case
5. Ask with specific details about what you tried
# Resources

Links to documentation, tools, and community resources.

## Official Documentation

### Odin
- [Odin Language Website](https://odin-lang.org/)
- [Odin Language Specification](https://odin-lang.org/docs/spec/)
- [Odin Overview](https://odin-lang.org/docs/overview/)
- [Core Library Documentation](https://pkg.odin-lang.org/core/)
- [Odin GitHub Repository](https://github.com/odin-lang/Odin)

### Deno
- [Deno Manual](https://deno.land/manual)
- [Deno Standard Library](https://deno.land/std)
- [Deno API Reference](https://deno.land/api)
- [Deno GitHub Repository](https://github.com/denoland/deno)

### WebAssembly
- [WebAssembly.org](https://webassembly.org/)
- [WebAssembly Specification](https://webassembly.github.io/spec/)
- [MDN WebAssembly Guide](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [WebAssembly Feature Extensions](https://webassembly.org/roadmap/)

## Tools

### Development
- [WABT (WebAssembly Binary Toolkit)](https://github.com/WebAssembly/wabt) — Tools for working with WASM binaries
- [wasm2wat](https://webassembly.github.io/wabt/demo/wasm2wat/) — Online WASM to text converter
- [Binaryen](https://github.com/WebAssembly/binaryen) — Compiler infrastructure and toolchain

### Debugging
- [Chrome DevTools WASM Debugging](https://developer.chrome.com/docs/devtools/wasm/)
- [Firefox WASM Debugging](https://developer.mozilla.org/en-US/docs/Tools/Debugger)

### Performance
- [WebAssembly Studio](https://webassembly.studio/) — Online IDE for WASM development
- [Perfetto](https://perfetto.dev/) — Performance tracing

## Community

### Odin
- [Odin Discord](https://discord.gg/odin-lang) — Active community chat
- [Odin Subreddit](https://www.reddit.com/r/odinlang/)
- [Odin GitHub Discussions](https://github.com/odin-lang/Odin/discussions)

### Deno
- [Deno Discord](https://discord.gg/deno)
- [Deno Subreddit](https://www.reddit.com/r/Deno/)
- [Deno GitHub Discussions](https://github.com/denoland/deno/discussions)

### WebAssembly
- [WebAssembly Discord](https://discord.gg/webassembly)
- [WebAssembly Community Group](https://www.w3.org/community/webassembly/)

## Learning Resources

### Articles
- [Lin Clark's WebAssembly Articles](https://hacks.mozilla.org/author/lclarkmozilla-com/) — Excellent visual explanations
- [Surma's WebAssembly Posts](https://surma.dev/) — Practical WASM tutorials

### Books
- [WebAssembly: The Definitive Guide](https://www.oreilly.com/library/view/webassembly-the-definitive/9781492089834/) — Comprehensive WASM reference

### Videos
- [WebAssembly Summit](https://www.youtube.com/c/WebAssemblySummit) — Conference talks
- [Odin Programming Language](https://www.youtube.com/c/GingerBill) — Odin creator's channel

## Example Repositories

- [Foundation Example](../examples/foundation/) — This book's reference implementation
- [Odin Examples](https://github.com/odin-lang/examples) — Official Odin examples
- [Made With WebAssembly](https://madewithwebassembly.com/) — Showcase of WASM projects

## Specifications and Standards

- [WebAssembly Core Specification](https://www.w3.org/TR/wasm-core-1/)
- [WebAssembly JavaScript Interface](https://www.w3.org/TR/wasm-js-api-1/)
- [WebAssembly Web API](https://www.w3.org/TR/wasm-web-api-1/)

## Stay Updated

- [WebAssembly Weekly](https://wasmweekly.news/) — Weekly newsletter
- [Odin Blog](https://odin-lang.org/news/) — Language updates
- [Deno Blog](https://deno.com/blog) — Runtime updates
