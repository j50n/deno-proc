import { enumerate, ExitCodeError, run, toLines } from "../../mod3.ts";
import { assert, assertEquals, fail } from "../deps/asserts.ts";
import { gray } from "../deps/colors.ts";

Deno.test({
  name: "I can process stderr.",
  async fn() {
    const stderr: string[] = [];

    const result = await run(
      {
        fnStderr: async (input: AsyncIterable<string[]>): Promise<void> => {
          for await (const lines of input) {
            for (const line of lines) {
              console.error(gray(line));
              stderr.push(line);
            }
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
    )
      .transform(toLines)
      .flatten()
      .collect();

    assertEquals(stderr, ["excelsior"], "I can get lines from stderr.");
    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});

export class TestError extends Error {
  constructor(
    public readonly message: string,
    public readonly data: string[],
    public readonly options?: { cause?: Error },
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
            input: AsyncIterable<string[]>,
          ): Promise<string[]> => {
            /* This supresses print of the stderr data. */
            return await enumerate(input).flatten().collect();
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
      )
        .transform(toLines)
        .flatten();

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
