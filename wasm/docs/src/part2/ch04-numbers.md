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
