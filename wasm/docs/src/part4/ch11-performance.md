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

**Choose the right target:**
- `freestanding_wasm32`: ~2KB for simple modules
- `js_wasm32`: ~30KB+ (includes runtime)

**Strip debug info:**
```bash
odin build . -target:js_wasm32 -o:size  # Strips by default in release
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
