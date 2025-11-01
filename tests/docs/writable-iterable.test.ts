import { assertEquals } from "@std/assert";
import { WritableIterable } from "../../src/writable-iterable.ts";

Deno.test("WritableIterable - basic write and read", async () => {
  const writable = new WritableIterable<number>();

  // Write in background
  (async () => {
    await writable.write(1);
    await writable.write(2);
    await writable.write(3);
    await writable.close();
  })();

  // Read
  const results: number[] = [];
  for await (const item of writable) {
    results.push(item);
  }

  assertEquals(results, [1, 2, 3]);
});

Deno.test("WritableIterable - error propagation", async () => {
  const writable = new WritableIterable<number>();

  // Write and close with error
  (async () => {
    await writable.write(1);
    await writable.close(new Error("test error"));
  })();

  // Read should throw
  let errorThrown = false;
  try {
    for await (const _item of writable) {
      // Process items
    }
  } catch (e) {
    errorThrown = true;
    assertEquals((e as Error).message, "test error");
  }

  assertEquals(errorThrown, true);
});

Deno.test("WritableIterable - onclose callback", async () => {
  let closeCalled = false;

  const writable = new WritableIterable<number>({
    onclose: () => {
      closeCalled = true;
    },
  });

  await writable.write(1);
  await writable.close();

  // Consume to trigger close
  for await (const _item of writable) {
    // Process
  }

  assertEquals(closeCalled, true);
});
