import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";

// Create an async iterator that tracks cleanup
async function* trackedAsyncIterator(count: number, cleanupTracker: { called: boolean }) {
  try {
    for (let i = 0; i < count; i++) {
      yield i;
    }
  } finally {
    cleanupTracker.called = true;
  }
}

Deno.test("zip - cleans up longer iterator when shorter finishes", async () => {
  const cleanupA = { called: false };
  const cleanupB = { called: false };
  
  const a = enumerate(trackedAsyncIterator(2, cleanupA));  // shorter
  const b = enumerate(trackedAsyncIterator(5, cleanupB));  // longer
  
  const result = await a.zip(b).collect();
  assertEquals(result, [[0, 0], [1, 1]]);
  
  // Both iterators should have their cleanup called
  assertEquals(cleanupA.called, true, "Iterator A cleanup should be called");
  assertEquals(cleanupB.called, true, "Iterator B cleanup should be called");
});
