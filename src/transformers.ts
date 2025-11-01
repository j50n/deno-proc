import { blue } from "@std/fmt/colors";
import { enumerate } from "./enumerable.ts";
import { bestTypeNameOf } from "./helpers.ts";
import { concat, concatLines, isString } from "./utility.ts";

const encoder = new TextEncoder();

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
    const lines = decoder.decode(buff, { stream: true }).split(/\r?\n/g);
    lines[0] = leftover + lines[0];

    leftover = lines.pop()!;

    if (lines.length !== 0) {
      yield lines;
    }
  }

  const lines = decoder.decode().split("\n");
  lines[0] = leftover + lines[0];

  if (lines.at(-1)!.length === 0) {
    lines.pop();
  }

  if (lines.length !== 0) {
    yield lines;
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

function stringPerLineOp(item: string) {
  return concatLines([encoder.encode(item)]);
}

function uint8arrayPerLineOp(item: Uint8Array) {
  return item;
}

function stringArrayOfLinesOp(item: string[]) {
  const lines = Array(item.length);

  for (let i = 0; i < item.length; i++) {
    lines[i] = encoder.encode(item[i]);
  }

  return concatLines(lines);
}

function uint8arrayArrayOfLinesOp(item: Uint8Array[]) {
  return concat(item);
}

/**
 * Convert strings, string arrays, or byte arrays to Uint8Array chunks.
 *
 * Conversion rules:
 * - `string`: Converted to UTF-8 bytes with trailing newline
 * - `string[]`: Each string converted to UTF-8 with newline, concatenated
 * - `Uint8Array`: Passed through unchanged
 * - `Uint8Array[]`: Concatenated into single array
 *
 * Strings are always treated as lines (newline added). Bytes are treated as binary data.
 *
 * @example Convert string to bytes
 * ```typescript
 * import { enumerate, toBytes } from "jsr:@j50n/proc";
 *
 * const bytes = await enumerate(["hello"])
 *   .transform(toBytes)
 *   .collect();
 * // Uint8Array with "hello\n"
 * ```
 *
 * @example Convert string array to bytes
 * ```typescript
 * import { enumerate, toBytes } from "jsr:@j50n/proc";
 *
 * const bytes = await enumerate([["line1", "line2"]])
 *   .transform(toBytes)
 *   .collect();
 * // Uint8Array with "line1\nline2\n"
 * ```
 *
 * @param iter The iterable to convert.
 * @returns An AsyncIterable of Uint8Array chunks.
 */
export async function* toBytes(
  iter: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  const setupOp: (item: StandardData) => Uint8Array = (
    item: StandardData,
  ) => {
    if (isString(item)) {
      op = stringPerLineOp as typeof setupOp;
      return op(item);
    } else if (item instanceof Uint8Array) {
      op = uint8arrayPerLineOp as typeof setupOp;
      return op(item);
    } else if (Array.isArray(item)) {
      if (item.length === 0) {
        return new Uint8Array(0);
      } else if (isString(item[0])) {
        op = stringArrayOfLinesOp as typeof setupOp;
        return op(item);
      } else if (item[0] instanceof Uint8Array) {
        op = uint8arrayArrayOfLinesOp as typeof setupOp;
        return op(item);
      } else {
        throw new TypeError(
          `runtime type error; expected array data of string|Uint8Array but got ${
            bestTypeNameOf(item[0])
          }`,
        );
      }
    } else {
      throw new TypeError(
        `runtime type error; expected string|Uint8Array|Array[...] but got ${
          bestTypeNameOf(item)
        }`,
      );
    }
  };

  let op = setupOp;

  for await (const item of iter) {
    yield op(item);
  }
}

/**
 * For transformers that need `BufferSource` as input, this will convert
 * the type of the output; otherwise identical to {@link toBytes}.
 *
 * This is needed for working directly with `CompressionStream` and
 * `DecompressionStream`.
 *
 * @param iter The iterable.
 */
export async function* toBufferSource(
  iter: AsyncIterable<StandardData>,
): AsyncIterable<BufferSource> {
  yield* toBytes(iter) as AsyncIterable<BufferSource>;
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
 * Convert objects to JSON-encoded strings (one per line).
 *
 * Useful for serializing structured data to pass between processes
 * or save to files in JSONL (JSON Lines) format.
 *
 * @example Serialize objects to JSON
 * ```typescript
 * import { enumerate, jsonStringify } from "jsr:@j50n/proc";
 *
 * const objects = [{ id: 1 }, { id: 2 }];
 * const json = await enumerate(objects)
 *   .transform(jsonStringify)
 *   .collect();
 * // ['{"id":1}', '{"id":2}']
 * ```
 *
 * @param items The objects to convert.
 * @returns An AsyncIterable of JSON strings.
 */
export async function* jsonStringify<T>(
  items: AsyncIterable<T>,
): AsyncIterable<string> {
  for await (const item of items) {
    yield JSON.stringify(item);
  }
}

/**
 * Parse JSON-encoded strings into objects.
 *
 * Useful for deserializing JSONL (JSON Lines) format data.
 * Each line should be a complete JSON object.
 *
 * @example Parse JSON lines to objects
 * ```typescript
 * import { enumerate, jsonParse } from "jsr:@j50n/proc";
 *
 * const lines = ['{"id":1}', '{"id":2}'];
 * const objects = await enumerate(lines)
 *   .transform(jsonParse)
 *   .collect();
 * // [{ id: 1 }, { id: 2 }]
 * ```
 *
 * @param items The JSON-encoded strings.
 * @returns An AsyncIterable of parsed objects.
 */
export async function* jsonParse<T>(
  items: AsyncIterable<string>,
): AsyncIterable<T> {
  for await (const item of items) {
    yield JSON.parse(item);
  }
}

/**
 * Decompress gzip-compressed data.
 *
 * Works with any StandardData input (strings, bytes, arrays).
 * Useful for reading compressed files or decompressing process output.
 *
 * @example Decompress gzip data
 * ```typescript
 * import { read, gunzip } from "jsr:@j50n/proc";
 *
 * const text = await read("data.txt.gz")
 *   .transform(gunzip)
 *   .lines
 *   .collect();
 * ```
 *
 * @param items The compressed data.
 * @returns An AsyncIterable of decompressed bytes.
 */
export async function* gunzip(
  items: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  const s = new DecompressionStream("gzip");

  yield* enumerate(items)
    .transform(toBufferSource)
    .transform({ readable: s.readable, writable: s.writable });
}

/**
 * Compress data using gzip.
 *
 * Works with any StandardData input (strings, bytes, arrays).
 * Useful for compressing data before writing to files or sending to processes.
 *
 * @example Compress data
 * ```typescript
 * import { enumerate, gzip } from "jsr:@j50n/proc";
 *
 * const compressed = await enumerate(["data to compress"])
 *   .transform(gzip)
 *   .collect();
 * ```
 *
 * @param chunks The data to compress.
 * @returns An AsyncIterable of compressed bytes.
 */
export function gzip(
  chunks: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  return enumerate(chunks)
    .transform(toBufferSource)
    .transform(new CompressionStream("gzip"));
}

/**
 * Convert a `TransformStream` into a {@link TransformerFunction}. Errors occurring upstream
 * are correctly propagated through the transformation.
 *
 * @param transform A [TransformStream](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream).
 * @returns A transformer.
 */
export function transformerFromTransformStream<IN, OUT>(
  transform: { writable: WritableStream<IN>; readable: ReadableStream<OUT> },
): TransformerFunction<IN, OUT> {
  let error: Error | undefined;

  async function* errorTrap(items: AsyncIterable<IN>): AsyncIterable<IN> {
    try {
      yield* items;
    } catch (e) {
      error = e as Error | undefined;
    }
  }

  async function* converter(
    items: AsyncIterable<IN>,
  ): AsyncIterable<OUT> {
    try {
      yield* ReadableStream
        .from(errorTrap(items))
        .pipeThrough<OUT>(transform);
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
