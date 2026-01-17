/**
 * Tests for async predicates in enumerable methods.
 * These tests verify that methods properly await async predicate functions.
 */
import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";

// Helper: async predicate that returns true after a delay
const _asyncTrue = async () => {
  await new Promise((r) => setTimeout(r, 10));
  return true;
};

// Helper: async predicate that returns false after a delay
const _asyncFalse = async () => {
  await new Promise((r) => setTimeout(r, 10));
  return false;
};

Deno.test("every - with async predicate returning true", async () => {
  const result = await enumerate([1, 2, 3]).every(async (n) => {
    await new Promise((r) => setTimeout(r, 10));
    return n > 0;
  });
  assertEquals(result, true);
});

Deno.test("every - with async predicate returning false", async () => {
  const result = await enumerate([1, 2, 3]).every(async (n) => {
    await new Promise((r) => setTimeout(r, 10));
    return n > 2; // Only 3 passes
  });
  assertEquals(result, false);
});

Deno.test("some - with async predicate returning true", async () => {
  const result = await enumerate([1, 2, 3]).some(async (n) => {
    await new Promise((r) => setTimeout(r, 10));
    return n === 2;
  });
  assertEquals(result, true);
});

Deno.test("some - with async predicate returning false", async () => {
  const result = await enumerate([1, 2, 3]).some(async (n) => {
    await new Promise((r) => setTimeout(r, 10));
    return n > 10;
  });
  assertEquals(result, false);
});

Deno.test("count - with async filter predicate", async () => {
  const result = await enumerate([1, 2, 3, 4, 5]).count(async (n) => {
    await new Promise((r) => setTimeout(r, 10));
    return n % 2 === 0; // Count evens: 2, 4
  });
  assertEquals(result, 2);
});

Deno.test("forEach - awaits final async callback", async () => {
  const results: number[] = [];
  await enumerate([1, 2, 3]).forEach(async (n) => {
    await new Promise((r) => setTimeout(r, 10));
    results.push(n);
  });
  // If forEach doesn't await the last callback, results might be incomplete
  assertEquals(results, [1, 2, 3]);
});
