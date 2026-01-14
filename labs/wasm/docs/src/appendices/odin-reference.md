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
