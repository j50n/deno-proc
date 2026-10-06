import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { ExitCodeError, Process, run } from "../../mod.ts";

// Found in the pre-0.26.0 review.

Deno.test("A second pass over a failed command's output yields nothing and throws nothing.", async () => {
  let handled = 0;
  const p = run(
    {
      fnError: (error) => {
        handled++;
        throw error;
      },
    },
    "sh",
    "-c",
    "echo a; exit 3",
  );

  await assertRejects(() => p.lines.collect(), ExitCodeError);
  assertEquals(await p.lines.collect(), []);
  assertEquals(handled, 1);
});

Deno.test("Stopping early throws nothing, even when fnStderr failed.", async () => {
  let handled = 0;
  const first = await run(
    {
      fnStderr: () => Promise.reject(new Error("stderr handler failed")),
      fnError: () => {
        handled++;
      },
    },
    "sh",
    "-c",
    "echo a; echo b",
  ).lines.first;

  assertEquals(first, "a");
  assertEquals(handled, 0);
});

Deno.test("new Process refuses fnStderr without piped stderr before starting the child.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    assertThrows(
      () =>
        new Process(
          { stdout: "piped", fnStderr: () => Promise.resolve() },
          "sh",
          ["-c", `touch ${dir}/started`],
        ),
      TypeError,
      "fnStderr",
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    assertEquals(await Deno.stat(`${dir}/started`).catch(() => null), null);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("Options proc doesn't define don't reach the child.", async () => {
  // Passed on to Deno.Command, uid 0 would fail the spawn: the tests don't
  // run as root.
  const options = { uid: 0, gid: 0 } as Record<string, unknown>;
  assertEquals(await run(options, "sh", "-c", "echo ok").lines.first, "ok");
});

Deno.test("Stopping early doesn't wait for a quiet child to exit.", async () => {
  const start = Date.now();
  const line = await run("sh", "-c", "echo ready; sleep 1").lines.first;
  assertEquals(line, "ready");
  assert(
    Date.now() - start < 500,
    `returned at once (${Date.now() - start} ms)`,
  );
});
