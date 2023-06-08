import { Enumerable, enumerate } from "./enumerable.ts";

/**
 * Concatenate arrays together, returning a single array containing the result.
 *
 * Note that this may return the original source data rather than a copy in some
 * circumstances.
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

  const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
  const result = new Uint8Array(totalLength);

  let pos = 0;
  for (const array of arrays) {
    result.set(array, pos);
    pos += array.length;
  }

  return result;
}

/**
 * A `to` range.
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
 * An `until` range.
 */
export interface RangeUntilOptions {
  /** Starting number inclusive; defaults to 1. */
  from?: number;
  /** Ending number inclusive. */
  until: number;
  /** Step value. Defaults to 1. */
  step?: number;
}

/**
 * Lazily produce a range of numbers.
 *
 * There are two forms:
 * - _from/to/step_: default 0 based, `to` is exclusive, and
 * - _from/until/step_: default 1 based, `until` is inclusive.
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
        for (let i = f; i >= t; i += s) {
          yield i;
        }
      }
    } else {
      const f = options.from ?? 1;
      const u = options.until;

      if (s > 0) {
        for (let i = f; i <= u; i += s) {
          yield i;
        }
      } else {
        for (let i = f; i > u; i += s) {
          yield i;
        }
      }
    }
  }
  return enumerate(doRange());
}
