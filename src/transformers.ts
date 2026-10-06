import { blue } from "@std/fmt/colors";
import { enumerate } from "./enumerable.ts";
import { bestTypeNameOf } from "./helpers.ts";
import { concat, concatLines, isString } from "./utility.ts";

const encoder = new TextEncoder();

/**
 * The data {@link toBytes} turns into bytes, and so the data a process's stdin
 * accepts: a string or array of strings (lines of text), or a `Uint8Array` or
 * array of them (raw bytes).
 */
export type StandardData = string | Uint8Array | string[] | Uint8Array[];

/**
 * A function from one async iterable to another: what
 * {@link Enumerable.transform} takes. An `async function*` that loops over its
 * input and yields is the usual way to write one.
 *
 * @example
 * ```typescript
 * import { enumerate, type TransformerFunction } from "@j50n/proc";
 *
 * const double: TransformerFunction<number, number> = async function* (items) {
 *   for await (const n of items) yield n * 2;
 * };
 *
 * await enumerate([1, 2]).transform(double).collect(); // [2, 4]
 * ```
 */
export type TransformerFunction<T, U> = (
  it: AsyncIterable<T>,
) => AsyncIterable<U>;

/**
 * Decode UTF-8 bytes into lines of text.
 *
 * Splits on `\n` and drops a `\r` before it, so CRLF works too; line endings
 * are not included. A last line without a newline is still delivered, and one
 * final newline does not make an extra empty line (`"a\nb\n"` gives `"a"`,
 * `"b"`). Empty input gives no lines.
 *
 * `.lines` on an Enumerable is this; use the function on a plain async
 * iterable, or inside a transformer of your own.
 *
 * Invalid UTF-8, including a sequence cut off at the end of input, throws
 * `TypeError`.
 *
 * @example
 * ```typescript
 * import { toLines } from "@j50n/proc";
 *
 * using file = await Deno.open("data.txt");
 * for await (const line of toLines(file.readable)) {
 *   console.log(line);
 * }
 * ```
 *
 * @param buffs The bytes, in chunks of any size.
 */
export async function* toLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string> {
  for await (const lines of toChunkedLines(buffs)) {
    yield* lines;
  }
}

/**
 * Decode UTF-8 bytes into lines of text, yielded in arrays: each array holds
 * the lines completed by one input chunk.
 *
 * The lines are the same as {@link toLines} gives. Handing them on an array at
 * a time costs one async step per chunk instead of one per line, which is
 * faster when there are many short lines. `.chunkedLines` on an Enumerable is
 * this; add `.flatten()` to get single lines back.
 *
 * Invalid UTF-8 throws `TypeError`.
 *
 * @example
 * ```typescript
 * import { run } from "@j50n/proc";
 *
 * let count = 0;
 * await run("cat", "words.txt").chunkedLines.forEach((lines) => {
 *   count += lines.length;
 * });
 * ```
 *
 * @param buffs The bytes, in chunks of any size.
 */
export async function* toChunkedLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<string[]> {
  let leftover: string = "";

  const decoder = new TextDecoder("utf-8", { fatal: true });

  for await (const buff of buffs) {
    // Split on LF alone and drop the CR afterward, since a CRLF can arrive
    // with the CR at the end of one chunk and the LF at the start of the next.
    const lines = decoder.decode(buff, { stream: true }).split("\n");
    lines[0] = leftover + lines[0];

    leftover = lines.pop()!;

    if (lines.length !== 0) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].endsWith("\r")) lines[i] = lines[i].slice(0, -1);
      }
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
 * Split bytes into lines without decoding them, yielded in arrays: each array
 * holds the lines completed by one input chunk.
 *
 * Use it for data that isn't UTF-8, or to skip decoding. Lines split as in
 * {@link toLines}: on `\n`, with a `\r` before it dropped, a last line without
 * a newline delivered, and no extra empty line after a final newline. A `\r`
 * at the very end of input is dropped as well. Lines are views on the input
 * chunks where they can be, not copies.
 *
 * @example
 * ```typescript
 * import { read, toByteLines } from "@j50n/proc";
 *
 * const lengths = await read("data.bin")
 *   .transform(toByteLines)
 *   .flatten()
 *   .map((line) => line.length)
 *   .collect();
 * ```
 *
 * @param buffs The bytes, in chunks of any size.
 */
export async function* toByteLines(
  buffs: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array[]> {
  // Lines are subarray views on the input; a line split across chunks is
  // joined. The indexed loop is much faster than `for...of` here.
  let completeLines: Uint8Array[] = [];
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
      completeLines = [];
    }
  }

  if (currentLine.length > 0) {
    makeCurrentLineComplete();
  }

  if (completeLines.length > 0) {
    yield completeLines;
  }
}

/** Bytes in an `ArrayBuffer`, which `CompressionStream` and friends require. */
type Bytes = Uint8Array<ArrayBuffer>;

/** `bytes` as is, or copied if a view on a `SharedArrayBuffer`. */
function ownBuffer(bytes: Uint8Array): Bytes {
  return bytes.buffer instanceof ArrayBuffer
    ? bytes as Bytes
    : new Uint8Array(bytes);
}

