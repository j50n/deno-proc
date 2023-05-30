import { execute, lines, run } from "../../mod2.ts";
import { TextLineStream } from "../deps/streams.ts";

Deno.test({
  name:
    "Verbosely list files in the current directory, including hidden files, and print the result to console.log.",
  async fn() {
    const output = await new Deno.Command("ls", { args: ["-la"] }).output();
    console.log(new TextDecoder().decode(output.stdout));

    for await (
      const line of new Deno.Command("ls", { args: ["-la"], stdout: "piped" })
        .spawn()
        .stdout
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
    ) {
      console.log(line);
    }

    console.log(await run("ls", "-la").asString());

    console.log((await run("ls", "-la").collectLines()).join(""));

    for await (const line of lines(run("ls", "-la"))) {
      console.log(line);
    }

    console.log(await execute("ls", "-la"));
  },
});
