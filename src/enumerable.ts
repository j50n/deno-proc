import { Process, type ProcessOptions } from "./process.ts";
import { abandon, handled, parseArgs } from "./helpers.ts";
import type { Cmd } from "./run.ts";
import type { Writable } from "./writable-iterable.ts";
import {
  buffer,
  type StandardData,
  toBytes,
  toChunkedLines,
  toLines,
  transformerFromTransformStream,
  type TransformerFunction,
} from "./transformers.ts";
import { writeAll } from "./utility.ts";
import { concurrentMap, concurrentUnorderedMap } from "./concurrent.ts";
import type { Closer, Writer } from "@std/io/types";
import { tee } from "./tee.ts";
import { replaceFile } from "./replace-file.ts";

/**
 * The item type of an iterable or async iterable `T`, or `never` if `T` is
 * neither. The result type of {@link Enumerable.flatten}.
 */
export type ElementType<T> = T extends
  Iterable<infer E> | AsyncIterable<infer E> ? E
  : never;

/**
 * `N` copies of `T` as a tuple when `N` is a literal number, or `T[]` when it
 * is just `number`. The result type of {@link Enumerable.tee}.
 */
export type Tuple<T, N extends number> = N extends N
  ? number extends N ? T[] : TupleOf<T, N, []>
  : never;

/** Builds the tuple for {@link Tuple}, one element at a time. */
export type TupleOf<T, N extends number, R extends unknown[]> =
  R["length"] extends N ? R
    : TupleOf<T, N, [T, ...R]>;

/**
 * A `{ writable, readable }` pair that {@link Enumerable.transform} accepts,
 * such as a `TransformStream` or `CompressionStream`: `R` goes in, `S` comes
 * out.
 */
export type TransformStream<R, S> = ReadableWritablePair<S, R>;

function isReadableWritablePair(item: unknown): item is ReadableWritablePair {
  return (item != null && typeof item === "object" && "writable" in item &&
    "readable" in item);
}
/**
 * What {@link Enumerable.unzip} returns: `[Enumerable<A>, Enumerable<B>]` for
 * items of type `[A, B]`, and `never` for any other items.
 */
export type Unzip<T> = T extends [infer A, infer B]
  ? [Enumerable<A>, Enumerable<B>]
  : never;

/**
 * What {@link Enumerable.lines} returns: `Enumerable<string>` when the items
 * are bytes, and `never` otherwise, so `.lines` on anything but bytes fails
 * to type-check.
 */
export type Lines<T> = T extends Uint8Array ? Enumerable<string> : never;

/**
 * What {@link Enumerable.chunkedLines} returns: `Enumerable<string[]>` when
 * the items are bytes, and `never` otherwise.
 */
export type ChunkedLines<T> = T extends Uint8Array ? Enumerable<string[]>
  : never;

/**
 * What {@link Enumerable.writeBytesTo} returns: `Promise<void>` when the
 * items are bytes, and `never` otherwise.
 */
export type ByteSink<T> = T extends Uint8Array ? Promise<void> : never;

/**
 * What {@link Enumerable.run} returns: a {@link ProcessEnumerable} when the
 * items are text or bytes (`string`, `string[]`, `Uint8Array`, `Uint8Array[]`),
 * and `never` otherwise.
 */
export type Run<S, T> = T extends Uint8Array | Uint8Array[] | string | string[]
  ? ProcessEnumerable<S>
  : never;

/**
 * Wrap an iterable or async iterable as an {@link Enumerable}, to use its
 * methods (`map`, `filter`, `collect`, `run`, ...).
 *
 * Arrays, Sets, generators, `ReadableStream`s, and anything else with
 * `Symbol.iterator` or `Symbol.asyncIterator` work. `null` and `undefined`
 * give an empty Enumerable, and an Enumerable comes back as it is.
 *
 * The items are not changed. Don't confuse this with
 * {@link Enumerable.enum}, which numbers the items, turning each into
 * `[item, index]`.
 *
 * @example
 * ```typescript
 * import { enumerate } from "@j50n/proc";
 *
 * const doubled = await enumerate([1, 2, 3]).map((n) => n * 2).collect();
 * // [2, 4, 6]
 * ```
 *
 * @example Feed strings to a command
 * ```typescript
 * import { enumerate } from "@j50n/proc";
 *
 * const sorted = await enumerate(["pear", "apple"]).run("sort").lines.collect();
 * // ["apple", "pear"]
 * ```
 */
export function enumerate<T>(
  iter?: AsyncIterable<T> | Iterable<T> | null,
): Enumerable<T> {
  async function* asAsyncIterable<T>(
    iter: Iterable<T>,
  ): AsyncIterable<T> {
    yield* iter;
  }

  if (iter == null) {
    return new Enumerable(asAsyncIterable(new Array(0)));
  } else if (iter instanceof Enumerable) {
    return iter;
  } else if (
    typeof (iter as AsyncIterable<T>)[Symbol.asyncIterator] === "function"
  ) {
    return new Enumerable(iter as AsyncIterable<T>);
  } else {
    return new Enumerable(asAsyncIterable(iter as Iterable<T>));
  }
}

/**
 * Options for {@link Enumerable.concurrentMap} and
 * {@link Enumerable.concurrentUnorderedMap}.
 */
export interface ConcurrentOptions {
  /**
   * How many calls of the mapping function may run at once. Default
   * `navigator.hardwareConcurrency`. Fractions round up; below 1 throws an
   * `Error` when reading starts.
   */
  concurrency?: number;
}

