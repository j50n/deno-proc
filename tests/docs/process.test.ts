import { assertEquals } from "@std/assert";
import { ExitCodeError, Process } from "../../src/process.ts";
import { enumerate } from "../../src/enumerable.ts";

Deno.test("Process - basic usage", async () => {
  const proc = new Process(
    { stdout: "piped", stdin: "null", stderr: "inherit" },
    "echo",
    ["hello"],
  );

  const output: Uint8Array[] = [];
  for await (const chunk of proc.stdout) {
    output.push(chunk);
  }

  const text = new TextDecoder().decode(output[0]);
  assertEquals(text.trim(), "hello");
});

Deno.test("Process - custom error handler", async () => {
  let errorCaught = false;

  const proc = new Process(
    {
      stdout: "piped",
      stdin: "null",
      stderr: "inherit",
      fnError: (error) => {
        if (error instanceof ExitCodeError && error.code === 1) {
          errorCaught = true;
          // Suppress the error by not throwing
        }
      },
    },
    "sh",
    ["-c", "exit 1"],
  );

  // Consume stdout to trigger error handling
  for await (const _chunk of proc.stdout) {
    // Process output
  }

  assertEquals(errorCaught, true);
});

Deno.test("Process - stderr handler", async () => {
  const stderrData: string[] = [];

  const proc = new Process(
    {
      stdout: "piped",
      stdin: "null",
      stderr: "piped",
      fnStderr: async (stderr) => {
        for await (const chunk of stderr) {
          stderrData.push(new TextDecoder().decode(chunk));
        }
        return stderrData;
      },
    },
    "sh",
    ["-c", "echo error >&2; echo output"],
  );

  const output: string[] = [];
  for await (const chunk of enumerate(proc.stdout).lines) {
    output.push(chunk);
  }

  assertEquals(output, ["output"]);
  assertEquals(stderrData.join("").includes("error"), true);
});
