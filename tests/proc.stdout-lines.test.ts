import {
  assertArrayIncludes,
  assertEquals,
  assertMatch,
  fail,
} from "../deps/asserts.ts";
import { collect } from "../deps/asynciter.ts";
import { dirname, fromFileUrl } from "../deps/path.ts";
import { Proc } from "../proc.ts";

const here = dirname(fromFileUrl(import.meta.url));

Deno.test("I can read stdout lines from a process.", async () => {
  const data = await collect(
    new Proc({ cmd: [`${here}/counter.ts`] }).stdoutLines(),
  );
  assertArrayIncludes(data, [0, 1, 2, 3].map((n) => n.toString()));
});

Deno.test("I can capture the error from a process that exits with an error code.", async () => {
  try {
    await collect(
      new Proc({ cmd: [`${here}/counter-error.ts`] }).stdoutLines(),
    );
    fail("expected an error");
  } catch (e) {
    assertMatch(e.message, /42/, "exit code is 42");
  }
});

Deno.test("stdout is not being fully read, but things are being properly closed anyway.", async () => {
  async function first(): Promise<string> {
    for await (
      const v of new Proc({ cmd: [`${here}/counter-big.ts`] }).stdoutLines()
    ) {
      return v;
    }
    throw new Error("nothing in stdout");
  }

  assertEquals(
    await first(),
    "0",
    "I should be able to just read the first value and throw the rest away.",
  );
});

Deno.test("stdout is not being fully read, and there was an error. I should see it anyway.", async () => {
  /*
    * This works this way because even though I don't read all of it, all the data from stdout is
    * cached. The data is small enough that the process can (usually) complete to the point of error.
    *
    * This is an interesting test. It can either end with an error code from the process, or it can end
    * with the value being returned. This has something to do with timing and the way buffering works.
    * Both conditions are actually valid (as demonstrated in the next test, which has a lot more data
    * to cache).
    *
    * This is edge-case-ish for sure. You would not normally run into a situation where the correct value
    * was returned and then the process exited with an error code anyway. I think the correct behavior
    * is to throw the error, but I could change my mind at some point.
    */
  async function first(): Promise<string> {
    for await (
      const v of new Proc({ cmd: [`${here}/counter-error.ts`] }).stdoutLines()
    ) {
      return v;
    }
    throw new Error("nothing in stdout");
  }

  try {
    const value = await first();
    assertEquals(
      value,
      "0",
      "sometimes it just gives me back the first line and doesn't get to the error",
    );
  } catch (e) {
    assertMatch(e.message, /42/, "exit code is 42");
  }
});

Deno.test("stdout is closed way before the process can finish, so it doesn't have a chance to error out.", async () => {
  /*
  * I am only getting the first line, and only a few kilobytes of data are cached, so the underlying
  * process does not reach the end by the time I am closing everything. Therefore, it does not reach
  * the line where it would exit with 42.
  */
  async function first(): Promise<string> {
    for await (
      const v of new Proc({ cmd: [`${here}/counter-big-error.ts`] })
        .stdoutLines()
    ) {
      return v;
    }
    throw new Error("nothing in stdout");
  }

  assertEquals(await first(), "0", "Getting the first thing from stdout.");
});
