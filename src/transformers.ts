import { bestTypeNameOf } from "./helpers.ts";
import { concat } from "./utility.ts";

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<string>` of lines.
 *
 * Note that this should probably only be used with small data. Consider {@link toChunkedLines}
 * to improve performance with larger data.
 *
 * @param buffs The iterable bytes.
 */
export async function* toLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string> {
  for await (const lines of toChunkedLines(buffs)) {
    yield* lines;
  }
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<string[]>` of lines.
 *
 * For larger data, this keeps the data being passed at reasonable sizes and avoids
 * the "small string" problem. Consider using this instead of {@link toLines}
 *
 * @param buffs The iterable bytes.
 */
export function toChunkedLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string[]> {
  const decoder = new TextDecoder();

  return {
    async *[Symbol.asyncIterator]() {
      for await (const lines of toByteLines(buffs)) {
        yield lines.map((line) => decoder.decode(line));
      }
    },
  };
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<Uint8Array[]>`
 * (an array of lines chunked together based on buffer size)
 * split on `lf` and also suppressing trailing `cr`. `lf` and trailing `cr`
 * is removed from the returned lines.
 *
 * @param buffs The iterable bytes.
 */
async function* toByteLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array[]> {
  /*
   * Using subarray since that is just a view. No copy operation.
   *
   * Iterating and testing byte-wise rather than using `find()`, which requires a
   * call to a function for each byte. Should be pretty close to byte-at-a-time
   * C-style scanning. Not as fast as a SIMD operation, but that isn't an option
   * here.
   */
  let currentLine: Uint8Array[] = [];
  let lastline: undefined | Uint8Array;

  function bufferLine(): Uint8Array | undefined {
    function createLine(): Uint8Array {
      const line = concat(currentLine);

      if (line.length > 0 && line[line.length - 1] === 13) {
        /*  Strip the carriage return. */
        return line.subarray(0, line.length - 1);
      } else {
        return line;
      }
    }

    const temp = lastline;
    lastline = createLine();
    return temp;
  }

  try {
    for await (const buff of buffs) {
      const length = buff.length;

      const chunk: Uint8Array[] = [];

      let start = 0;
      for (let pos = 0; pos < length; pos++) {
        if (buff[pos] === 10) {
          if (pos) {
            currentLine.push(buff.subarray(start, pos));
          }

          const b = bufferLine();
          if (b) {
            chunk.push(b);
          }

          currentLine = [];
          start = pos + 1;
        }
      }

      if (chunk.length > 0) {
        yield chunk;
      }

      if (start < length) {
        currentLine.push(buff.subarray(start));
      }
    }
  } finally {
    const chunk: Uint8Array[] = [];

    if (currentLine.length > 0) {
      const b = bufferLine();
      if (b) {
        chunk.push(b);
      }
    }

    if (lastline?.length) {
      chunk.push(lastline);
    }

    if (chunk.length > 0) {
      yield chunk;
    }
  }
}

const encoder = new TextEncoder();
const lf = encoder.encode("\n");

/**
 * Converts specific types to `Uint8Array` chunks.
 *
 * - `string` is converted to `utf-8`, concatenating a trailing `lf`
 * - `string[]` each item in the array is converted to `utf-8`, adding a trailing `lf`,
 *   all concatenated to a single `Uint8Array`
 * - `Uint8Array` is passed on unchanged
 * - `Uint8Array[]` is concatenated to a single `Uint8Array`
 *
 * Strings are always treated as lines, and we add a trailing `lf` character. Data in
 * byte form is always treated strictly as binary data.
 *
 * @param iter
 */
export async function* toBytes(
  iter: AsyncIterable<string | Uint8Array | string[] | Uint8Array[]>,
): AsyncIterable<Uint8Array> {
  for await (const item of iter) {
    if (item instanceof Uint8Array) {
      yield item;
    } else if (typeof item === "string") {
      yield concat([encoder.encode(item), lf]);
    } else if (Array.isArray(item)) {
      for (const piece of item) {
        const lines: Uint8Array[] = [];
        if (piece instanceof Uint8Array) {
          lines.push(piece);
        } else if (typeof piece === "string") {
          lines.push(encoder.encode(piece));
          lines.push(lf);
        } else {
          throw new TypeError(
            `runtime type error; expected array data of string|Uint8Array but got ${
              bestTypeNameOf(piece)
            }`,
          );
        }
        yield concat(lines);
      }
    } else {
      throw new TypeError(
        `runtime type error; expected string|Uint8Array|Array[...] but got ${
          bestTypeNameOf(item)
        }`,
      );
    }
  }
}

/**
 * Transformer that conditionally forces buffering of a `Uint8Array` stream.
 *
 * This enforces that the size of the passed data is _at least_ `size`. Note that
 * data is never reduced in size. It is either passed through unchanged (if it is
 * big enough already) or held and concatenated with the next data until it there
 * is enough data to write through.
 *
 * If `size` is 0 or negative, the input data is passed through unaltered.
 */
export function buffer(
  size = 0,
): (iter: AsyncIterable<Uint8Array>) => AsyncIterable<Uint8Array> {
  if (size <= 0) {
    return (iter) => iter;
  } else {
    // deno-lint-ignore no-inner-declarations
    async function* buffergen(
      iter: AsyncIterable<Uint8Array>,
    ): AsyncIterable<Uint8Array> {
      let len = 0;
      let pieces: Uint8Array[] = [];

      try {
        for await (const piece of iter) {
          len += piece.length;
          pieces.push(piece);

          if (len >= size) {
            yield concat(pieces);
            size = 0;
            pieces = [];
          }
        }
      } finally {
        if (pieces.length > 0) {
          yield concat(pieces);
        }
      }
    }

    return buffergen;
  }
}
