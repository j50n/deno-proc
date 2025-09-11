import { ExitCodeError, run, UpstreamError } from "../../mod.ts";
import { assert, assertEquals, fail } from "@std/assert";

Deno.test({
  name: "I can gather lines of output.",
  async fn() {
    const result = await run(
      "bash",
      "-c",
      `
        set -e
        
        echo "A"
        echo "B"
        echo "C"
     `,
    ).lines.collect();

    assertEquals(result, ["A", "B", "C"], "I can get lines from a process.");
  },
});

Deno.test({
  name: "I can gather lines of output and catch the error.",
  async fn() {
    const output = await run(
      "bash",
      "-c",
      `
          set -e

          echo "A"
          echo "B"
          echo "C"

          exit 7
       `,
    ).lines;

    const result: string[] = [];
    try {
      for await (const line of output) {
        result.push(line);
      }
      fail("This was supposed to throw an ExitCodeError.");
    } catch (e) {
      assert(e instanceof ExitCodeError, "Should throw an ExitCodeError.");
      assertEquals(e.code, 7, "Must return the expected exit code.");
    }

    assertEquals(
      result,
      ["A", "B", "C"],
      "The lines are returned from the process before the error.",
    );
  },
});

Deno.test({
  name:
    "I can gather lines of output and catch the error through an intervening process.",
  async fn() {
    const output = await run(
      "bash",
      "-c",
      `
            set -e

            echo "A"
            echo "B"
            echo "C"

            exit 7
         `,
    ).run("tr", "[:upper:]", "[:lower:]").lines;

    const result: string[] = [];
    try {
      for await (const line of output) {
        result.push(line);
      }
      fail("This was supposed to throw an ExitCodeError.");
    } catch (e) {
      assert(e instanceof UpstreamError, "Should throw a StreamError.");
      assert(e.cause instanceof ExitCodeError, "Caused by an ExitCodeError.");
      assertEquals(e.cause.code, 7, "Must return the expected exit code.");
    }

    assertEquals(
      result,
      ["a", "b", "c"],
      "The lines are processed through the stream.",
    );
  },
});
