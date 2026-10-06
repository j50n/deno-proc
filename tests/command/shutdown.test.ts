import { assert, assertEquals, assertStringIncludes } from "@std/assert";

/*
 * Each test runs a small program in its own Deno process, because what's under
 * test is how that process exits. The program starts a child shell that
 * touches `ready` once it is running, takes `cleanupSeconds` to shut down after
 * SIGTERM (touching `cleaned` when done), and otherwise loops until the test
 * touches `stop`. On SIGINT it adds a line to `interrupted` and exits soon
 * after, so a second SIGINT in that time adds another; on SIGHUP it touches
 * `hungup` and exits.
 */

const MOD = new URL("../../mod.ts", import.meta.url).href;

interface Run {
  status: Deno.CommandStatus;
  elapsedMs: number;
  stderr: string;
  cleaned: boolean;
  /** How many SIGINTs the child got. */
  interruptions: number;
  hungup: boolean;
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

/**
 * Run `body` as a program. `child` is available in it: call it to start the
 * child shell. Once the child is ready, send `signals` (if any) to the
 * program, one every 200 ms, after `signalDelayMs`. Times from when the child
 * is ready. With `group`, the program runs in a process group of its own, and
 * the signals go to the whole group, as a terminal sends them.
 */
async function runProgram(
  body: string,
  options: {
    cleanupSeconds?: number;
    ignoreTerm?: boolean;
    signals?: Deno.Signal[];
    signalDelayMs?: number;
    group?: boolean;
  } = {},
): Promise<Run> {
  const dir = await Deno.makeTempDir();
  const ready = `${dir}/ready`,
    cleaned = `${dir}/cleaned`,
    interrupted = `${dir}/interrupted`,
    hungup = `${dir}/hungup`,
    stop = `${dir}/stop`;
  const onTerm = options.ignoreTerm
    ? "''"
    : `'sleep ${options.cleanupSeconds ?? 0.3}; touch ${cleaned}; exit 0'`;

  const script = `
    import * as proc from "${MOD}";
    const quiet = { stdin: "null", stdout: "null", stderr: "null" };
    const child = () => new proc.Process(quiet, "sh", ["-c",
      "trap ${onTerm.replaceAll('"', '\\"')} TERM; " +
      "trap 'echo int >> ${interrupted}; sleep 0.3; exit 0' INT; " +
      "trap 'touch ${hungup}; exit 0' HUP; touch ${ready}; " +
      "while [ ! -e ${stop} ]; do sleep 0.05; done"]);
    ${body}
  `;

  try {
    const deno = ["deno", "eval", script];
    const [command, ...args] = options.group ? ["setsid", ...deno] : deno;
    const program = new Deno.Command(command, {
      args,
      stdout: "null",
      stderr: "piped",
    }).spawn();

    assert(await waitForFile(ready, 5000), "the child started");
    const start = Date.now();
    if (options.signalDelayMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, options.signalDelayMs)
      );
    }
    for (const [i, signal] of (options.signals ?? []).entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 200));
      // Deno.kill on a group needs unscoped --allow-run; sh's kill doesn't.
      if (options.group) {
        await new Deno.Command("sh", {
          args: ["-c", `kill -${signal.slice(3)} -- -${program.pid}`],
        }).output();
      } else program.kill(signal);
    }

    const { success, code, signal, stderr } = await program.output();
    return {
      status: { success, code, signal },
      elapsedMs: Date.now() - start,
      stderr: new TextDecoder().decode(stderr),
      cleaned: await exists(cleaned),
      interruptions: await Deno.readTextFile(interrupted).then(
        (text) => text.split("\n").length - 1,
        () => 0,
      ),
      hungup: await exists(hungup),
    };
  } finally {
    await Deno.writeTextFile(stop, "");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await Deno.remove(dir, { recursive: true });
  }
}

/** Keeps the program alive until a signal ends it. */
const FOREVER = "await new Promise(() => setInterval(() => {}, 1000));";

Deno.test({
  name:
    "Without main, a signal ends Deno at once and the child gets no time to clean up.",

  async fn() {
    const run = await runProgram(`child(); ${FOREVER}`, {
      signals: ["SIGTERM"],
    });

    assertEquals(run.status.signal, "SIGTERM");
    assertEquals(run.cleaned, false);
  },
});

Deno.test({
  name:
    "When the program returns, main stops the children, waits, and exits with the returned code.",

  async fn() {
    const run = await runProgram(`
      await proc.main(async () => {
        child();
        await new Promise((r) => setTimeout(r, 300));
        return 3;
      });
    `);

    assertEquals(run.status.code, 3);
    assert(run.cleaned, "the child finished its cleanup");
  },
});

Deno.test({
  name:
    "When the program throws, main reports the error, stops the children, waits, and exits 1.",

  async fn() {
    const run = await runProgram(`
      await proc.main(async () => {
        child();
        await new Promise((r) => setTimeout(r, 300));
        throw new Error("boom");
      });
    `);

    assertEquals(run.status.code, 1);
    assert(run.cleaned, "the child finished its cleanup");
    assertStringIncludes(run.stderr, "boom");
  },
});

Deno.test({
  name: "An error that goes uncaught outside the program is handled the same.",

  async fn() {
    const run = await runProgram(`
      await proc.main(async () => {
        child();
        setTimeout(() => Promise.reject(new Error("rejected")), 300);
        ${FOREVER}
      });
    `);

    assertEquals(run.status.code, 1);
    assert(run.cleaned, "the child finished its cleanup");
    assertStringIncludes(run.stderr, "rejected");
  },
});

