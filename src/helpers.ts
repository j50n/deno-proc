import type { ProcessOptions } from "./process.ts";

/**
 * Internal helper to parse command arguments.
 *
 * Handles both forms:
 * - `run("cmd", "arg1", "arg2")`
 * - `run(options, "cmd", "arg1", "arg2")`
 *
 * @internal
 */
export function parseArgs<S>(
  cmd: unknown[],
): { options: ProcessOptions<S>; command: string | URL; args: string[] } {
  let options: ProcessOptions<S> = {};
  let command: string | URL = "";
  let args: string[] = [];

  if (cmd.length === 0) {
    throw new RangeError("empty arguments");
  } else if (typeof cmd[0] === "string" || cmd[0] instanceof URL) {
    /* No options defined. */
    options = {};
    command = cmd[0];
    args = cmd.slice(1) as string[];
  } else {
    /* First item is the options object. */
    if (cmd.length === 1) {
      throw new RangeError("missing command");
    }
    options = cmd[0] as ProcessOptions<S>;
    command = cmd[1] as string | URL;
    args = cmd.slice(2) as string[];
  }

  return { options, command, args };
}

/**
 * Get a human-readable type name for error messages.
 *
 * @internal
 */
export function bestTypeNameOf(item: unknown): string {
  if (item == null) {
    return `${item}`;
  } else if (typeof item === "object") {
    if (Array.isArray(item)) {
      return "Array[...]";
    } else {
      return item.constructor.name;
    }
  } else {
    return typeof item;
  }
}

/**
 * Mark a promise as handled and return it unchanged. Awaiting it still throws.
 * If nothing ever does, because iteration stopped on another error first, its
 * failure is dropped instead of ending the process as an unhandled rejection.
 *
 * @internal
 */
export function handled<T>(value: T): T {
  if (value instanceof Promise) value.catch(() => {});
  return value;
}

/**
 * Close a source nothing will read, so a command feeding it isn't left
 * blocked on its output. An async generator ignores `return()` until it has
 * started, at every stage of a chain, so this starts it, takes at most one
 * item, and stops. It runs in the background, since that item may be slow.
 *
 * @internal
 */
export function abandon(iter: AsyncIterable<unknown>): void {
  handled((async () => {
    for await (const _ of iter) break;
  })());
}

/** The longest a timer can wait: `setTimeout` fires at once past it. */
export const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * `timeoutMs`, if it is a number of at least 0. NaN or a negative number
 * would otherwise mean no limit at all, or an immediate one.
 *
 * @throws {RangeError} If it isn't.
 */
export function checkedTimeout(timeoutMs: number): number {
  if (!(timeoutMs >= 0)) {
    throw new RangeError(`timeoutMs must be at least 0; got ${timeoutMs}`);
  }
  return timeoutMs;
}

/**
 * Close sources a consumer stopped reading. With a pull still `pending`, a
 * close waits behind it, and that item may never come, so it runs in the
 * background then.
 */
export async function closeAll(
  sources: AsyncIterator<unknown>[],
  pending: boolean,
): Promise<void> {
  const closing = Promise.all(sources.map((source) => source.return?.()));
  if (pending) handled(closing);
  else await closing;
}
