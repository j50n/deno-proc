import type { Writer } from "@std/io/types";
import { type Enumerable, enumerate } from "./enumerable.ts";

const LF = "\n".charCodeAt(0);

/**
 * Open a file for reading as an AsyncIterable of byte chunks.
 *
 * Returns an Enumerable that can be transformed, piped to processes,
 * or converted to lines. The file is automatically closed when iteration completes.
 *
 * @example Read a file and process it
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 *
 * const bytes = await read("data.txt").collect();
 * const text = new TextDecoder().decode(concat(bytes));
 * ```
 *
 * @param path The path of the file.
 * @returns An Enumerable of byte chunks.
 */
export function read(path: string | URL): Enumerable<Uint8Array> {
  async function* openForRead(): AsyncIterable<Uint8Array> {
    const file = await Deno.open(path);
    yield* file.readable;
  }

  return enumerate(openForRead());
}

/**
 * Fast-concatenate Uint8Array arrays into a single array.
 *
 * Optimized to avoid unnecessary copying:
 * - Returns empty array for empty input
 * - Returns the original array if only one element (no copy)
 * - Otherwise performs efficient concatenation
 *
 * @example Concatenate byte arrays
 * ```typescript
 * import { concat } from "jsr:@j50n/proc";
 *
 * const result = concat([
 *   new Uint8Array([1, 2]),
 *   new Uint8Array([3, 4])
 * ]);
 * // Uint8Array([1, 2, 3, 4])
 * ```
 *
 * @example Single array optimization
 * ```typescript
 * import { concat } from "jsr:@j50n/proc";
 *
 * const arr = new Uint8Array([1, 2, 3]);
 * const result = concat([arr]);
 * // Returns arr directly (no copy)
 * ```
 *
 * @param arrays The arrays to concatenate.
 * @returns The concatenated result.
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
 * Fast-concatenate `Uint8Arrays` arrays together, adding a trailing line feed,
 * returning a single array containing the result.
 *
 * @param arrays The arrays to concatenate together.
 * @returns The result of the concatenation.
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
 * Lazily generate a range of numbers as an AsyncIterable.
 *
 * Two forms available:
 * - **to**: Exclusive upper bound
 * - **until**: Inclusive upper bound
 *
 * Supports negative steps for counting down.
 *
 * @example Exclusive range (to)
 * ```typescript
 * import { range } from "jsr:@j50n/proc";
 *
 * const result = await range({ to: 3 }).collect();
 * // [0, 1, 2]
 * ```
 *
 * @example Inclusive range (until)
 * ```typescript
 * import { range } from "jsr:@j50n/proc";
 *
 * const result = await range({ from: 1, until: 3 }).collect();
 * // [1, 2, 3]
 * ```
 *
 * @example Negative step
 * ```typescript
 * import { range } from "jsr:@j50n/proc";
 *
 * const result = await range({ from: -1, until: -3, step: -1 }).collect();
 * // [-1, -2, -3]
 * ```
 *
 * @param options Range configuration.
 * @returns An Enumerable of numbers.
 * @see {@link RangeToOptions}
 * @see {@link RangeUntilOptions}
 */
export function range(
  options: RangeToOptions | RangeUntilOptions,
): Enumerable<number> {
  const s = options.step ?? 1;
  if (s === 0) {
    throw new RangeError("step cannot be 0");
  }

  async function* doRange(): AsyncIterable<number> {
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
 * Type guard to check if a value is a string.
 *
 * Handles both string primitives and String objects.
 *
 * @example Type narrowing
 * ```typescript
 * import { isString } from "jsr:@j50n/proc";
 *
 * const value: unknown = "hello";
 * if (isString(value)) {
 *   // TypeScript knows value is string here
 *   console.log(value.toUpperCase());
 * }
 * ```
 *
 * @param s The value to check.
 * @returns True if the value is a string.
 */
export function isString(s: unknown): s is string {
  return typeof s === "string";
}

/**
 * Performs an in-place shuffle of an array in linear time.
 *
 * This function uses the Fisher-Yates (also known as Knuth) shuffle algorithm to rearrange
 * the elements in the array in a random order. The shuffle is performed in-place, meaning
 * that it modifies the original array instead of creating a new one. The time complexity of
 * the algorithm is `O(n)`, where `n` is the number of elements in the array.
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
 * Low level write without locking, writing in multiple chunks if needed.
 *
 * Data is written completely. Does not attempt to close the writer.
 *
 * @param data The data to write.
 * @param writer The writer.
 */
export async function writeAll(data: Uint8Array, writer: Writer) {
  const len = data.length;

  let n = await writer.write(data);

  while (n < len) {
    n += await writer.write(data.subarray(n));
  }
}
