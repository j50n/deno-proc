import { enumerate, range } from "../../mod.ts";
import { assertEquals } from "jsr:@std/assert@1.0.13";

Deno.test({
  name: "Unzip something",
  async fn() {
    const a = range({ from: 1, until: 3 });
    const b = enumerate(["A", "B", "C"]);

    const result = a.zip(b);

    const [origA, origB] = result.unzip();

    assertEquals(
      await origA.collect(),
      await range({ from: 1, until: 3 }).collect(),
      "I can extract the original from the zipped version, left.",
    );
    assertEquals(
      await origB.collect(),
      await enumerate(["A", "B", "C"]).collect(),
      "I can extract the original from the zipped version, right.",
    );
  },
});