async function* identity<T>(iter: AsyncIterable<T>): AsyncIterableIterator<T> {
  yield* iter;
}

/**
 * Write each item, overlapping each write with reading the next item. If
 * reading throws, the write in flight finishes first, so what was read before
 * the error reaches its destination before the error reaches the caller. A
 * write that fails ends it at once, without waiting for the next item, which
 * from a quiet source could be a long time, and the source is closed.
 * `stop` is checked before each write.
 */
async function writeEach<T>(
  items: AsyncIterable<T>,
  write: (item: T) => Promise<unknown>,
  stop?: () => boolean,
): Promise<void> {
  const it = items[Symbol.asyncIterator]();
  let writing: Promise<unknown> | undefined;
  let failed = false;
  // Ends the wait for the next item, when a write fails during it.
  let interrupt: ((result: typeof FAILED) => void) | undefined;
  while (true) {
    let next: Promise<IteratorResult<T> | typeof FAILED> = handled(it.next());
    if (writing !== undefined) {
      const first = Promise.withResolvers<IteratorResult<T> | typeof FAILED>();
      interrupt = first.resolve;
      next.then(first.resolve, first.reject);
      next = first.promise;
    }
    let result: IteratorResult<T> | typeof FAILED;
    try {
      result = failed ? FAILED : await next;
    } catch (e) {
      await writing?.catch(() => {});
      throw e;
    }
    if (result === FAILED) {
      handled(it.return?.());
      await writing; // Throws the write's error.
      return;
    }
    if (result.done) break;
    try {
      await writing;
    } catch (e) {
      handled(it.return?.());
      throw e;
    }
    if (stop?.()) {
      await it.return?.();
      break;
    }
    writing = write(result.value);
    writing.then(undefined, () => {
      failed = true;
      interrupt?.(FAILED);
    });
  }
  await writing;
}

const FAILED = Symbol("failed");
const ENDED = Symbol("ended");
const NEVER: Promise<never> = new Promise(() => {});

/**
 * An async sequence with Array-style methods. {@link run}, {@link read},
 * {@link range}, and {@link enumerate} return one.
 *
 * It wraps one async iterable and reads it once. A second pass, through the
 * same Enumerable or another chain built on it, finds the source used up and
 * yields nothing, without an error: proc's own sources, arrays given to
 * `enumerate`, generators and streams all work this way. To use the items twice, `collect` them,
 * or split the sequence with {@link Enumerable.tee}.
 *
 * Methods that return an Enumerable are lazy: nothing is read until a
 * consumer pulls. `.run()` is the exception: it starts its process and begins
 * reading at the call.
 *
 * - Transform: `map`, `filter`, `filterNot`, `flatMap`, `flatten`, `enum`,
 *   `transform`, `concurrentMap`, `concurrentUnorderedMap`.
 * - Slice and combine: `take`, `drop`, `concat`, `zip`, `unzip`, `tee`.
 * - Consume: `collect` (or `toArray`), `forEach`, `reduce`, `count`, `find`,
 *   `some`, `every`, `first`, or `for await`. These return promises.
 * - Text and processes: `lines` and `chunkedLines` decode bytes into lines of
 *   text; `run` pipes the items into a command.
 * - Write out: `writeTo`, `writeBytesTo`, `toStdout`.
 *
 * Callbacks may be async. `map`, `filter`, `forEach`, and the rest wait for
 * each call before making the next; `concurrentMap` runs several at once.
 *
 * Errors, from a callback or a failed process, are thrown from the consumer,
 * so one `try` around the `await` catches them. A callback's error arrives
 * unchanged unless a `.run()` stands between it and the consumer; see
 * {@link Enumerable.run}.
 *
 * A consumer that stops early (`take`, `first`, `find`, `some`, `every`, or a
 * `break` out of `for await`) closes the source. For a process, that stops
 * reading its output, and its exit code is not checked.
 *
 * @example
 * ```typescript
 * import { run } from "@j50n/proc";
 *
 * const errors = await run("cat", "app.log")
 *   .lines
 *   .filter((line) => line.includes("ERROR"))
 *   .count();
 * ```
 *
 * @typeParam T The type of the items.
 */
export class Enumerable<T> implements AsyncIterable<T> {
  /**
   * For subclasses. To wrap an iterable, call {@link enumerate}.
   *
   * @param iter The async iterable to wrap.
   */
  constructor(protected iter: AsyncIterable<T>) {
  }

  /** Iterate with `for await`. The items come once; see {@link Enumerable}. */
  [Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    if ("next" in this.iter) {
      return this.iter as AsyncGenerator<T, void, unknown>;
    } else {
      return identity(this.iter) as AsyncGenerator<T, void, unknown>;
    }
  }

  /**
   * Number the items: each becomes `[item, index]`, counting from 0.
   *
   * Don't confuse this with {@link enumerate}, which wraps an iterable as an
   * Enumerable and leaves the items as they are.
   *
   * @example
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const numbered = await enumerate(["apple", "pear"])
   *   .enum()
   *   .map(([item, i]) => `${i + 1}. ${item}`)
   *   .collect();
   * // ["1. apple", "2. pear"]
   * ```
   */
  enum(): Enumerable<[T, number]> {
    const iter = this.iter;
    return enumerate({
      async *[Symbol.asyncIterator]() {
        // Per pass, so a source that can be read again is numbered from 0.
        let count = 0;
        for await (const item of iter) yield [item, count++];
      },
    });
  }

