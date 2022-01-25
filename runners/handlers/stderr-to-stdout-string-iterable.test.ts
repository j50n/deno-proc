import { assert, assertEquals, asynciter, fail } from "../../deps-test.ts";
import { ProcGroup } from "../proc-group.ts";
import { ProcessExitError } from "../process-exit-error.ts";
import { emptyInput } from "./empty.ts";
import { stderrToStdoutStringIterableOutput } from "./stderr-to-stdout-string-iterable.ts";

Deno.test({
  name: "[HAPPY-PATH] I can interleave stderr lines into stdout.",
  async fn() {
    const proc = new ProcGroup();
    try {
      const output = await proc.run(
        emptyInput(),
        stderrToStdoutStringIterableOutput(),
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

Deno.test({
  name:
    "[EDGE-CASE] I can grab just one line and everything closes automatically.",
  async fn() {
    const proc = new ProcGroup();
    try {
      const output = await proc.run(
        emptyInput(),
        stderrToStdoutStringIterableOutput(),
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

      const first = await asynciter(output).first();
      assert(typeof first === "string");
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[ERROR] If a process exits with a code that indicates failure, I get an error. Stdout and stderr data are combined and available.",
  async fn() {
    const proc = new ProcGroup();

    const acc: number[] = [];
    try {
      try {
        const a = await proc.run(
          emptyInput(),
          stderrToStdoutStringIterableOutput(),
          undefined,
          {
            cmd: [
              "bash",
              "-c",
              `
                set -e

                echo "1"
                echo "2"
                echo "3"

                echo "7" >&2
                echo "9" >&2

                exit 17
          `,
            ],
          },
        );

        await asynciter(a).map((v) => parseInt(v, 10)).forEach((n) => {
          acc.push(n);
        });

        fail("expected an error to be thrown");
      } catch (e) {
        if (e instanceof ProcessExitError) {
          assertEquals(e.code, 17);
        } else {
          fail(`wrong error type: ${e}`);
        }
      }

      assertEquals(new Set(acc), new Set([1, 2, 3, 7, 9]));
    } finally {
      proc.close();
    }
  },
});
