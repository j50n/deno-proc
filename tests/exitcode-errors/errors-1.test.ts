import { ExitCodeError, lines, run } from "../../mod.ts";
import { assertEquals, assertRejects } from "../deps/asserts.ts";

Deno.test({
  name: "Non-zero exit code",

  /* See README. */
  sanitizeResources: false,

  async fn() {
    const lns: string[] = [];

    await assertRejects(
      async () => {
        for await (
          const line of lines(
            run(
              "deno",
              "run",
              import.meta.resolve("./print-lines-and-fail.ts"),
            ),
          )
        ) {
          lns.push(line);
        }

        console.dir(lns);
        assertEquals(
          lns,
          ["0", "1", "2", "3"],
          "Data returned by the process is fully consumed.",
        );
      },
      ExitCodeError,
      "Process exited with non-zero exit code: 42",
      "Process returns lines of data and then exits with an error code. We process the lines then throw an error.",
    );
  },
});