Deno.test({
  name:
    "On SIGTERM, main passes it to the children, waits for their cleanup, and exits 143.",

  async fn() {
    const run = await runProgram(
      `await proc.main(async () => { child(); ${FOREVER} });`,
      { signals: ["SIGTERM"] },
    );

    assertEquals(run.status.code, 143);
    assert(run.cleaned, "the child finished its cleanup");
    assert(run.elapsedMs >= 250, `waited for the child (${run.elapsedMs} ms)`);
  },
});

Deno.test({
  name:
    "On Ctrl-C, main waits for the children without signalling them again, and exits 130.",

  async fn() {
    const run = await runProgram(
      `await proc.main(async () => { child(); ${FOREVER} });`,
      { signals: ["SIGINT"], group: true },
    );

    assertEquals(run.status.code, 130);
    assertEquals(run.interruptions, 1, "the terminal's SIGINT, and no other");
    assertEquals(run.cleaned, false, "the child was not sent SIGTERM");
    assert(run.elapsedMs < 2000, `no timeout involved (${run.elapsedMs} ms)`);
  },
});

Deno.test({
  name:
    "A SIGINT sent to Deno alone isn't passed on; after a second, the children get SIGTERM, and main exits 130.",

  async fn() {
    // Docker's STOPSIGNAL SIGINT, an IDE's stop button, `kill -INT <pid>`.
    const run = await runProgram(
      `await proc.main(async () => { child(); ${FOREVER} });`,
      { signals: ["SIGINT"] },
    );

    assertEquals(run.status.code, 130);
    assertEquals(run.interruptions, 0, "the child was not sent SIGINT");
    assert(run.cleaned, "the child got SIGTERM and cleaned up");
    assert(run.elapsedMs >= 900, `gave the grace first (${run.elapsedMs} ms)`);
    assert(run.elapsedMs < 5000, `not the 30 s timeout (${run.elapsedMs} ms)`);
  },
});

Deno.test({
  name:
    "When the terminal hangs up, main waits for the children without signalling them again, and exits 129.",

  async fn() {
    const run = await runProgram(
      `await proc.main(async () => { child(); ${FOREVER} });`,
      { signals: ["SIGHUP"], group: true },
    );

    assertEquals(run.status.code, 129);
    assert(run.hungup, "the child got the terminal's SIGHUP");
    assertEquals(run.cleaned, false, "the child was not sent SIGTERM");
    assert(run.elapsedMs < 2000, `no timeout involved (${run.elapsedMs} ms)`);
  },
});

Deno.test({
  name:
    "A signal while main waits on an error exit doesn't cut the children's cleanup short.",

  async fn() {
    // The container case: the program fails, and the runtime's SIGTERM
    // arrives while the child is still releasing its resources.
    const run = await runProgram(
      `await proc.main(async () => {
        child();
        await new Promise((r) => setTimeout(r, 100));
        throw new Error("boom");
      });`,
      { cleanupSeconds: 0.6, signals: ["SIGTERM"], signalDelayMs: 300 },
    );

    assertEquals(run.status.code, 1);
    assert(run.cleaned, "the child finished its cleanup");
  },
});

Deno.test({
  name: "A second signal exits at once.",

  async fn() {
    const run = await runProgram(
      `await proc.main(async () => { child(); ${FOREVER} });`,
      { ignoreTerm: true, signals: ["SIGTERM", "SIGTERM"] },
    );

    assertEquals(run.status.code, 143);
    assert(run.elapsedMs < 2000, `exited promptly (${run.elapsedMs} ms)`);
  },
});

Deno.test({
  name: "The timeout bounds the wait, and main exits anyway.",

  async fn() {
    const run = await runProgram(
      `await proc.main(async () => { child(); ${FOREVER} }, { timeoutMs: 300 });`,
      { ignoreTerm: true, signals: ["SIGTERM"] },
    );

    assertEquals(run.status.code, 143);
    assert(run.elapsedMs >= 250, `waited for the limit (${run.elapsedMs} ms)`);
    assert(run.elapsedMs < 2000, `stopped at the limit (${run.elapsedMs} ms)`);
  },
});

/**
 * A program under main whose child dies of the terminal's Ctrl-C, as most
 * children do. Its exit code and stderr.
 */
async function ctrlC(): Promise<{ code: number; stderr: string }> {
  const dir = await Deno.makeTempDir();
  const script = `
    import { main, run } from "${MOD}";
    await main(async () => {
      await run("sh", "-c", "touch ${dir}/ready; exec sleep 30").forEach(() => {});
    });`;
  const program = new Deno.Command("setsid", {
    args: ["deno", "eval", script],
    stdout: "null",
    stderr: "piped",
  }).spawn();
  try {
    assert(await waitForFile(`${dir}/ready`, 5000), "the child started");
    await new Deno.Command("sh", {
      args: ["-c", `kill -INT -- -${program.pid}`],
    }).output();
    const { code, stderr } = await program.output();
    return { code, stderr: new TextDecoder().decode(stderr) };
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test({
  name:
    "Ctrl-C exits 130 quietly, even when a child dies of it before main hears it.",

  async fn() {
    // The race is lost now and then; a dozen at once lose it reliably.
    const runs = await Promise.all(Array.from({ length: 12 }, ctrlC));
    assertEquals(runs.map((run) => run.code), runs.map(() => 130));
    assertEquals(runs.map((run) => run.stderr), runs.map(() => ""));
  },
});
