import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { run, TimeoutError } from "../../mod.ts";

Deno.test("timeoutMs stops a child that runs too long, and its output throws TimeoutError.", async () => {
  const start = Date.now();
  const error = await assertRejects(
    () => run({ timeoutMs: 200 }, "sh", "-c", "exec sleep 5").lines.collect(),
    TimeoutError,
    "sh timed out after 200 ms",
  );
  assertEquals(error.timeoutMs, 200);
  assert(Date.now() - start < 2000, "stopped well before the child would have");
});

Deno.test("A timed-out child that exits cleanly on SIGTERM still throws TimeoutError.", async () => {
  await assertRejects(
    () =>
      run(
        { timeoutMs: 200 },
        "sh",
        "-c",
        "trap 'exit 0' TERM; echo started; while true; do sleep 0.05; done",
      ).lines.collect(),
    TimeoutError,
  );
});

Deno.test("A child that finishes in time is unaffected, and no timer is left behind.", async () => {
  // The test sanitizer fails the test if the timer outlives it.
  assertEquals(
    await run({ timeoutMs: 5000 }, "sh", "-c", "echo hi").lines.collect(),
    ["hi"],
  );
});

Deno.test("timeoutMs bounds a child whose output was stopped early.", async () => {
  const p = run({ timeoutMs: 200 }, "sh", "-c", "echo ready; exec sleep 30");
  assertEquals(await p.lines.first, "ready");
  assertEquals((await p.status).signal, "SIGTERM");
});

Deno.test("A timeoutMs that isn't a number of at least 0 is refused before anything starts.", () => {
  for (const timeoutMs of [NaN, -1]) {
    assertThrows(() => run({ timeoutMs }, "true"), RangeError);
  }
});

Deno.test("clearEnv starts the child with only env.", async () => {
  const echo = "echo ${HOME:-none} ${ONLY:-none}";
  assertEquals(
    await run(
      { clearEnv: true, env: { PATH: "/usr/bin:/bin", ONLY: "1" } },
      "sh",
      "-c",
      echo,
    ).lines.first,
    "none 1",
  );
  // Without it, the child has this process's environment, HOME included.
  assert(!(await run("sh", "-c", echo).lines.first).startsWith("none"));
});