  /**
   * Write the items to a file, creating it or replacing what it held, and
   * close it.
   *
   * Items are written as {@link toStdout} writes them: bytes as they are,
   * each string as a line, an array of either as several. Any other item
   * throws a `TypeError`. The file is emptied before anything is read, so a
   * failure leaves it holding only what was written before it: the old
   * content is gone, and the error is thrown here. For the same reason,
   * `read(path)` feeding `writeTo(path)` finds the file already empty. To
   * replace a file only once everything has succeeded, or to rewrite it in
   * place, pass `{ atomic: true }`.
   *
   * With `atomic`, the items go to a new file beside `path`, flushed to disk
   * and renamed over it once they are all written. A failure leaves the old
   * file as it was, with nothing beside it, and the source may read the file
   * being replaced; if the process exits partway, under {@link main} or by
   * `Deno.exit`, the new file is removed. A symlink is followed and stays a
   * symlink, and the new file takes the old one's mode, read-only included.
   * A device such as `/dev/null`, and any path through `/dev` or `/proc`
   * (`/dev/stdout`), is written in place. It needs read permission on `path`
   * as well as write permission on its directory, and the file is a new one:
   * a hard link to the old file keeps the old content.
   *
   * @example
   * ```typescript
   * import { read } from "@j50n/proc";
   * import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";
   *
   * await read("data.csv")
   *   .transform(fromCsvToRows())
   *   .transform(toTsv())
   *   .writeTo("data.tsv");
   * ```
   *
   * @param path The file to write.
   * @param options.atomic Replace the file only once everything is written.
   *   Default `false`.
   */
  async writeTo(path: string, options?: { atomic?: boolean }): Promise<void>;

  /**
   * Write each item to a `WritableStream` or a {@link Writable}, then close
   * it.
   *
   * Pass `{ noclose: true }` to leave it open, as for `Deno.stdout.writable`.
   * If stdout's reader goes away (`| head`), writing to it stops quietly, as
   * {@link toStdout} does.
   * Writing to a `Writable` stops early if it is closed meanwhile, which for a
   * {@link WritableIterable} includes its reader stopping.
   *
   * If the source throws, a `WritableStream` is closed, not aborted, so what
   * was written before the error reaches it (an abort throws away what a
   * stream still holds), and the error is thrown here; with `noclose` it is
   * left open. Whatever reads the stream sees a normal end, so a destination
   * that must not take a partial result as complete, such as an upload,
   * needs the error from here. A
   * `Writable`, such as a {@link WritableIterable}, gets the error through
   * `close(error)` instead, so it reaches whoever reads the `Writable`, and
   * this promise resolves; with `noclose`, the `Writable` stays open and the
   * error is thrown here. An error from the destination itself, writing or
   * closing, is thrown here.
   *
   * @example
   * ```typescript
   * import { range, toBytes } from "@j50n/proc";
   *
   * await range({ to: 3 })
   *   .map((n) => `${n}`)
   *   .transform(toBytes)
   *   .writeTo(Deno.stdout.writable, { noclose: true });
   * ```
   *
   * @param writer Where the items go.
   * @param options.noclose Leave `writer` open afterward. Default `false`.
   */
  async writeTo(
    writer: Writable<T> | WritableStream<T>,
    options?: { noclose?: boolean },
  ): Promise<void>;

  async writeTo(
    writer: Writable<T> | WritableStream<T> | string,
    options?: { noclose?: boolean; atomic?: boolean },
  ): Promise<void> {
    // Handle file path. Closing the stream closes the file. Closing the file
    // directly instead drops whatever the stream still buffers (Deno 2.9).
    if (typeof writer === "string") {
      if (options?.atomic) {
        let writing = false;
        try {
          await replaceFile(writer, (path) => {
            writing = true;
            return this.writeTo(path);
          });
        } catch (e) {
          // It failed before reading anything; nothing else will read it.
          if (!writing) abandon(this.iter);
          throw e;
        }
        return;
      }
      let file: Deno.FsFile;
      try {
        file = await Deno.open(writer, {
          write: true,
          create: true,
          truncate: true,
        });
      } catch (e) {
        abandon(this.iter);
        throw e;
      }
      // Bytes as they are, strings as lines, as toStdout writes them, in
      // 64 KiB writes. Written with the file's own writes: Deno's
      // `file.writable` loses an error from its last flush, so a full disk
      // would look like success.
      await enumerate(toBytes(this.iter as AsyncIterable<StandardData>))
        .transform(buffer(64 * 1024))
        .writeBytesTo(file);
      return;
    }

    const iter = this.iter;

    if ("getWriter" in writer) {
      let w: WritableStreamDefaultWriter<T>;
      try {
        w = writer.getWriter();
      } catch (e) {
        abandon(iter);
        throw e;
      }
      // stdout's reader going away (`| head`) is an early stop, as in toStdout.
      const stdout = writer === Deno.stdout.writable;
      let readerGone = false;

      try {
        await writeEach(
          iter,
          (it) =>
            w.write(it).catch((e) => {
              if (!(stdout && e instanceof Deno.errors.BrokenPipe)) throw e;
              readerGone = true;
            }),
          () => readerGone,
        );
      } catch (e) {
        // Closed, not aborted: an abort throws away what a stream still
        // holds, and a file's writable holds up to 64 KiB, so a failing
        // command's log would come out empty. The first error is the one to
        // report.
        w.releaseLock();
        if (!options?.noclose) await writer.close().catch(() => {});
        throw e;
      }
      w.releaseLock();
      if (!options?.noclose) {
        const closing = writer.close();
        await (readerGone ? closing.catch(() => {}) : closing);
      }
    } else {
      let sinkFailed = false;
      try {
        await writeEach(
          iter,
          (it) =>
            writer.write(it).catch((e) => {
              sinkFailed = true;
              throw e;
            }),
          () => writer.isClosed,
        );
      } catch (e) {
        // The source's error goes to whoever reads the Writable; the
        // Writable's own is thrown here.
        if (options?.noclose || sinkFailed) throw e;
        await writer.close(e as Error | undefined);
        return;
      }
      if (!options?.noclose) await writer.close();
    }
  }

