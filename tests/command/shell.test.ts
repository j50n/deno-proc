import { bytesToTextLines, Command, ExitCodeError } from "../../mod3.ts";
import { assertEquals, assertRejects } from "../deps/asserts.ts";
import { blue } from "../deps/colors.ts";

Deno.test({
  name: "I can 'ls' a folder.",

  async fn() {
    const process = new Command({ stdout: "piped" }, "ls", "-la")
      .spawn();
    for await (
      const line of bytesToTextLines(process.stdout)
    ) {
      console.log(blue(line.toLocaleLowerCase()));
    }
  },
});

Deno.test({
  name: "All data output before the exit is captured.",

  async fn() {
    const lines: string[] = [];

    const process = new Command(
      { stdout: "piped" },
      "bash",
      "-c",
      "set -e\necho 'A'\necho 'B'\necho 'C'\necho 'D'",
    )
      .spawn();

    for await (
      const line of bytesToTextLines(process.stdout)
    ) {
      lines.push(line);
    }

    assertEquals(lines, ["A", "B", "C", "D"], "All lines are captured.");
  },
});

Deno.test({
  name:
    "I can catch an error from the exit-code, and all data output before the exit is captured.",

  async fn() {
    const lines: string[] = [];

    await assertRejects(
      async () => {
        const process = new Command(
          { stdout: "piped" },
          "bash",
          "-c",
          "set -e\necho 'A'\necho 'B'\necho 'C'\necho 'D'\nexit 42",
        )
          .spawn();

        for await (
          const line of bytesToTextLines(process.stdout)
        ) {
          lines.push(line);
        }
      },
      ExitCodeError,
      "exit code: 42",
      "Process returns lines of data and then exits with an error code. We process the lines then throw an error. Data is consumed directly.",
    );

    assertEquals(lines, ["A", "B", "C", "D"], "All lines are captured.");
  },
});
