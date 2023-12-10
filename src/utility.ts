import { Enumerable, enumerate } from "./enumerable.ts";

/**
 * Open a file for reading.
 * @param path The path of the file.
 */
export function read(path: string | URL): Enumerable<Uint8Array> {
  async function* openForRead(): AsyncIterable<Uint8Array> {
    const file = await Deno.open(path);
    yield* file.readable;
  }

  return enumerate(openForRead());
}

/**
 * Fast-concatenate `Uint8Arrays` arrays together, returning a single array containing the result.
 *
 * Note that this may return the original source data or a copy.
 *
 * @param arrays The arrays to concatenate together.
 * @returns The result of the concatenation.
 */
export function concat(arrays: Uint8Array[]): Uint8Array {
  if (!arrays.length) return new Uint8Array(0);

  /*
   * In many cases, we are dealing with data that actually only contains a single array of bytes
   * and does not actually need to be concatenated. In this case, we just return the first buffer
   * from the array (it is the only buffer) and skip the processing, saving a redundant memcpy.
   */
  if (arrays.length === 1) {
    return arrays[0];
  }

  let totalLength = 0;
  for (const array of arrays) {
    totalLength += array.length;
  }

  const result = new Uint8Array(totalLength);

  let pos = 0;
  for (const array of arrays) {
    result.set(array, pos);
    pos += array.length;
  }

  return result;
}

/**
 * Options for a `to` range. The `to` range is exclusive.
 */
export interface RangeToOptions {
  /** Starting number inclusive; defaults to 0. */
  from?: number;
  /** Ending number exclusinve. */
  to: number;
  /** Step value. Defaults to 1. */
  step?: number;
}

/**
 * Options for an `until` range. The `until` value is inclusive.
 */
export interface RangeUntilOptions {
  /** Starting number inclusive; defaults to 0. */
  from?: number;
  /** Ending number inclusive. */
  until: number;
  /** Step value. Defaults to 1. */
  step?: number;
}

/**
 * Lazily create a range of numbers.
 *
 * There are two forms:
 * - _from/to/step_: `to` is exclusive, and
 * - _from/until/step_:  `until` is inclusive.
 *
 * **Examples**
 *
 * `to` is exclusive:
 *
 * ```typescript
 * const result = await range({to: 3}).collect();
 * // [0, 1, 2]
 * ```
 *
 * `until` is inclusive. `from` starts at 0 by default.
 *
 * ```typescript
 * const result = await range({from: 1, until: 3}).collect();
 * // [1, 2, 3]
 * ```
 *
 * `step` can be negative. Default is 1.
 *
 * ```typescript
 * const result = await range({from: -1, until: -3, step: -1}).collect();
 * // [-1, -2, -3]
 * ```
 *
 * @param options Range options.
 * @see {@link RangeToOptions}
 * @see {@link RangeUntilOptions}
 */
export function range(
  options: RangeToOptions | RangeUntilOptions,
): Enumerable<number> {
  async function* doRange(): AsyncIterable<number> {
    const s = options.step ?? 1;
    if ("to" in options) {
      const f = options.from ?? 0;
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
      const f = options.from ?? 0;
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
 * The `sleep` function is used to pause the execution of the program for a specified amount of 
 * time. It returns a Promise that resolves after a set number of milliseconds, effectively causing a 
 * delay in the execution of the subsequent code.
 *
 * @param delayms The time in milliseconds for which the execution of the program will be halted. 
 * This parameter is required and must be a number.
 *
 * @returns A Promise that resolves after the specified number of milliseconds. It does not return 
 * any value upon resolution.
 *
 * ## Example
 * 
 * ```typescript
 * console.log("Program starts");
 * await sleep(2000);  // Pauses the execution for 2000 milliseconds
 * console.log("Program resumes after 2 seconds");
 * ```
 * In the above example, the program will print "Program starts", then it will pause for 2 seconds, 
 * and then it will print "Program resumes after 2 seconds".
 */
export async function sleep(delayms: number): Promise<void> {
  await new Promise<void>((resolve, _reject) =>
    setTimeout(() => resolve(), delayms)
  );
}

/**
 * Correct check to see if something is a string.
 * @param s The thing to be checked.
 * @returns `true` if the thing is a string.
 */
export function isString(s: unknown): s is string {
  return typeof s === "string" || s instanceof String ||
    Object.prototype.toString.call(s) === "[object String]";
}

/**
 * Perfect in-place array shuffle in linear time.
 */
export function shuffle<T>(items: T[]) {
  for (let i = 0; i < items.length; i++) {
    const j = Math.floor(Math.random() * items.length);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

/**
 * Low level write without locking, writing in multiple chunks if needed.
 *
 * Data is written completely. Does not attempt to close the writer.
 *
 * @param data The data to write.
 * @param writer The writer.
 */
export async function writeAll(data: Uint8Array, writer: Deno.Writer) {
  const len = data.length;

  let n = await writer.write(data);

  while (n < len) {
    n += await writer.write(data.subarray(n));
  }
}
