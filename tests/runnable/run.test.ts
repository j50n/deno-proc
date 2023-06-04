import { runnable, toLines } from "../../mod3.ts";
import { run } from "../../mod3.ts";
import { assertEquals } from "../deps/asserts.ts";
import { green } from "../deps/colors.ts";
import { fromFileUrl } from "../deps/path.ts";

Deno.test({
  name: "I can 'ls' a folder.",

  async fn() {
    await run("ls", "-la").transform(toLines).flatten().forEach((line) =>
      console.dir(green(line))
    );
  },
});

Deno.test({
  name: "I can count the words in a file, shorthand version.",
  async fn() {
    const file = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    );

    const output = await runnable(file.readable)
      .run("gunzip")
      .run("grep", "-oE", "(\\w|')+").transform(toLines)
      .map((lines) => lines.map((line) => line.toLocaleLowerCase()))
      .run("sort")
      .run("uniq").transform(toLines)
      .run("wc", "-l")
      .transform(toLines)
      .flatten()
      .collect();

    console.dir(output);
  },
});

Deno.test({
  name: "Test of a signal error.",
  async fn() {
    const file = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    );

    const output = await runnable(file.readable)
      .run("gunzip")
      .run("head", "-n", "50")
      .run("wc", "-l")
      .transform(toLines)
      .flatten()
      .collect();

    assertEquals(output, ["50"], "I should bet 50 lines of output.");
  },
});
