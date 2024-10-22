import { ExitCodeError, Process, toChunkedLines } from "../../mod.ts";
import { assertEquals, assertRejects } from "../deps/asserts.ts";

Deno.test({
  name: "All data output before the exit is captured.",

  async fn() {
    const results: string[] = [];

    const process = new Process(
      { stdout: "piped" },
      "bash",
      ["-c", "set -e\necho 'A'\necho 'B'\necho 'C'"],
    );

    try {
      for await (
        const lines of toChunkedLines(process.stdout)
      ) {
        for (const line of lines) {
          results.push(line);
        }
      }

      assertEquals(results, ["A", "B", "C"], "All lines are captured.");
    } finally {
      await process.close();
    }
  },
});

Deno.test({
  name:
    "I can catch an error from the exit-code, and all data output before the exit is captured.",

  async fn() {
    const results: string[] = [];

    await assertRejects(
      async () => {
        const process = new Process(
          { stdout: "piped" },
          "bash",
          ["-c", "set -e\necho 'A'\necho 'B'\necho 'C'\necho 'D'\nexit 42"],
        );

        try {
          for await (
            const lines of toChunkedLines(process.stdout)
          ) {
            for (const line of lines) {
              results.push(line);
            }
          }
        } finally {
          await process.close();
        }
      },
      ExitCodeError,
      "exit code: 42",
      "Process returns lines of data and then exits with an error code. We process the lines then throw an error. Data is consumed directly.",
    );

    assertEquals(results, ["A", "B", "C", "D"], "All lines are captured.");
  },
});

Deno.test({
  name:
    "I can pass data from stdin to stdout through a process, one line at a time.",

  async fn() {
    const results: string[] = [];

    const process = new Process(
      { stdout: "piped", stdin: "piped" },
      "cat",
      ["-"],
    );

    (async () => {
      try {
        for (const line of ["A", "B", "C", "D"]) {
          await process.stdin.write([line]);
        }
      } finally {
        await process.close();
      }
    })();

    try {
      for await (
        const lines of toChunkedLines(process.stdout)
      ) {
        for (const line of lines) {
          results.push(line);
        }
      }
    } finally {
      await process.close();
    }

    assertEquals(results, ["A", "B", "C", "D"], "All lines are captured.");
  },
});

Deno.test({
  name:
    "I can pass data from stdin to stdout through a process, one line at a time, with error passed through stdin.",

  async fn() {
    const results: string[] = [];

    await assertRejects(
      async () => {
        const process = new Process(
          { stdout: "piped", stdin: "piped" },
          "cat",
          ["-"],
        );

        (async () => {
          try {
            for (const line of ["A", "B", "C", "D"]) {
              await process.stdin.write([line]);
            }
          } finally {
            await process.stdin.close(new Error("This is a test."));
          }
        })();

        try {
          for await (
            const lines of toChunkedLines(process.stdout)
          ) {
            for (const line of lines) {
              results.push(line);
            }
          }
        } finally {
          await process.close();
        }
      },
      Error,
      "This is a test.",
      "Process returns lines of data and forwards an error passed from stdin. Lines are completely processed before the error is thrown.",
    );

    assertEquals(results, ["A", "B", "C", "D"], "All lines are captured.");
  },
});
