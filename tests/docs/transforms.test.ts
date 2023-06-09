import { enumerate } from "../../mod3.ts";
import { assertEquals } from "../deps/asserts.ts";

async function* toLower(texts: AsyncIterable<string>) {
  for await (const text of texts) {
    yield text.toLocaleLowerCase();
  }
}

Deno.test({
  name: "I can transform text to lower-case using a custom transformer.",
  async fn() {
    const lowered = await enumerate(["A", "B", "C"])
      .transform(toLower)
      .collect();

    console.dir(lowered);

    assertEquals(lowered, ["a", "b", "c"], "Transformed to lower-case.");
  },
});
