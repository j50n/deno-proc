import { enumerate, range } from "../../mod3.ts";
import { assertEquals } from "../deps/asserts.ts";

Deno.test({
  name: "Two enumerables can be concatenated.",
  async fn() {
    const a = range({ until: 5 });
    const b = range({ from: 6, until: 10 });

    const result = a.concat(b);

    assertEquals(
      await result.collect(),
      await range({ until: 10 }).collect(),
      "Enumerables can be concatenated.",
    );
  },
});

Deno.test({
  name:
    "Concatenation starting with an empty and adding something works as expected.",
  async fn() {
    const a = enumerate<number>([]);
    const b = range({ from: 6, until: 10 });

    const result = a.concat(b);

    assertEquals(
      await result.collect(),
      await range({ from: 6, until: 10 }).collect(),
      "Empty enumerable can be concatenated to.",
    );
  },
});

Deno.test({
  name:
    "Concatenation starting with something and adding an empty works as expected.",
  async fn() {
    const a = range({ until: 5 });
    const b = enumerate<number>([]);

    const result = a.concat(b);

    assertEquals(
      await result.collect(),
      await range({ until: 5 }).collect(),
      "An empty enumerable can be concatenated to an enumerable.",
    );
  },
});

Deno.test({
  name: "Concatenation an empty to an empty works as expected.",
  async fn() {
    const a = enumerate<number>([]);
    const b = enumerate<number>([]);

    const result = a.concat(b);

    assertEquals(
      await result.collect(),
      await enumerate<number>([]).collect(),
      "Two empties make an empty.",
    );
  },
});
