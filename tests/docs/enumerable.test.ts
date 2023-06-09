import { enumerate } from "../../mod3.ts";
import { fromFileUrl } from "../deps/path.ts";

Deno.test({
  name: "Use the `enumerate` function on a file.",
  async fn() {
    const file = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
    );

    const count = await enumerate(file.readable)
      .run("gunzip")
      .run("grep", "\S")
      .run("wc", "-l")
      .lines.map((n) => parseInt(n, 10))
      .first;

    console.log(count);
  },
});
