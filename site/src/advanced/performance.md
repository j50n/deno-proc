# Performance Characteristics

Understanding async iteration performance and how proc optimizes for real-world usage.

## The Async Iteration Overhead

Async generators create promises per iteration, which adds overhead for simple operations. **This is built into the JavaScript language and V8 engine**, not a limitation of this library:

```typescript
// Benchmark: 10,000 items
async function* double(items: AsyncIterable<number>) {
  for await (const item of items) {
    yield item * 2;
  }
}

// Results:
// Async generator: 2.7ms
// TransformStream: 40µs (67x faster)
// Raw array iteration: 39µs
```

The overhead grows with data size - at 100,000 items, the gap becomes 810x. **This is fundamental to how `for await` loops work in JavaScript**, not an implementation issue.

> **Note**: JavaScript engines continue to optimize async iteration. These performance characteristics may improve in future V8 versions.

## The V8 Optimization Cliff

**TransformStream performance has a dramatic cliff** - it looks extremely fast in microbenchmarks but can become orders of magnitude slower with minimal added complexity.

**Simple operations get heavily optimized:**
```typescript
// V8 can inline this entire pipeline
const doubleStream = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk * 2); // Becomes nearly native code
  }
});
// Result: 750x faster than generators
```

**Adding any complexity breaks optimization:**
```typescript
// Closure state prevents V8 inlining
function createRunningTotalStream() {
  let total = 0; // This breaks optimization
  return new TransformStream({
    transform(chunk, controller) {
      total += chunk;              // Closure access overhead
      controller.enqueue(total);   // Can't optimize with state
    }
  });
}
// Result: 6x slower than generators
```

**Why this happens:**
- V8 aggressively optimizes trivial TransformStream operations into native code paths
- Any closure variables, state dependencies, or complex logic breaks these optimizations
- Once optimization fails, the callback overhead makes TransformStream much slower
- Generators have consistent overhead regardless of complexity

**Practical implication:** TransformStream microbenchmarks are misleading - they show best-case performance that disappears in real-world usage.

**The bottom line:** JavaScript performance is notoriously difficult to predict. V8's aggressive optimizations can make simple code incredibly fast, but these optimizations are fragile and break easily. If performance truly matters for your use case, profile your actual workload rather than relying on synthetic benchmarks.

## The Chunking Solution

proc uses **chunking** to amortize async iteration costs by processing multiple items per iteration:

```typescript
// Instead of: 1 promise per line (expensive)
async function* inefficientLines(bytes: AsyncIterable<Uint8Array>) {
  for await (const chunk of bytes) {
    for (const line of decode(chunk).split('\n')) {
      yield line; // 1000 lines = 1000 promises
    }
  }
}

// proc does: 1 promise per chunk of lines (efficient)
export async function* toChunkedLines(bytes: AsyncIterable<Uint8Array>) {
  for await (const chunk of bytes) {
    const lines = decode(chunk).split('\n');
    if (lines.length > 0) {
      yield lines; // 1000 lines in 10 chunks = 10 promises
    }
  }
}

// Then flatten efficiently
async function* toLines(bytes: AsyncIterable<Uint8Array>) {
  for await (const lines of toChunkedLines(bytes)) {
    yield* lines; // Sync iteration within async iteration
  }
}
```

**Result**: 10x performance improvement for line processing.

## When Complexity Flips Performance

For complex operations, async generators become faster because TransformStream's callback model creates overhead:

```typescript
// Complex stateful processing
async function* processLogs(lines: AsyncIterable<string>) {
  let errorCount = 0;
  
  for await (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.level === 'error') {
        errorCount++;
        yield {
          ...entry,
          errorNumber: errorCount,
          severity: entry.message.includes('critical') ? 'high' : 'medium'
        };
      }
    } catch {
      errorCount++;
    }
  }
}

// Benchmark results (10k items):
// Async generator: 3.1ms
// TransformStream: 13.8ms (4x slower)
```

## Practical Implications

**Async generators win for real-world use cases:**
- Parsing and validation (where most errors occur)
- Multi-step transformations
- State management across items
- Error handling and recovery

**The chunking strategy makes overhead negligible** for typical data processing workloads.

**TransformStream is available** for the rare cases where simple, high-volume transformations need maximum performance, but the complexity trade-off usually isn't worth it.