function stringPerLineOp(item: string) {
  return concatLines([encoder.encode(item)]) as Bytes;
}

function uint8arrayPerLineOp(item: Uint8Array) {
  return ownBuffer(item);
}

function stringArrayOfLinesOp(item: string[]) {
  const lines = Array(item.length);

  for (let i = 0; i < item.length; i++) {
    lines[i] = encoder.encode(item[i]);
  }

  return concatLines(lines) as Bytes;
}

function uint8arrayArrayOfLinesOp(item: Uint8Array[]) {
  return ownBuffer(concat(item));
}

/**
 * Turn lines of text, or bytes, into byte chunks: one chunk per item.
 *
 * - `string`: UTF-8, with `\n` added (strings are lines).
 * - `string[]`: each string UTF-8 with `\n` added, joined into one chunk.
 * - `Uint8Array`: unchanged.
 * - `Uint8Array[]`: joined into one chunk, nothing added.
 *
 * Items may mix these types. An empty array gives an empty chunk. Anything
 * else throws `TypeError`; an array is judged by its first element.
 *
 * `.run()`, a process's stdin, and `.toStdout()` do this for you. Use it
 * before anything that wants bytes: `.writeTo()` a file or `WritableStream`,
 * or a `CompressionStream`.
 *
 * @example
 * ```typescript
 * import { enumerate, toBytes } from "@j50n/proc";
 *
 * await enumerate(["line 1", "line 2"])
 *   .transform(toBytes)
 *   .writeTo("out.txt"); // "line 1\nline 2\n"
 * ```
 *
 * @param iter The lines or bytes.
 */
