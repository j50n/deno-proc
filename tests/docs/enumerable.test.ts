import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { range } from "../../src/utility.ts";

Deno.test("enumerate - convert array to AsyncIterable", async () => {
  const result = await enumerate([1, 2, 3]).collect();
  assertEquals(result, [1, 2, 3]);
});

Deno.test("enumerate - with for await", async () => {
  const results: number[] = [];
  for await (const n of enumerate([1, 2, 3])) {
    results.push(n);
  }
  assertEquals(results, [1, 2, 3]);
});

Deno.test("filter - keep matching items", async () => {
  const result = await range({ to: 5 })
    .filter((n) => n % 2 === 0)
    .collect();
  assertEquals(result, [0, 2, 4]);
});

Deno.test("reduce - sum numbers", async () => {
  const sum = await range({ from: 1, until: 5 })
    .reduce((acc, n) => acc + n, 0);
  assertEquals(sum, 15);
});

Deno.test("take - first n items", async () => {
  const result = await range({ to: 10 })
    .take(3)
    .collect();
  assertEquals(result, [0, 1, 2]);
});

Deno.test("drop - skip first n items", async () => {
  const result = await range({ to: 5 })
    .drop(2)
    .collect();
  assertEquals(result, [2, 3, 4]);
});

Deno.test("first - get first item", async () => {
  const result = await range({ from: 5, to: 10 }).first;
  assertEquals(result, 5);
});

Deno.test("find - locate matching item", async () => {
  const result = await range({ to: 10 })
    .find((n) => n > 5);
  assertEquals(result, 6);
});

Deno.test("every - test all items", async () => {
  const allPositive = await range({ from: 1, to: 5 })
    .every((n) => n > 0);
  assertEquals(allPositive, true);
});

Deno.test("some - test any item", async () => {
  const hasEven = await range({ to: 5 })
    .some((n) => n % 2 === 0);
  assertEquals(hasEven, true);
});

Deno.test("flatMap - map and flatten", async () => {
  const result = await enumerate([1, 2, 3])
    .flatMap((n) => [n, n * 10])
    .collect();
  assertEquals(result, [1, 10, 2, 20, 3, 30]);
});

Deno.test("concat - join iterables", async () => {
  const result = await enumerate([1, 2])
    .concat(enumerate([3, 4]))
    .collect();
  assertEquals(result, [1, 2, 3, 4]);
});

Deno.test("tee - split into multiple streams", async () => {
  const [a, b] = range({ to: 3 }).tee();

  const resultA = await a.collect();
  const resultB = await b.collect();

  assertEquals(resultA, [0, 1, 2]);
  assertEquals(resultB, [0, 1, 2]);
});
