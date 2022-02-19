import {
  assertEquals,
  asynciter,
  blue,
  fail,
  red,
  stripColor,
} from "../../deps-test.ts";
import { group } from "../proc-group.ts";
import { ProcessExitError } from "../process-exit-error.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import { emptyInput } from "./empty.ts";
import {
  stringAsyncIterableInput,
  stringAsyncIterableOutput,
  stringAsyncIterableUnbufferedInput,
  stringAsyncIterableUnbufferedOutput,
} from "./string-asynciterable.ts";
import * as proc from "../../mod.ts";

Deno.test({
  name:
    "[HAPPY-PATH] I can run a command with stdin as an AsyncIterable of text lines, and get the result as an AsyncIterable of text lines.",
  async fn() {
    /*
     * I am passing some numbers as test to `grep` and using it to filter out just a few.
     * I am using `asynciter` to transform to and from numbers.
     */
    const proc = group();
    try {
      const stdout = await proc.run(
        stringAsyncIterableInput(),
        stringAsyncIterableOutput(stderrLinesToErrorMessage(20)),
        asynciter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((n) => `${n}`),
        { cmd: ["grep", "1"] },
      );
      assertEquals(
        await asynciter(stdout).map((line) => parseInt(line, 10)).collect(),
        [1, 10, 11],
      );
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[HAPPY-PATH] I can run a command with stdin as an AsyncIterable of text lines, and get the result as an AsyncIterable of text lines, unbuffered.",
  async fn() {
    /*
     * I am passing some numbers as test to `grep` and using it to filter out just a few.
     * I am using `asynciter` to transform to and from numbers.
     */
    const proc = group();
    try {
      const stdout = await proc.run(
        stringAsyncIterableUnbufferedInput(),
        stringAsyncIterableUnbufferedOutput(stderrLinesToErrorMessage(20)),
        asynciter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((n) => `${n}`),
        { cmd: ["grep", "1"] },
      );
      assertEquals(
        await asynciter(stdout).map((line) => parseInt(line, 10)).collect(),
        [1, 10, 11],
      );
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[ERROR] If a process exits with a code that indicates failure, I get an error. Stdout data is available for processing.",
  async fn() {
    const proc = group();

    const acc: number[] = [];
    try {
      try {
        const a = await proc.run(
          emptyInput(),
          stringAsyncIterableOutput(),
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

      assertEquals(acc, [1, 2, 3]);
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name: "[README] An example using unbuffered output.",
  async fn() {
    const pg = proc.group();
    try {
      for await (
        const line of proc.runner(
          proc.emptyInput(),
          proc.stringAsyncIterableUnbufferedOutput(async (stderr) => {
            for await (const line of proc.toLines(stderr)) {
              // await sleep(1);
              console.error(
                `${red(`${new Date().getTime()}`)} -> ${stripColor(line)}`,
              );
            }
          }),
        )(pg).run({
          cmd: [
            "deno",
            "doc",
            "--reload",
            "https://deno.land/x/proc/mod.ts",
          ],
        })
      ) {
        // await sleep(1);
        console.log(
          `${blue(`${new Date().getTime()}`)} -> ${stripColor(line)}`,
        );
      }
    } finally {
      pg.close();
    }
  },
});
