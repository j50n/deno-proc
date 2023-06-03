import { bytesToTextLines, Command, ExitCodeError } from "../../mod3.ts";
import { assertEquals, assertRejects } from "../deps/asserts.ts";
import { blue } from "../deps/colors.ts";

Deno.test({
  name: "I can 'ls' a folder.",

  async fn() {
    const process = new Command({ stdout: "piped" }, "ls", "-la")
      .spawn();

    try {
      for await (
        const lines of bytesToTextLines(process.stdout)
      ) {
        for (const line of lines) {
          console.log(blue(line.toLocaleLowerCase()));
        }
      }
    } finally {
      await process.close();
    }
  },
});

Deno.test({
  name: "All data output before the exit is captured.",

  async fn() {
    const results: string[] = [];

    const process = new Command(
      { stdout: "piped" },
      "bash",
      "-c",
      "set -e\necho 'A'\necho 'B'\necho 'C'",
    )
      .spawn();

    try {
      for await (
        const lines of bytesToTextLines(process.stdout)
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
        const process = new Command(
          { stdout: "piped" },
          "bash",
          "-c",
          "set -e\necho 'A'\necho 'B'\necho 'C'\necho 'D'\nexit 42",
        )
          .spawn();

        try {
          for await (
            const lines of bytesToTextLines(process.stdout)
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

    const process = new Command(
      { stdout: "piped", stdin: "piped" },
      "cat",
      "-",
    )
      .spawn();

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
        const lines of bytesToTextLines(process.stdout)
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
