import { enumerate, range } from "../../mod.ts";
import { assertEquals } from "@std/assert";

Deno.test({
  name: "Zip enumerables together.",
  async fn() {
    const a = range({ from: 1, until: 3 });
    const b = enumerate(["A", "B", "C"]);

    const result = a.zip(b);

    assertEquals(
      await result.collect(),
      [[1, "A"], [2, "B"], [3, "C"]],
      "Enumerables are zipped.",
    );
  },
});

Deno.test({
  name: "Zip enumerables together, longer left is truncated.",
  async fn() {
    const a = range({ from: 1, until: 5 });
    const b = enumerate(["A", "B", "C"]);

    const result = a.zip(b);

    assertEquals(
      await result.collect(),
      [[1, "A"], [2, "B"], [3, "C"]],
      "Enumerables are zipped with left truncation.",
    );
  },
});

Deno.test({
  name: "Zip enumerables together, longer right is truncated.",
  async fn() {
    const a = range({ from: 1, until: 3 });
    const b = enumerate(["A", "B", "C", "D", "E"]);

    const result = a.zip(b);

    assertEquals(
      await result.collect(),
      [[1, "A"], [2, "B"], [3, "C"]],
      "Enumerables are zipped with right truncation.",
    );
  },
});
