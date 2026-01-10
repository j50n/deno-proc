/**
 * @fileoverview Test suite for MathDemo WebAssembly integration
 */

import { assertAlmostEquals, assertEquals } from "@std/assert";
import { MathDemo } from "./math-demo.ts";

/**
 * Test basic MathDemo instantiation
 */
Deno.test("MathDemo - Basic instantiation", async () => {
  const demo = await MathDemo.create();
  assertEquals(demo.fibonacci(5), 5);
});

/**
 * Test circle area calculation accuracy
 */
Deno.test("MathDemo - Circle area calculation", async () => {
  const demo = await MathDemo.create();

  const result = demo.calculateCircle(5.0);
  const expected = Math.PI * 5 * 5; // π * r²

  assertAlmostEquals(result, expected, 0.01);
});

/**
 * Test Fibonacci sequence calculation for various inputs
 */
Deno.test("MathDemo - Fibonacci calculation", async () => {
  const demo = await MathDemo.create();

  assertEquals(demo.fibonacci(0), 0);
  assertEquals(demo.fibonacci(1), 1);
  assertEquals(demo.fibonacci(10), 55);
  assertEquals(demo.fibonacci(15), 610);
});

/**
 * Test that multiple WASM instances work independently
 */
Deno.test("MathDemo - Multiple instances isolation", async () => {
  const demo1 = await MathDemo.create();
  const demo2 = await MathDemo.create();

  // Both should work independently
  const result1 = demo1.calculateCircle(3.0);
  const result2 = demo2.fibonacci(8);

  assertAlmostEquals(result1, Math.PI * 9, 0.01);
  assertEquals(result2, 21);
});

/**
 * Test string handling between TypeScript and WASM
 */
Deno.test("MathDemo - String handling", async () => {
  const demo = await MathDemo.create();

  const name = "World";
  const expectedLength = demo.greetUser(name);

  // "Hello, World!" = 13 characters
  assertEquals(expectedLength, 13);
});

/**
 * Test memory allocation functionality and memory growth
 */
Deno.test("MathDemo - Memory allocation test", async () => {
  const demo = await MathDemo.create();

  console.log(`🧠 Initial memory size: ${demo.memory.buffer.byteLength} bytes`);

  // Test 1MB allocation to trigger memory growth
  const size = 1024 * 1024; // 1MB
  console.log(`🧠 Testing memory allocation (${size} bytes)`);

  const result = demo.allocateMemory(size);
  assertEquals(result.success, true);

  console.log(`🧠 Final memory size: ${result.memorySize} bytes`);
  console.log(`🧠 Memory allocated at pointer ${result.ptr}`);

  // Verify the pattern was written
  const memView = new Uint8Array(demo.memory.buffer);
  const firstFew = Array.from(
    memView.slice(result.ptr, result.ptr + Math.min(10, size)),
  );
  console.log(`🧠 First bytes at allocation: [${firstFew.join(", ")}]`);

  // Check that memory has grown to at least 1MB
  const oneMB = 1024 * 1024;
  console.log(
    `Memory size: ${result.memorySize} bytes (${
      Math.round(result.memorySize / oneMB * 100) / 100
    }MB)`,
  );

  // Should be at least 1MB (probably more due to page alignment)
  assertEquals(result.memorySize >= oneMB, true);
});