  /**
   * Pass the whole sequence through a transformer: a function from
   * `AsyncIterable<T>` to `AsyncIterable<U>` (usually an async generator), or
   * a `TransformStream` such as `CompressionStream`.
   *
   * This is how the data-format transforms (`fromCsvToRows()`, `toCsv()`,
   * ...) and {@link toBytes} plug in. A transformer sees the whole sequence,
   * so it can keep state, emit more or fewer items than it gets, and catch
   * errors from upstream. An error from upstream of a `TransformStream` is
   * thrown from the consumer unchanged.
   *
   * @example
   * ```typescript
   * import { read } from "@j50n/proc";
   *
   * await read("app.log")
   *   .transform(new CompressionStream("gzip"))
   *   .writeTo("app.log.gz");
   * ```
   *
   * @example An async generator as a transformer
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * async function* runningTotal(items: AsyncIterable<number>) {
   *   let total = 0;
   *   for await (const n of items) yield (total += n);
   * }
   *
   * const totals = await enumerate([1, 2, 3]).transform(runningTotal).collect();
   * // [1, 3, 6]
   * ```
   *
   * @param fn The transformer function or `TransformStream`.
   */
  transform<U>(
    fn:
      | TransformerFunction<T, U>
      | TransformStream<T, U>,
  ): Enumerable<U> {
    if (isReadableWritablePair(fn)) {
      return enumerate(transformerFromTransformStream(fn)(this));
    } else {
      return enumerate(fn(this));
    }
  }

  /**
   * Transform each item with `mapFn`, which may be async.
   *
   * One call at a time, in order. To run several at once, use
   * {@link concurrentMap}.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const upper = await run("ls").lines.map((name) => name.toUpperCase())
   *   .collect();
   * ```
   */
  map<U>(mapFn: (item: T) => U | Promise<U>): Enumerable<U> {
    const iter = this.iter;
    return new Enumerable({
      async *[Symbol.asyncIterator]() {
        // No reading ahead: each result goes out before the next item is
        // pulled, so it isn't lost if pulling throws, or delayed if the next
        // item is slow to come.
        for await (const it of iter) {
          yield await mapFn(it);
        }
      },
    }) as Enumerable<U>;
  }

  /**
   * Replace each item, itself an iterable or async iterable, with its items.
   *
   * The data transforms (`fromCsvToRows()` and the rest) yield batches of
   * rows; `.flatten()` gives one row at a time. A string is iterable too, so
   * a string item becomes its characters.
   *
   * @example
   * ```typescript
   * import { read } from "@j50n/proc";
   * import { fromCsvToRows } from "@j50n/proc/transforms";
   *
   * const rows = await read("data.csv")
   *   .transform(fromCsvToRows())
   *   .flatten()
   *   .count();
   * ```
   */
  flatten(): Enumerable<ElementType<T>> {
    const iter = this.iter as AsyncIterable<
      AsyncIterable<ElementType<T>> | Iterable<ElementType<T>>
    >;
    return new Enumerable({
      async *[Symbol.asyncIterator]() {
        for await (const it of iter) {
          yield* it;
        }
      },
    });
  }

  /**
   * Map each item to an iterable or async iterable, and yield the items of
   * each in turn: {@link map}, then {@link flatten}.
   *
   * @example
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const result = await enumerate([1, 2, 3])
   *   .flatMap((n) => [n, n * 10])
   *   .collect();
   * // [1, 10, 2, 20, 3, 30]
   * ```
   */
  flatMap<U>(mapFn: (item: T) => U | Promise<U>): Enumerable<ElementType<U>> {
    return this.map(mapFn).flatten();
  }

  /**
   * Like {@link map}, but with up to `concurrency` calls of `mapFn` running at
   * once. Results come out in input order, each as soon as it and the ones
   * before it are done.
   *
   * Because of the order, a slow item holds back the ones after it: their
   * results wait behind it, and no new call starts until it finishes. When
   * order doesn't matter, {@link concurrentUnorderedMap} keeps every slot
   * busy.
   *
   * An error from `mapFn` is thrown from the consumer when its item's turn
   * comes. Calls already started keep running. If the source throws, the
   * results of the calls already started come out first, then the error.
   *
   * @example
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const urls = ["https://example.com/a", "https://example.com/b"];
   * const pages = await enumerate(urls)
   *   .concurrentMap(async (url) => (await fetch(url)).text(), {
   *     concurrency: 4,
   *   })
   *   .collect();
   * ```
   *
   * @param mapFn The async mapping function.
   * @param options See {@link ConcurrentOptions}.
   */
  concurrentMap<U>(
    mapFn: (item: T) => Promise<U>,
    options?: ConcurrentOptions,
  ): Enumerable<U> {
    const iter = this.iter;
    return new Enumerable(
      concurrentMap(iter, mapFn, options?.concurrency),
    ) as Enumerable<U>;
  }

