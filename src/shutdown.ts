/** Children proc started that have not exited yet. */
const running = new Set<Deno.ChildProcess>();

const DEFAULT_TIMEOUT_MS = 30_000;

/*
 * The signals `main` handles, and whether to pass each on. A SIGTERM comes to
 * Deno alone (from `docker stop`, systemd, `kill`), so the children hear of it
 * only if `main` forwards it. SIGINT (Ctrl-C) and SIGHUP (the terminal
 * closing) come from the terminal, which sends them to the whole foreground
 * process group, children included: forwarding one would make it their second,
 * which many programs take to mean "quit now, skip the cleanup".
 */
const SIGNALS: { signal: Deno.Signal; code: number; forward: boolean }[] =
  Deno.build.os === "windows"
    ? [{ signal: "SIGINT", code: 130, forward: false }]
    : [
      { signal: "SIGTERM", code: 143, forward: true },
      { signal: "SIGINT", code: 130, forward: false },
      { signal: "SIGHUP", code: 129, forward: false },
    ];

/**
 * Track a child until it exits.
 *
 * @internal
 */
export function track(child: Deno.ChildProcess): void {
  running.add(child);
  const untrack = () => running.delete(child);
  child.status.then(untrack, untrack);
}

/**
 * Send `signal` to every running child. One that exits between the lookup and
 * the signal makes `kill` throw; it needs no signal, and the rest still do.
 */
function signalAll(signal: Deno.Signal): Deno.ChildProcess[] {
  const children = [...running];
  for (const child of children) {
    try {
      child.kill(signal);
    } catch {
      // Already exited.
    }
  }
  return children;
}

/*
 * `Deno.exit` can't be waited on, since `unload` is synchronous. Signal the
 * children anyway so they at least start shutting down.
 */
globalThis.addEventListener("unload", () => {
  signalAll("SIGTERM");
});

/**
 * Signal every child process proc started that is still running, all at once,
 * and wait for them to exit.
 *
 * {@link main} does this for you on the way out. Call it directly to stop the
 * children without exiting.
 *
 * proc signals only the processes it started. A child that is a wrapper script
 * has to `exec` its real program or forward the signal, or the program under
 * it never hears about the shutdown.
 *
 * @param options.signal The signal to send. Default `"SIGTERM"`.
 * @param options.timeoutMs Stop waiting after this many milliseconds; children
 *   still running then are left running, not killed. Default 30 seconds.
 *   `Infinity` waits as long as it takes.
 */
export async function terminateAll(
  options?: { signal?: Deno.Signal; timeoutMs?: number },
): Promise<void> {
  const children = signalAll(options?.signal ?? "SIGTERM");
  await waitFor(children, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** Wait until `children` have exited, or `timeoutMs` has passed. */
async function waitFor(
  children: Deno.ChildProcess[],
  timeoutMs: number,
): Promise<void> {
  const exited = Promise.all(children.map((c) => c.status.catch(() => {})));

  // setTimeout fires at once for anything past its 32-bit range.
  if (!(timeoutMs < 2 ** 31 - 1)) {
    await exited;
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      exited,
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a program, and shut its child processes down before it exits.
 *
 * Deno's own behavior is to exit at once and let child processes crash out.
 * Told to stop, it doesn't tell them: on a normal host they carry on alone,
 * and in a container Deno's exit usually ends the container, so they are
 * killed before their cleanup can run. An uncaught error is worse, on any
 * host: Deno kills its children as it exits, without a signal they can
 * handle. Wrap any program that starts long-lived children in `main`, and
 * always one that runs in a container.
 *
 * However the program ends, `main` signals every running child, waits for them
 * to exit, then exits:
 *
 * - The program returns: SIGTERM, then exit with the returned code (default 0).
 * - The program throws, or an error goes uncaught anywhere: report the error,
 *   SIGTERM, then exit 1.
 * - SIGTERM arrives: pass it on, then exit 143, as if killed by it.
 * - SIGINT (Ctrl-C) or SIGHUP (the terminal closing) arrives: wait without
 *   passing it on, since the terminal sent it to the children as well, then
 *   exit 130 or 129. Sent to Deno alone (`kill -INT <pid>`), it doesn't reach
 *   them: to stop a program from another process, send SIGTERM.
 *
 * A second signal exits at once without waiting. The wait is bounded by
 * `timeoutMs`; set it a little under the container's grace period, or proc
 * gives up first and the children's cleanup is cut short.
 *
 * **Example**
 *
 * ```typescript
 * import { main, run } from "@j50n/proc";
 *
 * await main(async () => {
 *   await run("launcher", "--job", "nightly").lines.forEach(console.log);
 * });
 * ```
 *
 * @param program The program. Return an exit code, or nothing for 0.
 * @param options.timeoutMs Stop waiting for children after this many
 *   milliseconds and exit anyway. Default 30 seconds.
 */
export async function main(
  program: () => void | number | Promise<void | number>,
  options?: { timeoutMs?: number },
): Promise<never> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let finishing = false;
  let signalsReceived = 0;

  /**
   * Signal the children (unless they have been already), wait, exit. Only the
   * first call does anything.
   */
  const finish = async (code: number, signal = true) => {
    if (finishing) return;
    finishing = true;
    if (signal) await terminateAll({ timeoutMs });
    else await waitFor([...running], timeoutMs);
    Deno.exit(code);
  };

  for (const { signal, code, forward } of SIGNALS) {
    Deno.addSignalListener(signal, () => {
      signalsReceived += 1;
      if (signalsReceived > 1) Deno.exit(code);
      finish(code, forward);
    });
  }

  const onUncaught = (event: ErrorEvent | PromiseRejectionEvent) => {
    event.preventDefault();
    console.error(event instanceof ErrorEvent ? event.error : event.reason);
    finish(1);
  };
  globalThis.addEventListener("error", onUncaught);
  globalThis.addEventListener("unhandledrejection", onUncaught);

  try {
    await finish((await program()) ?? 0);
  } catch (e) {
    console.error(e);
    await finish(1);
  }

  // A signal or an uncaught error got there first, and that finish exits.
  return await new Promise<never>(() => {});
}
