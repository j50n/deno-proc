# Testing WASM Integration

WASM errors are cryptic. Tests are your safety net.

## The Essential Tests

Start with instantiation—if this fails, nothing else matters:

```typescript
import { assertEquals, assertAlmostEquals } from "@std/assert";
import { Demo } from "./demo.ts";

Deno.test("Demo - instantiation", async () => {
  const demo = await Demo.create();
  assertEquals(demo.fibonacci(5), 5);
});
```

This catches corrupted WASM files, missing imports, and runtime initialization failures.

## Floating-Point Tolerance

WASM and JavaScript both follow IEEE 754, but implementation details can cause tiny differences. Use `assertAlmostEquals`:

```typescript
Deno.test("Demo - circle calculation", async () => {
  const demo = await Demo.create();
  
  const result = demo.calculateCircle(5.0);
  assertAlmostEquals(result, Math.PI * 25, 1e-10);
});
```

Exact equality checks will fail spuriously.

## Instance Isolation

WASM instances should be independent. Verify this:

```typescript
Deno.test("Demo - instance isolation", async () => {
  const demo1 = await Demo.create();
  const demo2 = await Demo.create();
  
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
Deno.test("Demo - edge cases", async () => {
  const demo = await Demo.create();
  
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
Deno.test("Demo - memory allocation", async () => {
  const demo = await Demo.create();
  
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

odin build odin/ -target:js_wasm32 -out:demo.wasm -o:speed \
    -extra-linker-flags:"--import-memory --strip-all"
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
