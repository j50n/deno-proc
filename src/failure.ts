// How a child's run ends: which error it fails with, and what `fnError`
// makes of it. Internal; `Process.stdout` calls these after the last chunk.

import {
  type ErrorHandler,
  ExitCodeError,
  type ProcessError,
  SignalError,
  TimeoutError,
  UpstreamError,
} from "./process.ts";

/**
 * The error a finished run fails with, or `undefined` if it succeeded.
 *
 * A timeout wins whatever the exit, since a run cut short didn't succeed and
 * "killed by SIGTERM" wouldn't say why; then a signal; then the exit code. A
 * clean exit still fails if the process's input did (`cause`), and every
 * error carries that cause. Messages name the program only: arguments can
 * hold secrets, and messages end up in logs. `command` has the rest.
 *
 * @param cmd The program and its arguments.
 * @param status How the child exited.
 * @param timedOut The `timeoutMs` that ran out, if one did.
 * @param cause The failure of the process's input, if any.
 */
export function failureOf(
  cmd: string[],
  status: Deno.CommandStatus,
  timedOut: number | undefined,
  cause: Error | undefined,
): ProcessError | undefined {
  if (timedOut !== undefined) {
    return new TimeoutError(
      `${cmd[0]} timed out after ${timedOut} ms`,
      cmd,
      timedOut,
      { cause },
    );
  } else if (status.signal != null) {
    return new SignalError(
      `${cmd[0]} was killed by ${status.signal}`,
      cmd,
      status.signal,
      { cause },
    );
  } else if (status.code !== 0) {
    return new ExitCodeError(
      `${cmd[0]} exited with code ${status.code}`,
      cmd,
      status.code,
      { cause },
    );
  } else if (cause) {
    return new UpstreamError(cause.message, cmd, { cause });
  }
  return undefined;
}

/**
 * Finish a run: throw `error`, or, with `fnError`, let it decide. `fnError`
 * gets the error and what `fnStderr` returned, and is called only when there
 * is one or the other. An `fnStderr` that failed counts as no data here: its
 * error is already `error`.
 */
export async function settle<S>(
  error: Error | undefined,
  fnError: ErrorHandler<S> | undefined,
  stderrResult: Promise<S> | undefined,
): Promise<void> {
  if (fnError == null) {
    if (error != null) throw error;
    return;
  }
  const stderrData = await stderrResult?.catch(() => undefined);
  if (error != null || stderrData != null) {
    await fnError(error, stderrData);
  }
}
