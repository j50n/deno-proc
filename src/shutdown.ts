/** Children proc started that have not exited yet. */
const running = new Set<Deno.ChildProcess>();

const DEFAULT_TIMEOUT_MS = 30_000;

const SIGNALS: Deno.Signal[] = Deno.build.os === "windows"
  ? ["SIGINT"]
  : ["SIGTERM", "SIGINT", "SIGHUP"];

const SIGNAL_NUMBERS: Partial<Record<Deno.Signal, number>> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15,
};

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
  const exited = Promise.all(children.map((c) => c.status.catch(() => {})));
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

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
 * Deno's own behavior is to exit at once and let child processes crash out. On
 * a normal host they carry on alone, but in a container, Deno's exit usually
 * ends the container, so children are killed before their cleanup can run. In
 * a container, wrap your program in `main`.
 *
 * However the program ends, `main` signals every running child, waits for them
 * to exit, then exits:
 *
 * - The program returns: SIGTERM, then exit with the returned code (default 0).
 * - The program throws, or an error goes uncaught anywhere: report the error,
 *   SIGTERM, then exit 1.
 * - SIGTERM, SIGINT, or SIGHUP arrives: pass that signal on, then exit with
 *   128 plus the signal number (143 for SIGTERM), as if killed by it.
 *
 * A second signal exits at once without waiting. The wait is bounded by
 * `timeoutMs`; set it a little under the container's grace period, or proc
 * gives up first and the children's cleanup is cut short.
 *
 * **Example**
 *
 * ```typescript
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

  /** Signal the children, wait, exit. Only the first call does anything. */
  const finish = async (code: number, signal: Deno.Signal = "SIGTERM") => {
    if (finishing) return;
    finishing = true;
    await terminateAll({ signal, timeoutMs });
    Deno.exit(code);
  };

  for (const signal of SIGNALS) {
    const code = 128 + (SIGNAL_NUMBERS[signal] ?? 15);
    Deno.addSignalListener(signal, () => {
      signalsReceived += 1;
      if (signalsReceived > 1) Deno.exit(code);
      finish(code, signal);
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
