import {
  assertArrayIncludes,
  assertMatch,
  assertThrowsAsync,
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
