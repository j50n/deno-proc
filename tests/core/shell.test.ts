import { bytesToTextLines, Command, Shell } from "../../mod3.ts";
import { blue } from "../deps/colors.ts";

Deno.test({
  name: "I can do something.",

  async fn() {
    const shell = new Shell();
    try {
      const process = new Command(shell, { stdout: "piped" }, "ls", "-la")
        .spawn();
      for await (
        const line of bytesToTextLines(process.stdout).map((it) =>
          it.toLocaleLowerCase()
        )
      ) {
        console.log(blue(line));
      }
    } finally {
      await shell.close();
    }

    //   assertEquals(
    //     lns,
    //     ["0", "1", "2", "3"],
    //     "Data returned by the process is fully consumed.",
    //   );
  },
});
