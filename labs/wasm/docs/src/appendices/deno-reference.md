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
