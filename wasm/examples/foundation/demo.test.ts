/**
 * @fileoverview Test suite for Demo WebAssembly integration
 */

import { assertAlmostEquals, assertEquals } from "@std/assert";
import { Demo } from "./demo.ts";

/**
 * Test basic Demo instantiation
 */
Deno.test("Demo - Basic instantiation", async () => {
  const demo = await Demo.create();
  assertEquals(demo.fibonacci(5), 5);
});

/**
 * Test circle area calculation accuracy
 */
Deno.test("Demo - Circle area calculation", async () => {
  const demo = await Demo.create();

  const result = demo.calculateCircle(5.0);
  const expected = Math.PI * 5 * 5; // π * r²

  assertAlmostEquals(result, expected, 0.01);
});

/**
 * Test Fibonacci sequence calculation for various inputs
 */
Deno.test("Demo - Fibonacci calculation", async () => {
  const demo = await Demo.create();

  assertEquals(demo.fibonacci(0), 0);
  assertEquals(demo.fibonacci(1), 1);
  assertEquals(demo.fibonacci(10), 55);
  assertEquals(demo.fibonacci(15), 610);
});

/**
 * Test that multiple WASM instances work independently
 */
Deno.test("Demo - Multiple instances isolation", async () => {
  const demo1 = await Demo.create();
  const demo2 = await Demo.create();

  // Both should work independently
  const result1 = demo1.calculateCircle(3.0);
  const result2 = demo2.fibonacci(8);

  assertAlmostEquals(result1, Math.PI * 9, 0.01);
  assertEquals(result2, 21);
});

/**
 * Test string handling between TypeScript and WASM
 */
Deno.test("Demo - String handling", async () => {
  const demo = await Demo.create();

  const name = "World";
  const expectedLength = demo.greetUser(name);

  // "Hello, World!" = 13 characters
  assertEquals(expectedLength, 13);
});

/**
 * Test memory allocation functionality and memory growth
 */
Deno.test("Demo - Memory allocation test", async () => {
  const demo = await Demo.create();

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

/**
 * Test printString - passing strings to Odin
 */
Deno.test("Demo - printString", async () => {
  const demo = await Demo.create();

  const len1 = demo.printString("Hello");
  assertEquals(len1, 5);

  // UTF-8: emoji is 4 bytes
  const len2 = demo.printString("🎉");
  assertEquals(len2, 4);
});

/**
 * Test createGreeting - dynamic string return from Odin
 */
Deno.test("Demo - createGreeting", async () => {
  const demo = await Demo.create();

  const greeting = demo.createGreeting("World");
  assertEquals(greeting, "Hello, World!");

  // UTF-8 in name
  const greeting2 = demo.createGreeting("🚀");
  assertEquals(greeting2, "Hello, 🚀!");
});

/**
 * Test createPoint - struct return via explicit pointer
 */
Deno.test("Demo - createPoint", async () => {
  const demo = await Demo.create();

  const p = demo.createPoint(3.5, -7.2);
  assertAlmostEquals(p.x, 3.5, 0.001);
  assertAlmostEquals(p.y, -7.2, 0.001);
});

/**
 * Test makePoint - struct return by value (hidden out-parameter)
 */
Deno.test("Demo - makePoint", async () => {
  const demo = await Demo.create();

  const p = demo.makePoint(-1.0, 2.5);
  assertAlmostEquals(p.x, -1.0, 0.001);
  assertAlmostEquals(p.y, 2.5, 0.001);
});
