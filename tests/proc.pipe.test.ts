import { assertArrayIncludes, assertMatch, fail } from "../deps/asserts.ts";
import { collect } from "../deps/asynciter.ts";
import { dirname, fromFileUrl } from "../deps/path.ts";
import { Proc } from "../proc.ts";

const here = dirname(fromFileUrl(import.meta.url));

Deno.test("I can pipe stdout from proc A to stdin of proc B.", async () => {
  const data = await collect(
    new Proc({ cmd: [`${here}/counter.ts`] }).pipe(new Proc({ cmd: ["cat"] }))
      .stdoutLines(),
  );
  assertArrayIncludes(data, [0, 1, 2, 3].map((n) => n.toString()));
});

Deno.test("I can see an error that occurs one step back in a pipe.", async () => {
  /*
   * This test is failing every so often. It is a race condition with pushing the error
   * downstream.
   */
  try {
    await collect(
      new Proc({ cmd: [`${here}/counter-error.ts`] }).pipe(
        new Proc({ cmd: ["cat"] }),
      ).stdoutLines(),
    );
    fail("expected an error");
  } catch (e) {
    assertMatch(e.message, /42/, "exit code is 42");
  }
});
