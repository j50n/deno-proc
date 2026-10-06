/**
 * The generator behind the seeded test data. The one before it multiplied
 * past 2^53, lost precision, and fell into a cycle of about 10,000 values, so
 * "2,000 random rows" repeated themselves.
 */

import { assert, assertEquals } from "@std/assert";
import { seededRandom } from "../transforms/reference.ts";

Deno.test("The seeded generator doesn't repeat itself over 100,000 draws.", () => {
  const random = seededRandom(7);
  const seen = new Set<number>();
  for (let i = 0; i < 100_000; i++) seen.add(random(2 ** 31));
  // Collisions by chance among 2^31 values: about 2 expected.
  assert(seen.size > 99_990, `${seen.size} distinct`);
});

Deno.test("The seeded generator gives the same draws for the same seed, in range.", () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  for (let i = 0; i < 1000; i++) {
    const n = 1 + (i % 50);
    const x = a(n);
    assertEquals(x, b(n));
    assert(Number.isInteger(x) && x >= 0 && x < n);
  }
});