  /**
   * Like {@link map}, but with up to `concurrency` calls of `mapFn` running at
   * once. Results come out as they finish, not in input order.
   *
   * A new call starts as soon as any finishes, so a slow item doesn't hold
   * up the rest. When the output must line up with the input, use
   * {@link concurrentMap}, or carry the input along in the result.
   *
   * An error from `mapFn` is thrown from the consumer in the order it
   * happened. Calls already started keep running. If the source throws, the
   * results of the calls already started come out first, then the error.
   *
   * @example
   * ```typescript
   * import { enumerate, run } from "@j50n/proc";
   *
   * const files = ["a.log", "b.log", "c.log"];
   * await enumerate(files)
   *   .concurrentUnorderedMap(async (file) => {
   *     await run("gzip", file).collect();
   *     return file;
   *   })
   *   .forEach((file) => console.log(`compressed ${file}`));
   * ```
   *
   * @param mapFn The async mapping function.
   * @param options See {@link ConcurrentOptions}.
   */
  concurrentUnorderedMap<U>(
    mapFn: (item: T) => Promise<U>,
    options?: ConcurrentOptions,
  ): Enumerable<U> {
    const iter = this.iter;
    return new Enumerable(
      concurrentUnorderedMap(iter, mapFn, options?.concurrency),
    ) as Enumerable<U>;
  }

  /**
   * Keep the items for which `filterFn` returns true.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const evens = await range({ to: 5 }).filter((n) => n % 2 === 0).collect();
   * // [0, 2, 4]
   * ```
   */
  filter(
    filterFn: (item: T) => boolean | Promise<boolean>,
  ): Enumerable<T> {
    const iterable = this.iter;
    return new Enumerable({
      async *[Symbol.asyncIterator]() {
        for await (const item of iterable) {
          if (await filterFn(item)) {
            yield item;
          }
        }
      },
    }) as Enumerable<T>;
  }

  /**
   * Resolve to the first item for which `findFn` returns a truthy value, or
   * `undefined` if none does. Stops reading there and closes the source.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const found = await range({ to: 10 }).find((n) => n > 5);
   * // 6
   * ```
   */
  async find(
    findFn: (element: T) => unknown | Promise<unknown>,
  ): Promise<T | undefined> {
    for await (const element of this.iter) {
      if (await findFn(element)) {
        return element;
      }
    }
    return undefined;
  }

