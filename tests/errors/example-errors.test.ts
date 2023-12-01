import { Cmd, ExitCodeError, run } from "../../mod3.ts";
import { fail } from "../deps/asserts.ts";
import { yellow } from "../deps/colors.ts";

class BadNewsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

Deno.test(
  { name: "error processing from stderr #1", sanitizeResources: false },
  async () => {
    try {
      const cmd: Cmd = [
        "bash",
        "-c",
        `
      echo "Hello,"
      echo "world."
      echo "BAD-NEWS" >&2
      exit 1
    `,
      ];

      await run({
        fnStderr: async (stderr) => {
          let badResult = false;

          for await (const line of stderr.lines) {
            if (line.includes("BAD-NEWS")) {
              badResult = true;
            }
            console.error(yellow(line));
          }

          return badResult;
        },
        fnError: (error?: Error, stderrData?: boolean) => {
          if (stderrData === true) {
            throw new BadNewsError("It's bad.");
          } else if (error != null) {
            throw error;
          }
        },
      }, ...cmd).toStdout();

      fail("expected BadNewsError but no error thrown");
    } catch (e) {
      if (!(e instanceof BadNewsError)) {
        fail(`expected BadNewsError error was ${e.name}`);
      }
    }
  },
);

Deno.test(
  { name: "error processing from stderr #2", sanitizeResources: false },
  async () => {
    try {
      const cmd: Cmd = [
        "bash",
        "-c",
        `
        echo "Hello,"
        echo "world."
        echo "BAD-NEWS" >&2
        exit 1
      `,
      ];

      await run({
        fnStderr: async (stderr) => {
          let badResult = false;

          for await (const line of stderr.lines) {
            if (line.includes("BAD-NEWS")) {
              badResult = true;
            }
            console.error(yellow(line));
          }

          if (badResult) {
            throw new BadNewsError("It's bad, but at least it is simple.");
          }
        },
      }, ...cmd).toStdout();

      fail("expected BadNewsError but no error thrown");
    } catch (e) {
      if (!(e instanceof BadNewsError)) {
        fail(`expected BadNewsError error was ${e.name}`);
      }
    }
  },
);

Deno.test("error suppression", async () => {
  const cmd: Cmd = [
    "bash",
    "-c",
    `
          echo "Hello,"
          echo "world."
          
          exit 22
        `,
  ];

  await run({
    fnError: (error?: Error) => {
      if (error instanceof ExitCodeError && error.code === 22) {
        console.error(yellow("suppressing test error exit code 22"));
      } else {
        throw error;
      }
    },
  }, ...cmd).toStdout();
});
