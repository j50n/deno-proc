import { blue } from "jsr:@std/fmt@1.0.2/colors";
import { enumerate } from "./enumerable.ts";
import { bestTypeNameOf } from "./helpers.ts";
import { concat, isString } from "./utility.ts";

/**
 * Standard data, either string, arrays of strings (lines),
 * byte data, or arrays of byte data.
 */
export type StandardData = string | Uint8Array | string[] | Uint8Array[];

/**
 * Type signature of a transformer.
 */
export type TransformerFunction<T, U> = (
  it: AsyncIterable<T>,
) => AsyncIterable<U>;

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<string>` of lines.
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
 * For larger data sets and very small lines (like broken into one word per line),
 * using this helps keep the data being passed at reasonable sizes and avoids
 * the "small string" problem. Consider using this instead of {@link toLines} in that
 * case.
 *
 * @param buffs The iterable bytes.
 */
export async function* toChunkedLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string[]> {
  let leftover: string = "";

  const decoder = new TextDecoder("utf-8", { fatal: true });
  for await (const buff of buffs) {
    const lines = decoder.decode(buff, { stream: true }).split("\n");
    lines[0] = leftover + lines[0];
    leftover = lines.pop()!;
    if (lines.length !== 0) {
      yield lines;
    }
  }

  const lines = decoder.decode().split("\n");
  lines[0] = leftover + lines[0];
  leftover = lines.pop()!;
  if (lines.length !== 0) {
    yield lines;
  }

  if (leftover.length !== 0) {
    yield [leftover];
  }
}

/**
 * Convert an `AsyncIterable<Uint8Array>` into an `AsyncIterable<Uint8Array[]>`
 * (an array of lines chunked together based on buffer size)
 * split on `lf` and also suppressing trailing `cr`.
 *
 * `lf` and trailing `cr`
 * is removed from the returned lines. As this is line-oriented data, if the
 * last line is empty (the last byte was a line feed, splitting into one extra line),
 * it is suppressed.
 *
 * Implementation attempts to minimize object creation.
 *
 * @param buffs The iterable bytes.
 */
export async function* toByteLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array[]> {
  /*
   * Performance notes:
   *
   * Uint8Array.subarray() returns a lightweight view into the original array.
   * I can't get away from creating the object for the original array, and
   * I also end up with disposable subarray objects. Can't be helped. GC pressure.
   *
   * The inner loop is looking for '\n' (number 10) in the data and calling that
   * the end of the line. This is an array index operation, whichs 10x faster than
   * `for...of`, and I expect it is close to or at C speed.
   *
   * The overhead of async operations is relatively about 100x, so the buffer size
   * matters, and the line size might matter as this data is usually flattened
   * downstream.
   *
   * I think this is as fast as I can make this in pure JavaScript.
   */

  const completeLines: Uint8Array[] = [];
  const currentLine: Uint8Array[] = [];

  function makeCurrentLineComplete() {
    const line = concat(currentLine);
    currentLine.length = 0;

    const lineLen = line.length;
    if (lineLen > 0 && line[lineLen - 1] === 13) {
      completeLines.push(line.subarray(0, lineLen - 1));
    } else {
      completeLines.push(line);
    }
  }

  for await (const buff of buffs) {
    const buffLen = buff.length;
    let lastPos = 0;

    for (let pos = 0; pos < buffLen; pos++) {
      if (buff[pos] === 10) {
        currentLine.push(buff.subarray(lastPos, pos));
        makeCurrentLineComplete();
        lastPos = pos + 1;
      }
    }

    if (lastPos < buffLen) {
      currentLine.push(buff.subarray(lastPos, buffLen));
    }

    if (completeLines.length > 0) {
      yield completeLines;
      completeLines.length = 0;
    }
  }

  if (currentLine.length > 0) {
    makeCurrentLineComplete();
  }

  if (completeLines.length > 0) {
    yield completeLines;
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
  iter: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  const encoder = new TextEncoder();
  const lf = encoder.encode("\n");

  for await (const item of iter) {
    if (isString(item)) {
      yield concat([encoder.encode(item), lf]);
    } else if (item instanceof Uint8Array) {
      yield item;
    } else if (Array.isArray(item)) {
      for (const piece of item) {
        const lines: Uint8Array[] = [];
        if (piece instanceof Uint8Array) {
          lines.push(piece);
        } else if (isString(piece)) {
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
 * Transformer that conditionally adds buffering to a `Uint8Array` stream.
 *
 * This enforces that the size of the passed data is _at least_ `size`. Note that
 * data is never reduced in size. It is either passed through unchanged (if it is
 * big enough already) or held and concatenated with the next data until it there
 * is enough data to write through.
 *
 * If `size` is 0 or negative, the input data is passed through without buffering.
 *
 * You do not normally need to use this transform directly as you can turn on
 * input buffering with a parameter to the `run` method or function.
 */
export function buffer(
  size = 0,
): TransformerFunction<Uint8Array, Uint8Array> {
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

  if (size <= 0) {
    return (iter) => iter;
  } else {
    return buffergen;
  }
}

/**
 * Convert objects into JSON-encoded lines.
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

/**
 * Decompress a `gzip` compressed stream.
 */
export const gunzip: TransformerFunction<
  BufferSource,
  Uint8Array<ArrayBufferLike>
> = transformerFromTransformStream(
  new DecompressionStream("gzip"),
);

/**
 * Compress string or byte data using `gzip`.
 */
export function gzip(
  chunks: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  return enumerate(chunks)
    .transform(toBytes)
    .transform(transformerFromTransformStream(
      new CompressionStream("gzip"),
    ));
}

/**
 * Convert a `TransformStream` into a {@link TransformerFunction}. Errors occurring upstream
 * are correctly propagated through the transformation.
 *
 * @param transform A [TransformStream](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream).
 * @returns A transformer.
 */
export function transformerFromTransformStream<R, T>(
  transform: { writable: WritableStream<R>; readable: ReadableStream<T> },
): TransformerFunction<R, T> {
  let error: Error | undefined;

  async function* errorTrap(items: AsyncIterable<R>) {
    try {
      for await (const item of items) {
        yield item;
      }
    } catch (e) {
      error = e as Error | undefined;
    }
  }

  async function* converter(
    items: AsyncIterable<R>,
  ): AsyncIterable<T> {
    try {
      for await (
        const item of ReadableStream.from(errorTrap(items))
          .pipeThrough(transform)
      ) {
        yield item;
      }
    } catch (e) {
      if (error == null) {
        error = e as Error | undefined;
      }
    }

    if (error != null) {
      throw error;
    }
  }

  return converter;
}

/**
 * Debug output using `console.dir` through {@link Enumerable#transform}.
 *
 * @param items The items to log.
 */
export async function* debug<T>(items: AsyncIterable<T>): AsyncIterable<T> {
  for await (const item of items) {
    console.log(blue(JSON.stringify(item)));
    yield item;
  }
}