  /**
   * Resolve to true if `everyFn` returns true for every item (or there are
   * none). Stops reading at the first false and closes the source.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const allPositive = await range({ from: 1, to: 5 }).every((n) => n > 0);
   * // true
   * ```
   */
  async every(
    everyFn: (element: T) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    for await (const element of this.iter) {
      if (!(await everyFn(element))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Resolve to true if `someFn` returns true for any item. Stops reading at
   * the first true and closes the source.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const hasEven = await range({ to: 5 }).some((n) => n % 2 === 0);
   * // true
   * ```
   */
  async some(
    someFn: (element: T) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    for await (const element of this.iter) {
      if (await someFn(element)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolve to the number of items, or, given `filterFn`, the number for
   * which it returns true.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const files = await run("ls").lines.count();
   * ```
   */
  async count(
    filterFn?: (item: T) => boolean | Promise<boolean>,
  ): Promise<number> {
    if (filterFn == null) {
      let count = 0;
      for await (const _item of this.iter) {
        count++;
      }
      return count;
    } else {
      let count = 0;
      for await (const item of this.iter) {
        if (await filterFn(item)) {
          count++;
        }
      }
      return count;
    }
  }

  /**
   * Drop the items for which `filterFn` returns true: the opposite of
   * {@link filter}.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const nonBlank = await run("cat", "notes.txt")
   *   .lines
   *   .filterNot((line) => line.trim() === "")
   *   .collect();
   * ```
   */
  filterNot(
    filterFn: (item: T) => boolean | Promise<boolean>,
  ): Enumerable<T> {
    const iterable = this.iter;
    return new Enumerable(
      {
        async *[Symbol.asyncIterator]() {
          for await (const item of iterable) {
            if (!(await filterFn(item))) {
              yield item;
            }
          }
        },
      },
    ) as Enumerable<T>;
  }

  /**
   * Combine the items into one value, as `Array.prototype.reduce` does, with
   * the first item as the starting value.
   *
   * The first call gets the first two items and index 1.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const largest = await range({ until: 5 }).reduce((a, b) => Math.max(a, b));
   * // 5
   * ```
   *
   * @param reduceFn Gets the value so far, the item, and its index.
   * @throws {TypeError} If the sequence is empty.
   */
  async reduce(
    reduceFn: (acc: T, item: T, index: number) => T | Promise<T>,
  ): Promise<T>;

  /**
   * Combine the items into one value, starting from `zero`, as
   * `Array.prototype.reduce` does.
   *
   * An empty sequence resolves to `zero`. A `zero` of `undefined` counts as
   * no starting value: the first item is used instead.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const sum = await range({ from: 1, until: 5 }).reduce((acc, n) => acc + n, 0);
   * // 15
   * ```
   *
   * @param reduceFn Gets the value so far, the item, and its index (from 0).
   * @param zero The starting value.
   */
  async reduce<U>(
    reduceFn: (acc: U, item: T, index: number) => U | Promise<U>,
    zero: U,
  ): Promise<U>;

  async reduce<U>(
    reduceFn: (acc: U, item: T, index: number) => U | Promise<U>,
    zero?: U,
  ): Promise<U> {
    const UNSET = Symbol("unset-reduce");

    let acc: U | typeof UNSET = zero !== undefined ? zero : UNSET;
    let index = 0;

    const firstOp: (Item: T) => U | Promise<U> = async (item: T) => {
      op = restOp;
      if (zero === undefined) {
        index++;
        return item as unknown as U;
      } else {
        return await op(item);
      }
    };

    const restOp = async (item: T) => {
      return await reduceFn(acc as U, item, index++);
    };

    let op = firstOp;

    for await (const item of this.iter) {
      acc = await op(item);
    }

    if (acc === UNSET) {
      throw new TypeError("empty iterator and zero is not set");
    } else {
      return acc;
    }
  }

  /**
   * Call `forEachFn` on each item, waiting for each call (if it is async)
   * before making the next. Resolves when the sequence ends.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * await run("ls", "-l").lines.forEach((line) => console.log(line));
   * ```
   */
  async forEach(
    forEachFn: (item: T) => unknown,
  ): Promise<void> {
    for await (const item of this.iter) {
      await forEachFn(item);
    }
  }

  /**
   * Read every item into an array.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const files = await run("ls").lines.collect();
   * ```
   */
  async collect(): Promise<T[]> {
    const result = [];
    for await (const item of this.iter) {
      result.push(item);
    }
    return result;
  }

  /**
   * The same as {@link collect}.
   *
   * @example
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const result = await enumerate(new Set([1, 2, 3])).toArray();
   * // [1, 2, 3]
   * ```
   */
  async toArray(): Promise<T[]> {
    return await this.collect();
  }

  /**
   * Run a command with the items as its stdin, and return its output, as
   * `a | b` does in a shell.
   *
   * The process starts at the call, and this Enumerable is read into the
   * command's stdin from then on, as fast as the command takes it, whether or
   * not the output is being consumed yet; upstream callbacks run then too.
   * Items can be `string` (written as a line, with `"\n"` added), `string[]`
   * (each a line), `Uint8Array`, or `Uint8Array[]` (written as they are).
   * For any other items the return type is `never`. stdout is piped; stderr
   * is inherited, or piped to `fnStderr` when that is given.
   *
   * An error in the source (an upstream process that failed, a callback that
   * threw, an item that isn't text or bytes) stops the input and closes the
   * command's stdin. The command's output is still delivered, and then the
   * consumer throws: {@link UpstreamError} with the source's error as `cause`
   * if the command succeeded, or the command's own {@link ExitCodeError} or
   * {@link SignalError}, with the source's error as `cause`, if it failed.
   * A command that exits without reading all its input, like `head -1`, is
   * not an error. A missing command throws `Deno.errors.NotFound` from `run`
   * itself.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const errors = await run("cat", "app.log").run("grep", "ERROR").lines
   *   .collect();
   * ```
   *
   * @example With options
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const listed = await enumerate(["b.txt", "a.txt"])
   *   .run({ cwd: "/tmp" }, "xargs", "ls", "-l")
   *   .lines
   *   .collect();
   * ```
   *
   * @param options `cwd`, `env`, `clearEnv`, `timeoutMs`, `fnStderr`,
   *   `fnError`, `buffer`; see {@link ProcessOptions}.
   * @param cmd The command and its arguments.
   */
  run<S>(
    options: ProcessOptions<S>,
    ...cmd: Cmd
  ): Run<S, T>;

  /**
   * Run a command with the items as its stdin, and return its output. See the
   * overload with options for the details.
   *
   * @param cmd The command and its arguments.
   */
  run(...cmd: Cmd): Run<unknown, T>;

  run<S>(
    ...cmd: unknown[]
  ): Run<S, T> {
    const { options, command, args } = parseArgs(cmd);
    const iter = this.iter;

    let p: Process<S>;
    try {
      p = new Process(
        {
          ...options as ProcessOptions<S>,
          stdout: "piped",
          stdin: "piped",
          stderr: options.fnStderr == null ? "inherit" : "piped",
        },
        command,
        args,
      );
    } catch (e) {
      // The command didn't start (NotFound, say), so nothing will read the
      // source. Close it, or a command upstream waits on its output forever.
      abandon(iter);
      throw e;
    }

    p.writeToStdin(
      this.iter as AsyncIterable<string | string[] | Uint8Array | Uint8Array[]>,
    );

    return new ProcessEnumerable(p) as Run<S, T>;
  }

  /**
   * Split into `n` Enumerables (default 2) that each yield every item. The
   * source is read once.
   *
   * An item stays in memory until every branch has read it, so branches read
   * side by side hold little, and a branch that runs far ahead of another
   * makes the items in between pile up. If the source throws, every branch
   * throws, after the items before the error. The source is closed once every
   * branch has stopped, so read each one, at least to `break`: a branch that
   * is never read keeps the source open and every item in memory.
   *
   * @example
   * ```typescript
   * import { range } from "@j50n/proc";
   *
   * const [a, b] = range({ to: 3 }).tee();
   * const [sum, count] = await Promise.all([
   *   a.reduce((acc, n) => acc + n, 0),
   *   b.count(),
   * ]);
   * // 3, 3
   * ```
   *
   * @param n How many Enumerables to make. Default 2.
   * @throws {RangeError} If `n` isn't a whole number of at least 1.
   */
  tee<N extends number = 2>(n?: N): Tuple<Enumerable<T>, N> {
    return tee(this.iter, n ?? 2).map((it) => enumerate(it)) as Tuple<
      Enumerable<T>,
      N
    >;
  }

  /**
   * Yield the first `n` items (default 1), and close the source.
   *
   * For a process, closing the source stops its output early:
   * `run("yes").lines.take(2)` ends cleanly, and the exit code is not
   * checked.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const header = await run("cat", "data.csv").lines.take(1).collect();
   * ```
   *
   * @param n How many items to keep. Default 1; 0 or less (or NaN) keeps
   *   none, and a fraction is rounded down, as for `Array.slice`.
   */
  take<N extends number = 1>(n?: N): Enumerable<T> {
    const iter = this.iter;

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          let count = 0;
          const goal = Math.trunc(n ?? 1);
          if (!(goal > 0)) {
            abandon(iter);
            return;
          }
          for await (const item of iter) {
            if (count >= goal) break;
            yield item;
            // Stop now, not when the next item arrives: it may never come.
            if (++count >= goal) break;
          }
        },
      },
    ) as Enumerable<T>;
  }

