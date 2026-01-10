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

Build with `--import-memory` to allow JavaScript to create and manage memory:

```bash
odin build main.odin -file -target:js_wasm32 \
    -extra-linker-flags:"--import-memory --strip-all"
```

Then instantiate:

```typescript
class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  get env(): Record<string, WebAssembly.ImportValue> {
    return {
      write: this.write.bind(this),
      trap: this.trap.bind(this),
      abort: this.abort.bind(this),
      sin: Math.sin,
      cos: Math.cos,
      // ... other functions
    };
  }

  write(fd: number, ptr: number, len: number): number {
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    const text = new TextDecoder().decode(bytes);
    if (fd === 1) console.log(text);
    else if (fd === 2) console.error(text);
    return len;
  }

  trap(): never { throw new Error("WASM trap"); }
  abort(): never { throw new Error("WASM abort"); }
}

// Usage
const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
const runtime = new OdinRuntime(memory);

const instance = await WebAssembly.instantiate(wasmModule, {
  env: { memory },
  odin_env: runtime.env,
});
```
