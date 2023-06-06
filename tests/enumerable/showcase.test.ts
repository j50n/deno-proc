import { enumerate, toLines } from "../../mod3.ts";
import { assertEquals } from "../deps/asserts.ts";
import { fromFileUrl } from "../deps/path.ts";

Deno.test({
  name: "I can count the words in a file, shorthand version.",
  async fn() {
    const file = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    );

    const output = await enumerate(file.readable)
      .run("gunzip")
      .run("grep", "-oE", "(\\w|')+")
      .run("tr", "[:upper:]", "[:lower:]")
      .run("sort")
      .run("uniq")
      .run("wc", "-l")
      .transform(toLines)
      .flatten()
      .map((it) => parseInt(it, 10))
      .collect();

    assertEquals(
      output[0],
      17558,
      "The words I count match the value I believe I should get.",
    );
  },
});