  /**
   * The first item. A getter: `await e.first`, not `e.first()`.
   *
   * It stops reading after that item and closes the source, so a second
   * `.first` on the same Enumerable finds nothing and throws.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const branch = await run("git", "branch", "--show-current").lines.first;
   * ```
   *
   * @throws {RangeError} If the sequence is empty. It never resolves to
   *   `undefined`.
   */
  get first(): Promise<T> {
    return (async () => {
      for await (const item of this.take(1)) {
        return item;
      }
      throw new RangeError(".first: the sequence is empty");
    })();
  }

  /**
   * Skip the first `n` items (default 1), and yield the rest.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const rows = await run("cat", "data.csv").lines.drop(1).collect();
   * ```
   *
   * @param n How many items to skip. Default 1; 0 or less (or NaN) skips
   *   none, and a fraction is rounded down, as for `Array.slice`.
   */
  drop<N extends number = 1>(n?: N): Enumerable<T> {
    const iter = this.iter;

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          let count = 0;
          const goal = Math.trunc(n ?? 1) || 0;
          for await (const item of iter) {
            if (count >= goal) {
              yield item;
            }
            count += 1;
          }
        },
      },
    ) as Enumerable<T>;
  }

  /**
   * Yield this sequence's items, then `other`'s. `other` is not read until
   * this one ends; stopping before then closes it.
   *
   * @example
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const all = await enumerate([1, 2]).concat(enumerate([3, 4])).collect();
   * // [1, 2, 3, 4]
   * ```
   *
   * @param other The sequence to append. Wrap an array with {@link enumerate}.
   */
  concat(other: AsyncIterable<T>): Enumerable<T> {
    const iter = this.iter;

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          let reached = false;
          try {
            yield* iter;
            reached = true;
            yield* other;
          } finally {
            // Stopped before `other` began. Close it, or a command feeding it
            // would never exit.
            if (!reached) abandon(other);
          }
        },
      },
    ) as Enumerable<T>;
  }

  /**
   * Pair items by position: `[mine, other's]`. Stops at the end of the
   * shorter sequence and closes both.
   *
   * @example
   * ```typescript
   * import { enumerate, range } from "@j50n/proc";
   *
   * const pairs = await range({ from: 1, until: 3 })
   *   .zip(enumerate(["A", "B"]))
   *   .collect();
   * // [[1, "A"], [2, "B"]]
   * ```
   *
   * @param other The sequence to pair with.
   */
  zip<U>(other: AsyncIterable<U>): Enumerable<[T, U]> {
    const iterA = identity(this);
    const iterB = identity(other);

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          let pending = false;
          try {
            for (;;) {
              pending = true;
              const nextA = handled(iterA.next());
              const nextB = handled(iterB.next());
              // A side that ends ends the zip, without waiting for the other.
              const ended = (next: Promise<IteratorResult<unknown>>) =>
                next.then((r) => r.done ? ENDED : NEVER, () => NEVER);
              const pair = await Promise.race([
                Promise.all([nextA, nextB]),
                ended(nextA),
                ended(nextB),
              ]);
              if (pair === ENDED) break;
              pending = false;

              const [a, b] = pair;
              if (a.done || b.done) {
                break;
              }

              yield [a.value, b.value];
            }
          } finally {
            // Close both without reading on. After one side fails, the
            // other's pull may still be pending, and its close would wait
            // behind it.
            const closing = Promise.all([iterA.return?.(), iterB.return?.()]);
            if (pending) handled(closing);
            else await closing;
          }
        },
      },
    );
  }

  /**
   * Split a sequence of pairs `[a, b]` into two Enumerables: the `a`s and the
   * `b`s.
   *
   * It uses {@link tee}: every item stays in memory until both have read
   * it, and a source error is thrown from both, after the items before it.
   *
   * @example
   * ```typescript
   * import { enumerate } from "@j50n/proc";
   *
   * const pairs: [number, string][] = [[1, "A"], [2, "B"]];
   * const [numbers, letters] = enumerate(pairs).unzip();
   * console.log(await numbers.collect(), await letters.collect());
   * // [1, 2] ["A", "B"]
   * ```
   */
  unzip<A, B>(): Unzip<T> {
    const [a, b] = (this as Enumerable<[A, B]>).tee();

    return [
      enumerate(a.map((it) => it[0])),
      enumerate(b.map((it) => it[1])),
    ] as Unzip<T>;
  }

  /**
   * Decode bytes as UTF-8 into lines of text. A getter: `.lines`, not
   * `.lines()`.
   *
   * Lines end at `"\n"`, and a `"\r"` before it is removed too, so CRLF text
   * works. The line endings are not included, and a final newline doesn't
   * make an empty last line. Invalid UTF-8 throws a `TypeError`. Only an
   * Enumerable of bytes has lines; on anything else the type is `never`.
   *
   * For output with a great many short lines, {@link chunkedLines} is several
   * times faster.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const files = await run("ls", "-1").lines.collect();
   * ```
   */
  get lines(): Lines<T> {
    return enumerate(toLines(this.iter as Enumerable<Uint8Array>)) as Lines<T>;
  }

  /**
   * The same lines as {@link lines}, in arrays: one array per chunk of bytes
   * read. A getter.
   *
   * Handling an array at a time saves an `await` per line in every step, and
   * `.run()` writes each array to the command in one go, so for millions of
   * short lines it is many times faster: a filter between two commands over
   * 2M lines took 16 s with {@link lines} and 0.3 s with this.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * let count = 0;
   * await run("cat", "big.log").chunkedLines.forEach((lines) => {
   *   count += lines.length;
   * });
   * ```
   */
  get chunkedLines(): ChunkedLines<T> {
    return enumerate(
      toChunkedLines(this as Enumerable<Uint8Array>),
    ) as ChunkedLines<T>;
  }

  /**
   * Write the items to stdout, and resolve when they are written. Stdout
   * stays open.
   *
   * A `string` is written with `"\n"` added, a `string[]` as one line per
   * string, and `Uint8Array` or `Uint8Array[]` as the bytes are, with
   * nothing added. Any other item throws a `TypeError`; the types don't
   * catch it.
   *
   * If the reader closes stdout early, as `head` does, it has what it wanted:
   * writing stops, the source is closed, and the promise resolves, as when a
   * consumer stops early.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * await run("ls", "-l").toStdout();
   * await run("ls").lines.map((name) => `- ${name}`).toStdout();
   * ```
   */
  async toStdout(): Promise<void> {
    const iter = toBytes(
      this.iter as AsyncIterable<string | string[] | Uint8Array | Uint8Array[]>,
    );
    let readerGone = false;
    await writeEach(
      iter,
      (buff) =>
        writeAll(buff, Deno.stdout).catch((e) => {
          if (!(e instanceof Deno.errors.BrokenPipe)) throw e;
          readerGone = true;
        }),
      () => readerGone,
    );
  }

  /**
   * Write the bytes to a `Writer & Closer`, such as a `Deno.FsFile`, then
   * close it.
   *
   * The writer is closed even when the source throws, and the error is then
   * thrown here. Only an Enumerable of bytes has this; on anything else the
   * return type is `never`. For a path or a `WritableStream`, use
   * {@link writeTo}.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const file = await Deno.create("listing.txt");
   * await run("ls", "-l").writeBytesTo(file);
   * ```
   *
   * @param writer Where the bytes go. It is closed afterward.
   */
  writeBytesTo(writer: Writer & Closer): ByteSink<T> {
    const iter = this.iter as AsyncIterable<Uint8Array>;
    async function inner() {
      try {
        await writeEach(iter, (buff) => writeAll(buff, writer));
      } catch (e) {
        // After a failure, the first error is the one to report.
        try {
          writer.close();
        } catch {
          // Lost behind the first.
        }
        throw e;
      }
      writer.close();
    }

    return inner() as ByteSink<T>;
  }
}

