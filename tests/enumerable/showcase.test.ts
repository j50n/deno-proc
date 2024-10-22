import { gunzip, read } from "../../mod.ts";
import { assertEquals } from "../deps/asserts.ts";
import { fromFileUrl } from "../deps/path.ts";

Deno.test({
  name:
    "I can count the words in a file two different ways (tee), shorthand version.",
  async fn() {
    const [words1, words2] = read(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    )
      .transform(gunzip)
      .lines
      .map((line) => line.toLocaleLowerCase())
      .run({ buffer: true }, "grep", "-oE", "(\\w|')+")
      .tee();

    const [uniqueWords, totalWords] = await Promise.all([
      words1.run("sort").run("uniq").lines.count(),
      words2.lines.count(),
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
