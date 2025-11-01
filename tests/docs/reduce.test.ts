import { assertEquals, assertRejects } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { range } from "../../src/utility.ts";

// ============================================================================
// Comprehensive reduce() tests matching JavaScript Array.reduce() behavior
// ============================================================================

Deno.test("reduce - basic sum with initial value", async () => {
  const result = await range({ from: 1, until: 5 })
    .reduce((acc, n) => acc + n, 0);
  assertEquals(result, 15); // 0 + 1 + 2 + 3 + 4 + 5
});

Deno.test("reduce - basic sum without initial value", async () => {
  const result = await range({ from: 1, until: 5 })
    .reduce((acc, n) => acc + n);
  assertEquals(result, 15); // 1 + 2 + 3 + 4 + 5
});

Deno.test("reduce - empty array with initial value returns initial", async () => {
  const result = await enumerate<number>([])
    .reduce((acc, n) => acc + n, 42);
  assertEquals(result, 42);
});

Deno.test("reduce - empty array without initial value throws", async () => {
  await assertRejects(
    async () => {
      await enumerate<number>([]).reduce((acc, n) => acc + n);
    },
    TypeError,
    "empty iterator",
  );
});

Deno.test("reduce - single element without initial value returns element", async () => {
  const result = await enumerate([5]).reduce((acc, n) => acc + n);
  assertEquals(result, 5);
});

Deno.test("reduce - single element with initial value calls callback", async () => {
  let callCount = 0;
  const result = await enumerate([5]).reduce((acc, n) => {
    callCount++;
    return acc + n;
  }, 10);
  assertEquals(result, 15);
  assertEquals(callCount, 1);
});

Deno.test("reduce - index parameter starts at 0 with initial value", async () => {
  const indices: number[] = [];
  await range({ to: 3 }).reduce((acc, n, index) => {
    indices.push(index);
    return acc + n;
  }, 0);
  assertEquals(indices, [0, 1, 2]);
});

Deno.test("reduce - index parameter starts at 1 without initial value", async () => {
  const indices: number[] = [];
  await range({ to: 3 }).reduce((acc, n, index) => {
    indices.push(index);
    return acc + n;
  });
  assertEquals(indices, [1, 2]); // First element used as initial, so starts at index 1
});

Deno.test("reduce - accumulator type differs from element type", async () => {
  const result = await enumerate(["a", "b", "c"])
    .reduce((acc, str) => acc + str.length, 0);
  assertEquals(result, 3); // 0 + 1 + 1 + 1
});

Deno.test("reduce - building object from array", async () => {
  const result = await enumerate([
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ] as [string, number][])
    .reduce((acc, [key, val]) => {
      acc[key] = val;
      return acc;
    }, {} as Record<string, number>);

  assertEquals(result, { a: 1, b: 2, c: 3 });
});

Deno.test("reduce - flattening arrays", async () => {
  const result = await enumerate([[1, 2], [3, 4], [5]])
    .reduce((acc, arr) => acc.concat(arr), [] as number[]);
  assertEquals(result, [1, 2, 3, 4, 5]);
});

Deno.test("reduce - counting occurrences", async () => {
  const result = await enumerate(["a", "b", "a", "c", "a", "b"])
    .reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  assertEquals(result, { a: 3, b: 2, c: 1 });
});

Deno.test("reduce - max value", async () => {
  const result = await enumerate([3, 1, 4, 1, 5, 9, 2, 6])
    .reduce((max, n) => n > max ? n : max);
  assertEquals(result, 9);
});

Deno.test("reduce - async reducer function", async () => {
  const result = await range({ to: 3 })
    .reduce(async (acc, n) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return acc + n;
    }, 0);
  assertEquals(result, 3); // 0 + 0 + 1 + 2
});

Deno.test("reduce - initial value of 0 (falsy) is used", async () => {
  const result = await enumerate([1, 2, 3])
    .reduce((acc, n) => acc + n, 0);
  assertEquals(result, 6);
});

Deno.test("reduce - initial value of empty string (falsy) is used", async () => {
  const result = await enumerate(["a", "b", "c"])
    .reduce((acc, s) => acc + s, "");
  assertEquals(result, "abc");
});

Deno.test("reduce - initial value of false (falsy) is used", async () => {
  const result = await enumerate([true, false, true])
    .reduce((acc, b) => acc || b, false);
  assertEquals(result, true);
});
