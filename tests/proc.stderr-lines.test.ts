import { assertArrayIncludes, assertEquals } from "../deps/asserts.ts";
import { collect } from "../deps/asynciter.ts";
import { dirname, fromFileUrl } from "../deps/path.ts";
import { run } from "../proc.ts";

const here = dirname(fromFileUrl(import.meta.url));

Deno.test("I can read stdout and stderr lines from a process.", async () => {
  const p = run({ cmd: [`${here}/counter-stderr.ts`], pipeStderr: true });

  const results = await Promise.all([
    collect(p.stdoutLines()),
    collect(p.stderrLines()),
  ]);

  assertEquals(
    results[0].length,
    1,
    "process should print out a line to stdout",
  );
  assertArrayIncludes(results[1], [0, 1, 2, 3].map((n) => n.toString()));
});
