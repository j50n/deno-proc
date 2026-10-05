import { Process, terminateAll } from "../../mod.ts";
import { assert, assertEquals } from "@std/assert";

const quiet = { stdin: "null", stdout: "null", stderr: "null" } as const;

/** Resolves true if `p` settles within `ms`, false otherwise. */
async function settlesWithin(p: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(path: string, ms: number) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await exists(path)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

Deno.test({
  name:
    "terminateAll signals every running child at once and waits for each one to finish shutting down.",

  async fn() {
    // Each child takes 300 ms to shut down after SIGTERM, standing in for a
    // launcher releasing a cloud resource.
    const children = [1, 2, 3].map(() =>
      new Process(quiet, "sh", [
        "-c",
        "trap 'sleep 0.3; exit 0' TERM; while :; do sleep 0.05; done",
      ])
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    const start = Date.now();
    await terminateAll();
    const elapsed = Date.now() - start;

    for (const child of children) {
      assert(
        await settlesWithin(child.status, 0),
        "every child has exited when terminateAll returns",
      );
      assertEquals(
        (await child.status).code,
        0,
        "each child shut down cleanly",
      );
    }
    assert(elapsed >= 250, `waited for the shutdown work (${elapsed} ms)`);
    assert(elapsed < 900, `children shut down in parallel (${elapsed} ms)`);
  },
});

Deno.test({
  name:
    "terminateAll with a timeout returns after the timeout and leaves a stubborn child running.",

  async fn() {
    const stubborn = new Process(quiet, "sh", [
      "-c",
      "trap '' TERM; while :; do sleep 0.05; done",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      const start = Date.now();
      await terminateAll({ timeoutMs: 200 });
      const elapsed = Date.now() - start;

      assert(elapsed >= 190, `waited for the timeout (${elapsed} ms)`);
      assert(elapsed < 600, `returned at the timeout (${elapsed} ms)`);
      assertEquals(
        await settlesWithin(stubborn.status, 0),
        false,
        "the child was not killed",
      );
    } finally {
      stubborn.process.kill("SIGKILL");
      await stubborn.status;
    }
  },
});

Deno.test({
  name: "terminateAll sends the signal it is given.",

  async fn() {
    const child = new Process(quiet, "sh", [
      "-c",
      "trap 'exit 7' INT; while :; do sleep 0.05; done",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await terminateAll({ signal: "SIGINT" });

    assertEquals((await child.status).code, 7);
  },
});

Deno.test({
  name: "terminateAll returns at once when no children are running.",

  async fn() {
    const done = new Process(quiet, "true", []);
    await done.status;

    assert(await settlesWithin(terminateAll(), 50));
  },
});

Deno.test({
  name:
    "On exit, a child that already exited does not stop the others from being signaled.",

  async fn() {
    const dir = await Deno.makeTempDir();
    const ready = `${dir}/ready`;
    const signaled = `${dir}/signaled`;
    const stop = `${dir}/stop`;

    // The first child has exited but nothing has read or closed it, so it is
    // still first in line when the unload listener runs.
    const script = `
      import { Process } from "${new URL("../../mod.ts", import.meta.url)}";
      const quiet = { stdin: "null", stdout: "null", stderr: "null" };
      await new Process(quiet, "true", []).status;
      new Process(quiet, "sh", ["-c",
        "trap 'touch ${signaled}; exit 0' TERM; touch ${ready}; " +
        "while [ ! -e ${stop} ]; do sleep 0.05; done"]);
      while (true) {
        try { await Deno.stat("${ready}"); break; } catch { /* not yet */ }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      Deno.exit(0);
    `;

    try {
      const { code } = await new Deno.Command("deno", {
        args: ["eval", script],
        stdout: "null",
      }).output();
      assertEquals(code, 0);

      assert(
        await waitForFile(signaled, 2000),
        "the running child received SIGTERM",
      );
    } finally {
      await Deno.writeTextFile(stop, "");
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Deno.remove(dir, { recursive: true });
    }
  },
});
