import { ExitCodeError, run } from "../../mod.ts";
import { assertEquals } from "@std/assert";

async function* suppressExitCodeError<T>(
  input: AsyncIterable<T>,
): AsyncIterable<T> {
  try {
    yield* input;
  } catch (e) {
    if (!(e instanceof ExitCodeError && e.code === 7)) {
      throw e;
    }
  }
}

Deno.test({
  name: "I can suppress an error with a transform.",
  async fn() {
    const result = await run(
      "bash",
      "-c",
      `
        set -e
        
        echo "A"
        echo "B"
        echo "C"

        exit 7
     `,
    ).lines
      .transform(suppressExitCodeError)
      .collect();

    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});

Deno.test({
  name: "I can suppress an error with an error handler.",
  async fn() {
    const result = await run(
      {
        fnError: (error?: Error) => {
          if (error != null && !(error instanceof ExitCodeError)) {
            throw error;
          }
        },
      },
      "bash",
      "-c",
      `
        set -e
        
        echo "A"
        echo "B"
        echo "C"

        exit 7
     `,
    ).lines
      .transform(suppressExitCodeError)
      .collect();

    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});