export async function* toBytes(
  iter: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array<ArrayBuffer>> {
  // Pick the op on the first item and keep it while items stay that type; an
  // item of another type picks again.
  const setupOp: (item: StandardData) => Bytes = (
    item: StandardData,
  ) => {
    if (isString(item)) {
      op = stringPerLineOp as typeof setupOp;
      accepts = isString;
      return op(item);
    } else if (item instanceof Uint8Array) {
      op = uint8arrayPerLineOp as typeof setupOp;
      accepts = (it) => it instanceof Uint8Array;
      return op(item);
    } else if (Array.isArray(item)) {
      if (item.length === 0) {
        return new Uint8Array(0);
      } else if (isString(item[0])) {
        op = stringArrayOfLinesOp as typeof setupOp;
        accepts = (it) => Array.isArray(it) && isString(it[0]);
        return op(item);
      } else if (item[0] instanceof Uint8Array) {
        op = uint8arrayArrayOfLinesOp as typeof setupOp;
        accepts = (it) => Array.isArray(it) && it[0] instanceof Uint8Array;
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
  let accepts: (item: StandardData) => boolean = () => false;

  for await (const item of iter) {
    yield accepts(item) ? op(item) : setupOp(item);
  }
}

/**
 * The same as {@link toBytes}, typed as `BufferSource`.
 *
 * @deprecated `toBytes` output already goes straight into `CompressionStream`
 * and `DecompressionStream`; use it instead.
 *
 * @param iter The iterable.
 */
export async function* toBufferSource(
  iter: AsyncIterable<StandardData>,
): AsyncIterable<BufferSource> {
  yield* toBytes(iter) as AsyncIterable<BufferSource>;
}

/**
 * Make a transformer that joins small byte chunks into chunks of at least
 * `size` bytes.
 *
 * Chunks are held and joined until the total reaches `size`, then passed on
 * as one; a chunk already that big goes through as is. Chunks are never split,
 * and whatever is held at the end goes out as a last, smaller chunk. Fewer,
 * larger writes are cheaper, but held data waits: a child reading interactive
 * input sees nothing until a chunk fills.
 *
 * The `buffer: true` process option does this, at 16 KiB, for data piped into
 * a child's stdin.
 *
 * @example
 * ```typescript
 * import { buffer, read } from "@j50n/proc";
 *
 * await read("small-chunks.bin")
 *   .transform(buffer(64 * 1024))
 *   .writeTo("copy.bin");
 * ```
 *
 * @param size The least number of bytes per chunk. At 0 or below (the
 *   default), chunks pass through unchanged.
 */
export function buffer(
  size = 0,
): TransformerFunction<Uint8Array, Uint8Array> {
  async function* buffergen(
    iter: AsyncIterable<Uint8Array>,
  ): AsyncIterable<Uint8Array> {
    let len = 0;
    let pieces: Uint8Array[] = [];

    for await (const piece of iter) {
      len += piece.length;
      pieces.push(piece);

      if (len >= size) {
        yield concat(pieces);
        len = 0;
        pieces = [];
      }
    }

    if (pieces.length > 0) {
      yield concat(pieces);
    }
  }

  if (size <= 0) {
    return (iter) => iter;
  } else {
    return buffergen;
  }
}

/**
 * Turn each item into a string of JSON with `JSON.stringify`.
 *
 * The strings have no newline; {@link toBytes} (or `.run()`, or a process's
 * stdin) adds one to each, which makes JSON Lines. A value JSON can't hold
 * (a `BigInt`, a circular object) throws `TypeError`. `undefined` or a
 * function comes out as `undefined`, not a string.
 *
 * @example
 * ```typescript
 * import { enumerate, jsonStringify, toBytes } from "@j50n/proc";
 *
 * await enumerate([{ id: 1 }, { id: 2 }])
 *   .transform(jsonStringify)
 *   .transform(toBytes)
 *   .writeTo("out.jsonl"); // {"id":1}\n{"id":2}\n
 * ```
 *
 * @param items The values.
 */
export async function* jsonStringify<T>(
  items: AsyncIterable<T>,
): AsyncIterable<string> {
  for await (const item of items) {
    yield JSON.stringify(item);
  }
}

/**
 * Parse each string as one JSON value with `JSON.parse`: reads JSON Lines
 * after `.lines`.
 *
 * A string that isn't JSON throws `SyntaxError`, and that includes an empty
 * one, so a blank line in the input stops the pipeline; filter blank lines out
 * first if your data may have them. The type parameter `T` is not checked.
 *
 * @example
 * ```typescript
 * import { jsonParse, read } from "@j50n/proc";
 *
 * const events = await read("events.jsonl")
 *   .lines
 *   .filter((line) => line.length > 0)
 *   .transform(jsonParse<{ id: number }>)
 *   .collect();
 * ```
 *
 * @param items One JSON value per string.
 */
export async function* jsonParse<T>(
  items: AsyncIterable<string>,
): AsyncIterable<T> {
  for await (const item of items) {
    yield JSON.parse(item);
  }
}

/**
 * Decompress gzip data.
 *
 * Input goes through {@link toBytes} first, so byte arrays work as well as
 * single chunks. For plain byte chunks, `.transform(new
 * DecompressionStream("gzip"))` does the same. Data that isn't valid gzip
 * throws `TypeError`.
 *
 * @example
 * ```typescript
 * import { gunzip, read } from "@j50n/proc";
 *
 * const lines = await read("data.txt.gz")
 *   .transform(gunzip)
 *   .lines
 *   .collect();
 * ```
 *
 * @param items The compressed bytes.
 */
export async function* gunzip(
  items: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  const s = new DecompressionStream("gzip");

  yield* enumerate(items)
    .transform(toBytes)
    .transform({ readable: s.readable, writable: s.writable });
}

/**
 * Compress data with gzip.
 *
 * Input goes through {@link toBytes} first, so strings are compressed as lines
 * (each with `\n` added) and arrays are joined. For plain byte chunks,
 * `.transform(new CompressionStream("gzip"))` does the same.
 *
 * @example
 * ```typescript
 * import { enumerate, gzip } from "@j50n/proc";
 *
 * await enumerate(["line 1", "line 2"])
 *   .transform(gzip)
 *   .writeTo("out.txt.gz");
 * ```
 *
 * @param chunks The lines or bytes to compress.
 */
export function gzip(
  chunks: AsyncIterable<StandardData>,
): AsyncIterable<Uint8Array> {
  return enumerate(chunks)
    .transform(toBytes)
    .transform(new CompressionStream("gzip"));
}

/**
 * Wrap a `TransformStream` (or any `{ writable, readable }` pair) as a
 * {@link TransformerFunction}.
 *
 * An error thrown upstream arrives at the consumer unchanged, after the items
 * before it, rather than as a stream error. `.transform()` accepts a
 * `TransformStream` and wraps it this way itself, so you need this only to
 * get a function.
 *
 * A stream works once. Using the same transformer, or the same
 * `TransformStream`, a second time yields nothing and throws nothing; create a
 * new stream for each use.
 *
 * @example
 * ```typescript
 * import { enumerate, transformerFromTransformStream } from "@j50n/proc";
 *
 * const upper = transformerFromTransformStream(
 *   new TransformStream<string, string>({
 *     transform(s, controller) {
 *       controller.enqueue(s.toUpperCase());
 *     },
 *   }),
 * );
 *
 * await enumerate(["a", "b"]).transform(upper).collect(); // ["A", "B"]
 * ```
 *
 * @param transform The stream to wrap.
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
 * Log each item as it passes, unchanged, for debugging a pipeline.
 *
 * Each item is printed as JSON, in blue, with `console.log`, so it goes to
 * stdout, mixed into anything else the program writes there. An item
 * `JSON.stringify` can't handle (a `BigInt`, a circular object) throws
 * `TypeError` and stops the pipeline.
 *
 * @example
 * ```typescript
 * import { debug, run } from "@j50n/proc";
 *
 * const files = await run("ls")
 *   .lines
 *   .transform(debug<string>)
 *   .filter((f) => f.endsWith(".ts"))
 *   .collect();
 * ```
 *
 * @param items The items to log.
 */
export async function* debug<T>(items: AsyncIterable<T>): AsyncIterable<T> {
  for await (const item of items) {
    console.log(blue(JSON.stringify(item)));
    yield item;
  }
}
