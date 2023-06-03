import { toLines } from "../../mod3.ts";
import { run } from "../../mod3.ts";
import { green } from "../deps/colors.ts";

Deno.test({
  name: "I can 'ls' a folder.",

  async fn() {
    await run("ls", "-la").transform(toLines).flatten().forEach((line) =>
      console.dir(green(line))
    );
  },
});
