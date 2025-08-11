import { gray } from "jsr:@std/fmt@1.0.2/colors";
import { enumerate, ExitCodeError, run, toLines } from "../../mod.ts";
import { assert, assertEquals, fail } from "jsr:@std/assert@1.0.13";

Deno.test({
  name: "I can process stderr as lines.",
  async fn() {
    const stderr: string[] = [];

    const result = await run(
      {
        fnStderr: async (input: AsyncIterable<Uint8Array>): Promise<void> => {
          for await (const line of enumerate(input).transform(toLines)) {
            console.error(gray(line));
            stderr.push(line);
          }
        },
      },
      "bash",
      "-c",
      `
        set -e

        echo "excelsior" 1>&2
        
        echo "A"
        echo "B"
        echo "C"
     `,
    ).lines
      .collect();

    assertEquals(stderr, ["excelsior"], "I can get lines from stderr.");
    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});

Deno.test({
  name: "I can process stderr as text chunks.",
  async fn() {
    const stderr: string[] = [];

    const result = await run(
      {
        fnStderr: async (input: AsyncIterable<Uint8Array>): Promise<void> => {
          for await (
            const text of enumerate(input).transform(new TextDecoderStream())
          ) {
            stderr.push(text);
          }
        },
      },
      "bash",
      "-c",
      `
        set -e

        echo "excelsior" 1>&2
        echo "A"
        echo "upward and onward" 1>&2
        echo "B"
        echo "to greater glory" 1>&2
        echo "C"
     `,
    ).lines
      .collect();

    assertEquals(
      stderr.join("").split(/\n/g),
      [
        "excelsior",
        "upward and onward",
        "to greater glory",
        "",
      ],
      "I can get lines from stderr.",
    );

    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});

export class TestError extends Error {
  constructor(
    message: string,
    public readonly data: string[],
    options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

Deno.test({
  name: "I can throw custom errors using data from stderr.",
  async fn() {
    const result: string[] = [];
    try {
      const output = run(
        {
          fnStderr: async (
            input: AsyncIterable<Uint8Array>,
          ): Promise<string[]> => {
            /* This supresses print of the stderr data. */
            return await enumerate(input).transform(toLines).collect();
          },
          fnError: (error?: Error, stderrData?: string[]) => {
            if (error != null && error instanceof ExitCodeError) {
              throw new TestError("Something went wrong.", stderrData!, {
                cause: error,
              });
            }
          },
        },
        "bash",
        "-c",
        `
        set -e

        echo "excelsior" 1>&2
        
        echo "A"
        echo "B"
        echo "C"

        exit 7
     `,
      ).lines;

      for await (const line of output) {
        result.push(line);
      }

      fail("The iterable should error out and never reach this line.");
    } catch (e) {
      assert(e instanceof TestError, "I should see the error I threw.");
      assert(
        e.message === "Something went wrong.",
        "It's the right error message.",
      );
      assertEquals(
        e.data,
        ["excelsior"],
        "I captured the data from stderr to the error.",
      );
      assert(
        e.cause instanceof ExitCodeError,
        "The cause is passed along too.",
      );
    }

    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});
