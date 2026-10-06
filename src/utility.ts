import type { Writer } from "@std/io/types";
import { type Enumerable, enumerate } from "./enumerable.ts";

const LF = "\n".charCodeAt(0);

/**
 * Read a file as an Enumerable of byte chunks.
 *
 * The file is opened when iteration starts, not at the call, and closed when
 * iteration ends, including when the consumer stops early. A missing file
 * throws `Deno.errors.NotFound` from the consumer, at the first read.
 *
 * Add `.lines` for text, `.transform(gunzip)` for a `.gz` file, or `.run()`
 * to feed it to a command's stdin.
 *
 * @example
 * ```typescript
 * import { read } from "@j50n/proc";
 *
 * const errors = await read("app.log")
 *   .lines
 *   .filter((line) => line.includes("ERROR"))
 *   .collect();
 * ```
 *
 * @example Pipe a file into a command
 * ```typescript
 * import { read } from "@j50n/proc";
 *
 * const count = await read("data.txt").run("wc", "-l").lines.first;
 * ```
 *
 * @param path The path of the file.
 */
export function read(path: string | URL): Enumerable<Uint8Array<ArrayBuffer>> {
  async function* openForRead(): AsyncIterable<Uint8Array<ArrayBuffer>> {
    const file = await Deno.open(path);
    yield* file.readable;
  }

  return enumerate(openForRead());
}

/**
 * Read a UTF-8 file as lines of text: the same as `read(path).lines`.
 *
 * Line endings (`\n` or `\r\n`) are dropped, and see {@link read} for when
 * the file is opened and closed. Invalid UTF-8 throws `TypeError`.
 *
 * @example
 * ```typescript
 * import { readLines } from "@j50n/proc";
 *
 * for await (const line of readLines("data.txt")) {
 *   console.log(line);
 * }
 * ```
 *
 * @param path The path of the file.
 */
export function readLines(path: string | URL): Enumerable<string> {
  return read(path).lines;
}

/**
 * Join byte arrays into one.
 *
 * Given a single array, it returns that same array, not a copy, so writing to
 * the result writes to the input. Given none, it returns a new empty array.
 *
 * @example
 * ```typescript
 * import { concat, read } from "@j50n/proc";
 *
 * const bytes = concat(await read("data.bin").collect());
 * ```
 *
 * @param arrays The arrays to join.
 */
export function concat(arrays: Uint8Array[]): Uint8Array {
  const al = arrays.length;

  if (al === 0) return new Uint8Array(0);

  /*
   * In many cases, we are dealing with data that actually only contains a single array of bytes
   * and does not actually need to be concatenated. In this case, we just return the first buffer
   * from the array (it is the only buffer) and skip the processing, saving a redundant memcpy.
   */
  if (al === 1) {
    return arrays[0];
  }

  let totalLength = 0;
  for (let i = 0; i < al; i++) {
    totalLength += arrays[i].length;
  }

  const result = new Uint8Array(totalLength);

  let pos = 0;
  for (let i = 0; i < al; i++) {
    const array = arrays[i];
    result.set(array, pos);
    pos += array.length;
  }

  return result;
}

/**
 * Join byte arrays into one, with `\n` after each: lines of bytes back into
 * text. Given none, it returns an empty array.
 *
 * @param arrays The lines to join, without their line endings.
 */
export function concatLines(arrays: Uint8Array[]): Uint8Array {
  if (!arrays.length) {
    return new Uint8Array(0);
  }

  const al = arrays.length;

  let totalLength = al;
  for (let i = 0; i < al; i++) {
    totalLength += arrays[i].length;
  }

  const result = new Uint8Array(totalLength);

  let pos = 0;
  for (let i = 0; i < al; i++) {
    const array = arrays[i];
    result.set(array, pos);
    pos += array.length;
    result[pos++] = LF;
  }

  return result;
}

/** Options for a {@link range} that stops before `to`. */
export interface RangeToOptions {
  /** The first number. Default 0. */
  from?: number;
  /** Stop before reaching this number (exclusive). */
  to: number;
  /** Added each time; negative counts down. Default 1. */
  step?: number;
}

/** Options for a {@link range} that may end on `until`. */
export interface RangeUntilOptions {
  /** The first number. Default 0. */
  from?: number;
  /** Stop after passing this number; it is included if the steps land on it. */
  until: number;
  /** Added each time; negative counts down. Default 1. */
  step?: number;
}

