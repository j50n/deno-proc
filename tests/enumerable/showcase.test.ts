import { enumerate } from "../../mod3.ts";
import { assertEquals } from "../deps/asserts.ts";
import { fromFileUrl } from "../deps/path.ts";

Deno.test({
  name: "I can count the words in a file, shorthand version.",
  async fn() {
    const file = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    );

    const buffer = true;

    const count = await enumerate(file.readable)
      .run("gunzip")
      .run("grep", "-oE", "(\\w|')+").chunkedLines
      .map((lines) => {
        const result: string[] = [];
        for (const line of lines) {
          result.push(line.toLocaleLowerCase());
        }
        return result;
      })
      .run({ buffer }, "sort")
      .run("uniq")
      .lines
      .reduce(0, (c, _item) => c + 1);

    assertEquals(
      count,
      17557,
      "The words I count match the value I believe I should get.",
    );
  },
});
