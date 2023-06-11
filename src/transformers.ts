import { bestTypeNameOf } from "./helpers.ts";
import { concat } from "./utility.ts";

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<string>` of lines.
 *
 * There is a small performance penalty to using asynchronous iteration over using
 * an array directly. If you are working with a very large data set and the strings
 * you are working with are very small (e.g., word size), consider using
 * {@link toChunkedLines}.
 *
 * @param buffs The iterable bytes.
 */
export async function* toLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string> {
  const decoder = new TextDecoder();

  for await (const lines of toByteLines(buffs)) {
    for (const line of lines) {
      yield decoder.decode(line);
    }
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
export async function* toChunkedLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string[]> {
  const decoder = new TextDecoder();

  for await (const lines of toByteLines(buffs)) {
    yield lines.map((line) => decoder.decode(line));
  }
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<Uint8Array[]>`
 * (an array of lines chunked together based on buffer size)
 * split on `lf` and also suppressing trailing `cr`. `lf` and trailing `cr`
 * is removed from the returned lines.
 *
 * @param buffs The iterable bytes.
 */
export async function* toByteLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array[]> {
  /*
   * Using subarray since that is just a view. No copy operation. Faster.
   *
   * Iterating and testing byte-wise rather than using `find()`, which requires a
   * call to a function for each byte. Should be pretty close to byte-at-a-time
   * C-style scanning. Not as fast as a SIMD operation, but that isn't an option
   * here.
   *
   * The `TextDecodeStream` and `TextLineStream` streams are written in Typescript,
   * and they force a conversion to string before searching for line separators.
   * That is a slower operation. I think they are also using operations that force
   * buffers to be copied (depends on how V8 optimizes the operations), but
   * `Uint8Array.subarray` is a view-only operation guaranteed, so no memory copies.
   * So I think this is faster than the `std` library conversions. I real world cases
   * it doesn't matter anyway, as the processing time for a line is (conversion to and
   * from JSON, or Regexp parsing) is going to dominate splitting on lines.
   *
   * `async` and `yield` as well as iterables are first-class citizens of Javascript.
   * The V8 team has put a lot of work into optimizing these. I expect the performance
   * to be on par with anything in the streams library (maybe better?). Usage over time
   * will shake out any bad actors in this library.
   *
   * The bigger problem with the `std` library streams is the error handling
   * through streams. Maybe it is just broken as of 1.34.1 and will be fixed later.
   * Will have to check back later.
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

/**
 * Converts specific types to `Uint8Array` chunks.
 *
 * - `string` is converted to `utf-8`, concatenating a trailing `lf`
 * - `string[]` each item in the array is converted to `utf-8`, adding a trailing `lf`,
 *    all concatenated to a single `Uint8Array`
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
  const encoder = new TextEncoder();
  const lf = encoder.encode("\n");

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

/**
 * Convert objects into JSON.
 * @param items The objects to convert.
 */
export async function* jsonStringify<T>(
  items: AsyncIterable<T>,
): AsyncIterable<string> {
  for await (const item of items) {
    yield JSON.stringify(item);
  }
}

/**
 * Convert JSON-encoded lines into objects.
 * @param items The JSON-encoded lines.
 */
export async function* jsonParse<T>(
  items: AsyncIterable<string>,
): AsyncIterable<T> {
  for await (const item of items) {
    yield JSON.parse(item);
  }
}