/**
 * A running process's output: an {@link Enumerable} of its stdout bytes,
 * with its `pid` and `status`. {@link run} and {@link Enumerable.run} return
 * one.
 *
 * Use `.lines` for text, or iterate the bytes. The process is already running
 * and its output must be read: a child that writes more than the pipe holds
 * (about 64 KB) blocks until it is read, and if nothing reads it, the program
 * hangs. The output can be read once.
 *
 * A non-zero exit throws {@link ExitCodeError} from the consumer once every
 * line of output has been delivered; death by a signal throws
 * {@link SignalError}. Stopping early (`take`, `first`, `break`) closes
 * stdout, and the exit code is not checked.
 *
 * @example
 * ```typescript
 * import { ExitCodeError, run } from "@j50n/proc";
 *
 * try {
 *   await run("git", "status", "--short").lines.forEach(console.log);
 * } catch (error) {
 *   if (error instanceof ExitCodeError) {
 *     console.error(`git exited with code ${error.code}`);
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 *
 * @typeParam S The type `fnStderr` returns and `fnError` receives; see
 *   {@link ProcessOptions}.
 */
export class ProcessEnumerable<S> extends Enumerable<Uint8Array<ArrayBuffer>> {
  /**
   * Wrap a {@link Process} whose stdout is piped. {@link run} does this for
   * you.
   *
   * @param process The process.
   * @throws {Deno.errors.NotConnected} If its stdout is not piped.
   */
  constructor(protected process: Process<S>) {
    super(process.stdout);
  }

  /** The process ID. */
  get pid(): number {
    return this.process.pid;
  }

  /**
   * The exit status, once the process exits. A getter: `await p.status`, not
   * `p.status()`.
   *
   * It doesn't throw for a non-zero exit; it reports `success`, `code`, and
   * `signal`. It resolves only when the process exits, so for a child with
   * more output than the pipe holds, read the output first or alongside, or
   * it never resolves. Reading through a consumer already throws on failure,
   * so `status` is for when you don't want the output, or have set `fnError`
   * to handle failures. Output nobody has started reading when the child
   * exits is kept in memory, and can still be read.
   *
   * @example
   * ```typescript
   * import { run } from "@j50n/proc";
   *
   * const { success } = await run("test", "-d", "/tmp").status;
   * ```
   */
  get status(): Promise<Deno.CommandStatus> {
    return this.process.status;
  }
}
