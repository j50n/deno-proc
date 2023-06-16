import { enumerate, gunzip, toLines } from "../../mod3.ts";
import { assertEquals } from "../deps/asserts.ts";
import { fromFileUrl } from "../deps/path.ts";

Deno.test({
  name:
    "I can count the words in a file two different ways (tee), shorthand version.",
  async fn() {
    const file = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    );

    const [words1, words2] = enumerate(file.readable)
      .transform(gunzip)
      .transform(toLines)
      .map((line) => line.toLocaleLowerCase())
      .run({ buffer: true }, "grep", "-oE", "(\\w|')+")
      .tee();

    const [uniqueWords, totalWords] = await Promise.all([
      words1.run("sort").run("uniq").run("wc", "-l").lines.map((n) =>
        parseInt(n, 10)
      ).first,
      words2.run("wc", "-l").lines.map((n) => parseInt(n, 10)).first,
    ]);

    console.log(`Total: ${totalWords.toLocaleString()}`);
    console.log(`Unique: ${uniqueWords.toLocaleString()}`);

    assertEquals(
      uniqueWords,
      17_557,
      "Unique words.",
    );

    assertEquals(
      totalWords,
      572_642,
      "Total words.",
    );
  },
});