/**
 * Count from `from` (default 0) by `step` (default 1), as an Enumerable.
 *
 * With `to`, it stops before `to`; with `until`, it includes `until` when a
 * step lands on it. Both are limits, not targets: `{ from: 1, until: 10, step:
 * 3 }` gives 1, 4, 7, 10, and `{ from: 1, to: 10, step: 3 }` gives 1, 4, 7. A
 * negative `step` counts down, and the limit is then below `from`. A step
 * that moves away from the limit gives nothing (`{ from: 5, to: 0 }` is
 * empty). Numbers are made one at a time as they are read, so `to: Infinity`
 * works with `.take()`.
 *
 * Fractional steps add up floating-point error: `{ until: 0.3, step: 0.1 }`
 * gives 0, 0.1, 0.2, because the fourth value is 0.30000000000000004.
 *
 * A `step` of 0 or NaN throws `RangeError` at the call, and so does one too
 * small to change `from` (1 from 2⁵³, say), which would count forever.
 *
 * @example
 * ```typescript
 * import { range } from "@j50n/proc";
 *
 * await range({ to: 3 }).collect(); // [0, 1, 2]
 * await range({ from: 1, until: 3 }).collect(); // [1, 2, 3]
 * await range({ from: 3, until: 1, step: -1 }).collect(); // [3, 2, 1]
 * ```
 *
 * @param options Where to start and stop, and the step.
 */
export function range(
  options: RangeToOptions | RangeUntilOptions,
): Enumerable<number> {
  const s = options.step ?? 1;
  const f = options.from ?? 0;
  if (s === 0 || Number.isNaN(s)) {
    throw new RangeError(`step must be a number other than 0; got ${s}`);
  }
  if (f + s === f) {
    // Adding it would never move on from `from`.
    throw new RangeError(`step ${s} is too small to count from ${f}`);
  }

  async function* doRange(): AsyncIterable<number> {
    if ("to" in options) {
      const t = options.to;

      if (s > 0) {
        for (let i = f; i < t; i += s) {
          yield i;
        }
      } else {
        for (let i = f; i > t; i += s) {
          yield i;
        }
      }
    } else {
      const u = options.until;

      if (s > 0) {
        for (let i = f; i <= u; i += s) {
          yield i;
        }
      } else {
        for (let i = f; i >= u; i += s) {
          yield i;
        }
      }
    }
  }
  return enumerate(doRange());
}

/**
 * Resolve after `delayms` milliseconds, using `setTimeout`. Other work keeps
 * running while it waits.
 *
 * @example
 * ```typescript
 * import { SECONDS, sleep } from "@j50n/proc";
 *
 * await sleep(2 * SECONDS);
 * ```
 *
 * @param delayms How long to wait, in milliseconds.
 */
export async function sleep(delayms: number): Promise<void> {
  await new Promise<void>((resolve, _reject) =>
    setTimeout(() => resolve(), delayms)
  );
}

/**
 * Whether `s` is a string primitive (`typeof s === "string"`), as a type
 * guard. A `String` object is not one.
 *
 * @example
 * ```typescript
 * import { isString } from "@j50n/proc";
 *
 * const value: unknown = "hello";
 * if (isString(value)) {
 *   console.log(value.toUpperCase());
 * }
 * ```
 *
 * @param s The value to check.
 */
export function isString(s: unknown): s is string {
  return typeof s === "string";
}

/**
 * Shuffle an array in place, in linear time (Fisher-Yates). It returns
 * nothing; the array you pass is the result. It uses `Math.random`, so it is
 * not for anything that needs to be unpredictable.
 *
 * @example
 * ```typescript
 * import { shuffle } from "@j50n/proc";
 *
 * const cards = ["A", "K", "Q", "J"];
 * shuffle(cards);
 * ```
 *
 * @param items The array to shuffle.
 */
export function shuffle<T>(items: T[]) {
  for (let i = 0; i < items.length; i++) {
    const j = Math.floor(Math.random() * (items.length - i)) + i;
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

/**
 * Write all of `data` to a `Writer` (such as `Deno.stdout`), calling `write`
 * again until every byte is written. It does not close the writer, and an
 * error from `write` is thrown unchanged.
 *
 * @example
 * ```typescript
 * import { writeAll } from "@j50n/proc";
 *
 * await writeAll(new TextEncoder().encode("hello\n"), Deno.stdout);
 * ```
 *
 * @param data The bytes to write.
 * @param writer Where to write them.
 */
export async function writeAll(data: Uint8Array, writer: Writer) {
  const len = data.length;

  let n = await writer.write(data);

  while (n < len) {
    n += await writer.write(data.subarray(n));
  }
}
