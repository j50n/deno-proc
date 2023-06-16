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

// Deno.test({
//   name: "Another way to filter empty lines. Not necessarily better.",
//   async fn() {
//     const lf = new TextEncoder().encode("\n");

//     await read(fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")))
//       .transform(gunzip)
//       .transform(toByteLines)
//       .flatten()
//       .filterNot((line) => line.length === 0)
//       .flatMap((line) => [line, lf])
//       .transform(buffer())
//       .writeTo(Deno.stdout.writable, { noclose: true });
//   },
// });
