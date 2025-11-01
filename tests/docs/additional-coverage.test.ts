import { assertEquals, assertRejects } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { range } from "../../src/utility.ts";
import { toBytes } from "../../src/transformers.ts";

// ============================================================================
// Concurrent Error Handling Tests
// ============================================================================

Deno.test("concurrentMap - handles errors in mapFn", async () => {
  await assertRejects(
    async () => {
      await range({ to: 5 })
        .concurrentMap(async (n) => {
          if (n === 2) throw new Error("test error");
          return n * 2;
        })
        .collect();
    },
    Error,
    "test error",
  );
});

Deno.test("concurrentUnorderedMap - handles errors in mapFn", async () => {
  await assertRejects(
    async () => {
      await range({ to: 5 })
        .concurrentUnorderedMap(async (n) => {
          if (n === 2) throw new Error("test error");
          return n * 2;
        })
        .collect();
    },
    Error,
    "test error",
  );
});

Deno.test("concurrentMap - empty iterable", async () => {
  const result = await enumerate([])
    .concurrentMap(async (n: number) => n * 2)
    .collect();
  assertEquals(result, []);
});

Deno.test("concurrentMap - single item", async () => {
  const result = await enumerate([5])
    .concurrentMap(async (n) => n * 2)
    .collect();
  assertEquals(result, [10]);
});

// ============================================================================
// Enumerable Edge Cases
// ============================================================================

Deno.test("enumerate - null input", async () => {
  const result = await enumerate(null).collect();
  assertEquals(result, []);
});

Deno.test("enumerate - undefined input", async () => {
  const result = await enumerate(undefined).collect();
  assertEquals(result, []);
});

Deno.test("filter - empty result", async () => {
  const result = await range({ to: 5 })
    .filter((n) => n > 10)
    .collect();
  assertEquals(result, []);
});

Deno.test("map - empty iterable", async () => {
  const result = await enumerate([])
    .map((n: number) => n * 2)
    .collect();
  assertEquals(result, []);
});

Deno.test("reduce - empty iterable with initial value returns initial", async () => {
  const result = await enumerate<number>([])
    .reduce((acc, n) => acc + n, 0);
  assertEquals(result, 0);
});

Deno.test("reduce - empty iterable without initial value throws", async () => {
  await assertRejects(
    async () => {
      await enumerate<number>([]).reduce((acc, n) => acc + n);
    },
    TypeError,
    "empty iterator",
  );
});

Deno.test("find - no match returns undefined", async () => {
  const result = await range({ to: 5 }).find((n) => n > 10);
  assertEquals(result, undefined);
});

Deno.test("every - empty iterable returns true", async () => {
  const result = await enumerate([]).every(() => false);
  assertEquals(result, true);
});

Deno.test("some - empty iterable returns false", async () => {
  const result = await enumerate([]).some(() => true);
  assertEquals(result, false);
});

Deno.test("take - more than available", async () => {
  const result = await range({ to: 3 }).take(10).collect();
  assertEquals(result, [0, 1, 2]);
});

Deno.test("drop - more than available", async () => {
  const result = await range({ to: 3 }).drop(10).collect();
  assertEquals(result, []);
});

// ============================================================================
// Transformer Edge Cases
// ============================================================================

Deno.test("toBytes - empty string", async () => {
  const result = await enumerate([""])
    .transform(toBytes)
    .collect();
  const text = new TextDecoder().decode(result[0]);
  assertEquals(text, "\n");
});

Deno.test("toBytes - empty array", async () => {
  const result = await enumerate([[]])
    .transform(toBytes)
    .collect();
  assertEquals(result[0].length, 0);
});

Deno.test("toBytes - Uint8Array passthrough", async () => {
  const input = new Uint8Array([1, 2, 3]);
  const result = await enumerate([input])
    .transform(toBytes)
    .collect();
  assertEquals(result[0], input);
});

Deno.test("toBytes - Uint8Array array concatenation", async () => {
  const result = await enumerate([[
    new Uint8Array([1, 2]),
    new Uint8Array([3, 4]),
  ]])
    .transform(toBytes)
    .collect();
  assertEquals(result[0], new Uint8Array([1, 2, 3, 4]));
});

// ============================================================================
// WritableIterable Edge Cases
// ============================================================================

Deno.test("WritableIterable - write after close throws", async () => {
  const { WritableIterable } = await import("../../src/writable-iterable.ts");
  const writable = new WritableIterable<number>();

  await writable.close();

  await assertRejects(
    async () => {
      await writable.write(1);
    },
    Error,
    "already closed",
  );
});

Deno.test("WritableIterable - multiple close calls are safe", async () => {
  const { WritableIterable } = await import("../../src/writable-iterable.ts");
  const writable = new WritableIterable<number>();

  await writable.close();
  await writable.close(); // Should not throw
  await writable.close(); // Should not throw

  assertEquals(writable.isClosed, true);
});

Deno.test("WritableIterable - empty iteration", async () => {
  const { WritableIterable } = await import("../../src/writable-iterable.ts");
  const writable = new WritableIterable<number>();

  await writable.close();

  const result: number[] = [];
  for await (const item of writable) {
    result.push(item);
  }

  assertEquals(result, []);
});

// ============================================================================
// Zip/Unzip Edge Cases
// ============================================================================

Deno.test("zip - unequal lengths (first shorter)", async () => {
  const a = enumerate([1, 2]);
  const b = enumerate(["a", "b", "c"]);

  const result = await a.zip(b).collect();
  assertEquals(result, [[1, "a"], [2, "b"]]);
});

Deno.test("zip - unequal lengths (second shorter)", async () => {
  const a = enumerate([1, 2, 3]);
  const b = enumerate(["a", "b"]);

  const result = await a.zip(b).collect();
  assertEquals(result, [[1, "a"], [2, "b"]]);
});

Deno.test("zip - empty iterables", async () => {
  const a = enumerate([]);
  const b = enumerate([]);

  const result = await a.zip(b).collect();
  assertEquals(result, []);
});
