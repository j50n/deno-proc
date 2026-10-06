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

/**
 * The last bytes of a stream so far, enough to hold the start of a character
 * that `chunk` didn't finish: `recent` was the result for the chunk before.
 *
 * @internal
 */
export function lastBytes(recent: Uint8Array, chunk: Uint8Array): Uint8Array {
  if (chunk.length >= 3) return chunk.subarray(chunk.length - 3);
  const both = new Uint8Array(recent.length + chunk.length);
  both.set(recent);
  both.set(chunk, recent.length);
  return both.subarray(Math.max(0, both.length - 3));
}

/**
 * After a fatal streaming `TextDecoder` refused `chunk`: the text of the
 * pieces before the one holding the invalid byte, each through its
 * `separator`, so they can be delivered before the error. The separator is an
 * ASCII byte, never part of a longer character. `recent` is {@link lastBytes}
 * of the stream before `chunk`, which may hold the start of a character the
 * decoder was waiting to finish.
 *
 * @internal
 */
export function textBeforeInvalid(
  recent: Uint8Array,
  chunk: Uint8Array,
  separator: number,
  atStart: boolean,
): string {
  const carried = unfinished(recent);
  const bytes = new Uint8Array(carried.length + chunk.length);
  bytes.set(carried);
  bytes.set(chunk, carried.length);
  // A BOM is dropped only at the start of the stream, as the decoder did.
  const decoder = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: !atStart,
  });
  let text = "";
  let start = 0;
  while (true) {
    const end = bytes.indexOf(separator, start);
    if (end === -1) return text;
    try {
      text += decoder.decode(bytes.subarray(start, end + 1), { stream: true });
    } catch {
      return text;
    }
    start = end + 1;
  }
}

/** The bytes at the end of `bytes` that start a character but don't finish it. */
function unfinished(bytes: Uint8Array): Uint8Array {
  for (let back = 1; back <= Math.min(3, bytes.length); back++) {
    const byte = bytes[bytes.length - back];
    if (byte < 0x80) break;
    if (byte >= 0xC0) {
      const length = byte >= 0xF0 ? 4 : byte >= 0xE0 ? 3 : 2;
      return back < length
        ? bytes.subarray(bytes.length - back)
        : bytes.subarray(0, 0);
    }
  }
  return bytes.subarray(0, 0);
}
