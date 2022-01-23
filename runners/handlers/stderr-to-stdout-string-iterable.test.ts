import { assertEquals, asynciter } from "../../deps-test.ts";
import { ProcGroup } from "../proc-group.ts";
import { EmptyInput } from "./empty.ts";
import { StderrToStdoutStringIterableOutput } from "./stderr-to-stdout-string-iterable.ts";

Deno.test({
  name: "I can interleave stderr lines into stdout.",
  async fn() {
    /*
     *
     */
    const proc = new ProcGroup();
    try {
      const output = await proc.run(
        EmptyInput(),
        StderrToStdoutStringIterableOutput(),
        undefined,
        {
          cmd: [
            "bash",
            "-c",
            `set -e
                echo "This is to stdout."
                echo "This is to stderr." >&2
                echo "This is also to stdout."
                echo "And this is also to stderr." >&2
            `,
          ],
        },
      );

      const outputLines = await asynciter(output).collect();

      assertEquals(
        new Set(outputLines),
        new Set([
          "This is to stdout.",
          "This is to stderr.",
          "This is also to stdout.",
          "And this is also to stderr.",
        ]),
      );
    } finally {
      proc.close();
    }
  },
});
