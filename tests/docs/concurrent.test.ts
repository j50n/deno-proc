import { assertEquals } from "@std/assert";
import { range } from "../../src/utility.ts";

Deno.test("concurrentMap - ordered results", async () => {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const result = await range({ to: 3 })
    .concurrentMap(async (n) => {
      await delay(10 - n * 3); // Later items finish faster
      return n * 2;
    }, { concurrency: 2 })
    .collect();

  // Results are in original order despite concurrent execution
  assertEquals(result, [0, 2, 4]);
});

Deno.test("concurrentUnorderedMap - unordered results", async () => {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const result = await range({ to: 3 })
    .concurrentUnorderedMap(async (n) => {
      await delay(10 - n * 3); // Later items finish faster
      return n * 2;
    }, { concurrency: 2 })
    .collect();

  // Results may be out of order, but all present
  assertEquals(result.sort(), [0, 2, 4]);
});

Deno.test("concurrentMap - respects concurrency limit", async () => {
  let concurrent = 0;
  let maxConcurrent = 0;

  await range({ to: 10 })
    .concurrentMap(async (n) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      concurrent--;
      return n;
    }, { concurrency: 3 })
    .collect();

  assertEquals(maxConcurrent, 3);
});
