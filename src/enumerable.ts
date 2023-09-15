import { Process, ProcessOptions } from "./process.ts";
import {
  collect,
  concurrentMap,
  concurrentUnorderedMap,
  filter,
  flatten,
  forEach,
  map,
  reduce,
} from "./deps/asynciter.ts";
import { tee } from "./deps/tee.ts";
import { parseArgs } from "./helpers.ts";
import { Cmd } from "./run.ts";
import { Writable } from "./writable-iterable.ts";
import {
  toLines,
  transformerFromTransformStream,
  TransformerFunction,
} from "./transformers.ts";

type ElementType<T> = T extends Iterable<infer E> | AsyncIterable<infer E> ? E
  : never;

type Tuple<T, N extends number> = N extends N
  ? number extends N ? T[] : TupleOf<T, N, []>
  : never;
type TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : TupleOf<T, N, [T, ...R]>;

type TransformStream<R, S> = {
  writable: WritableStream<R>;
  readable: ReadableStream<S>;
};

/** Conditional type for {@link Enumerable.unzip}. */
export type Unzip<T> = T extends [infer A, infer B]
  ? [Enumerable<A>, Enumerable<B>]
  : never;

/** Conditional type for {@link Enumerable.lines}. */
export type Lines<T> = T extends Uint8Array ? Enumerable<string> : never;

/** Conditional type for {@link Enumerable.run}. */
export type Run<S, T> = T extends Uint8Array | Uint8Array[] | string | string[]
  ? ProcessEnumerable<S>
  : never;

/**
 * {@link Enumerable} factory.
 *
 * Use this instead of creating an {@link Enumerable} directly as it more flexible
 * and prevents stacking (a potential performance issue).
 *
 * **Examples**
 *
 * Convert an array into `AsyncIterable`.
 *
 * ```typescript
 * for await (const n of enumerate([1, 2, 3])) {
 *   console.log(n);
 * }
 * ```
 *
 * Use `enumerate` to read a file line by line.
 *
 * ```typescript
 * const file = await Deno.open(resolve("./warandpeace.txt.gz"));
 *
 * for await (const line of enumerate(file.readable).run("gunzip").lines) {
 *   console.log(line);
 * }
 * ```
 *
 * @param iter An `Iterable` or `AsynIterable`; `null` or `undefined` assume empty.
 * @returns An {@link Enumerable}.
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
 * Options for {@link Enumerable.concurrentMap} and {@link Enumerable.concurrentUnorderedMap}.
 */
export interface ConcurrentOptions {
  /** Maximum concurrency. */
  concurrency?: number;
}

async function* identity<T>(iter: AsyncIterable<T>): AsyncIterableIterator<T> {
  yield* iter;
}

/**
 * Enumerable wrapper for `AsyncIterable`.
 *
 * Use the factory function {@link enumerate} to create new instances.
 *
 * @typedef T The type of contained data.
 */
export class Enumerable<T> implements AsyncIterable<T> {
  /**
   * Construct a new enumerable wrapper.
   * @param iter The iterator being wrapped.
   */
  constructor(protected iter: AsyncIterable<T>) {
  }

  /**
   * Implement `AsyncIterable<T>`.
   */
  [Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    if ("next" in this.iter) {
      return this.iter as AsyncGenerator<T, void, unknown>;
    } else {
      return identity(this.iter) as AsyncGenerator<T, void, unknown>;
    }
  }

  /**
   * Adds a counter from 0 to `n`-1 of the items being enumerated.
   */
  enum(): Enumerable<[T, number]> {
    let count = 0;
    return this.map((item) => [item, count++]);
  }

  /**
   * Write all data to the writer.
   *
   * **Example**
   *
   * Write some numbers to `stdout`.
   *
   * ```typescript
   * range({to: 99})
   *   .map(n => n.toString())
   *   .transform(toBytes)
   *   .writeTo(Deno.stdout.writable, {noclose: true});
   * ```
   *
   * @param writer The writer.
   */
  async writeTo(
    writer: Writable<T> | WritableStream<T>,
    options?: { noclose?: boolean },
  ): Promise<void> {
    const iter = this.iter;

    if ("getWriter" in writer) {
      const w = writer.getWriter();

      try {
        for await (const it of iter) {
          await w.write(it);
        }
      } finally {
        w.releaseLock();
        if (!options?.noclose) {
          await writer.close();
        }
      }
    } else {
      await (async () => {
        try {
          for await (const it of iter) {
            if (writer.isClosed) {
              break;
            }

            writer.write(it);
          }
          if (!options?.noclose) {
            await writer.close();
          }
        } catch (e) {
          if (!options?.noclose) {
            await writer.close(e);
          }
        }
      })();
    }
  }

  /**
   * Transform the iterable from one type to another with an opportunity to catch
   * and handle errors.
   * @param fn The transformer function or `TransformStream`.
   * @returns The transformed iterable.
   */
  transform<U>(
    fn: TransformerFunction<T, U> | TransformStream<T, U>,
  ): Enumerable<U> {
    if ("writable" in fn && "readable" in fn) {
      return new Enumerable(
        transformerFromTransformStream(fn)(enumerate(this.iter)),
      );
    } else {
      return new Enumerable(fn(enumerate(this.iter)));
    }
  }

  /**
   * Map the iterator from one type to another.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values.
   */
  map<U>(mapFn: (item: T) => U | Promise<U>): Enumerable<U> {
    const iter = this.iter;
    return new Enumerable({
      async *[Symbol.asyncIterator]() {
        yield* map(iter, mapFn);
      },
    }) as Enumerable<U>;
  }

  /**
   * Flatten the iterable.
   * @returns An iterator where a level of indirection has been "flattened" out.
   */
  flatten(): Enumerable<ElementType<T>> {
    const iter = this.iter;
    return new Enumerable(
      flatten(
        iter as AsyncIterable<
          AsyncIterable<ElementType<T>> | Iterable<ElementType<T>>
        >,
      ),
    );
  }

  /**
   * Equivalent to calling {@link map} followed by {@link flatten}.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values where one level of indirection has been "flattened" out.
   */
  flatMap<U>(mapFn: (item: T) => U | Promise<U>): Enumerable<ElementType<U>> {
    return this.map(mapFn).flatten();
  }

  /**
   * Map the sequence from one type to another, concurrently.
   *
   * Results are returned in order.
   *
   * @param mapFn The mapping function.
   * @param options {@link ConcurrentOptions}
   * @returns An iterable of mapped values.
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
   * Map the sequence from one type to another, concurrently.
   *
   * Items are iterated out of order. This allows maximum concurrency
   * at all times, but the output order cannot be assumed to be the
   * same as the input order.
   *
   * @param mapFn The mapping function.
   * @param options {@link ConcurrentOptions}
   * @returns An iterable of mapped values.
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
   * Filter the sequence to contain just the items that pass a test.
   *
   * @param filterFn The filter function.
   * @returns An iterator returning the values that passed the filter function.
   */
  filter(
    filterFn: (item: T) => boolean | Promise<boolean>,
  ): Enumerable<T> {
    const iterable = this.iter;
    return new Enumerable(filter(iterable, filterFn)) as Enumerable<T>;
  }

  /**
   * Return the first element that satisfies the provided testing function, or `undefined`
   * if no value satisfies the testing function.
   * @param findFn The testing function.
   * @returns The first item that satisfies the testing function, or `undefined`.
   */
  async find(
    findFn: (element: T) => boolean | Promise<boolean>,
  ): Promise<T | undefined> {
    for await (const element of this.iter) {
      if (findFn(element)) {
        return element;
      }
    }
    return undefined;
  }

  /**
   * Return `true` if every element satisfies the provided testing function.
   * @param allFn The testing function.
   * @returns `true` if every element satisfies the provided testing function.
   */
  async all(
    allFn: (element: T) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    for await (const element of this.iter) {
      if (!allFn(element)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Count the number of items; optionally with a filter.
   * @param filterFn Includes items where filter returns `true`.
   * @returns A count of the items.
   */
  async count(
    filterFn?: (item: T) => boolean | Promise<boolean>,
  ): Promise<number> {
    if (filterFn == null) {
      return await enumerate(this.iter).reduce(0, (acc, _item) => acc + 1);
    } else {
      return await enumerate(this.iter).filter(filterFn).reduce(
        0,
        (acc, _item) => acc + 1,
      );
    }
  }
  /**
   * Filter the sequence to exclude the items that pass a test. This returns the
   * inverse of {@link filter}.
   *
   * @param filterFn The filter function.
   * @returns An iterator excluding the values that passed the filter function.
   */
  filterNot(
    filterFn: (item: T) => boolean | Promise<boolean>,
  ): Enumerable<T> {
    const iterable = this.iter;
    return new Enumerable(
      filter(iterable, async (item: T) => !(await filterFn(item))),
    ) as Enumerable<T>;
  }

  /**
   * Reduce a sequence to a single value.
   * @param reduce The reducing function.
   * @returns The result of applying the reducing function to each item and accumulating the result.
   */
  async reduce<U>(
    zero: U,
    reduceFn: (acc: U, item: T) => U | Promise<U>,
  ): Promise<U> {
    return await reduce(this.iter, zero, reduceFn);
  }

  /**
   * Perform an operation for each item in the sequence.
   * @param forEachFn The forEach function.
   */
  async forEach(
    forEachFn: (item: T) => void | Promise<void>,
  ): Promise<void> {
    await forEach(this.iter, forEachFn);
  }

  /**
   * Collect the items in this iterator to an array.
   * @returns The items of this iterator collected to an array.
   */
  async collect(): Promise<T[]> {
    return await collect(this.iter);
  }

  /**
   * Run a process.
   *
   * @param cmd The command.
   * @param options Options.
   * @returns A child process instance.
   */
  run<S>(
    options: ProcessOptions<S>,
    ...cmd: Cmd
  ): Run<S, T>;

  /**
   * Run a process.
   * @param cmd The command.
   * @returns A child process instance.
   */
  run(...cmd: Cmd): Run<unknown, T>;

  run<S>(
    ...cmd: unknown[]
  ): Run<S, T> {
    const { options, command, args } = parseArgs(cmd);

    const p = new Process(
      {
        ...options as ProcessOptions<S>,
        stdout: "piped",
        stdin: "piped",
        stderr: options.fnStderr == null ? "inherit" : "piped",
      },
      command,
      args,
    );

    p.writeToStdin(
      this.iter as AsyncIterable<string | string[] | Uint8Array | Uint8Array[]>,
    );

    return new ProcessEnumerable(p) as Run<S, T>;
  }

  /**
   * Split into 2 or more identical iterators.
   * @param n The number of clones to create.
   * @returns 2 or more identical clones.
   */
  tee<N extends number = 2>(n?: N): Tuple<Enumerable<T>, N> {
    return tee(this.iter, n).map((it) => enumerate(it)) as Tuple<
      Enumerable<T>,
      N
    >;
  }

  /**
   * Take the first `n` items.
   * @param n The number of items to take.
   * @returns The first `n` items.
   */
  take<N extends number = 1>(n?: N): Enumerable<T> {
    const iter = this.iter;

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          let count = 0;
          const goal = n ?? 1;
          for await (const item of iter) {
            if (count < goal) {
              yield item;
            } else {
              break;
            }
            count += 1;
          }
        },
      },
    ) as Enumerable<T>;
  }

  /**
   * Take the head of the enumeration.
   *
   * This operation is equivalent to `take(1)` and consumes the enumeration.
   */
  get first(): Promise<T> {
    return (async () => {
      for await (const item of this.take(1)) {
        return item;
      }
      throw new RangeError("enumeration missing head");
    })();
  }

  /**
   * Drop the first `n` items, return the rest.
   * @param n The number of items to drop.
   * @returns The items that were not dropped.
   */
  drop<N extends number = 1>(n?: N): Enumerable<T> {
    const iter = this.iter;

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          let count = 0;
          const goal = n ?? 1;
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
   * Concatenate the iterables together.
   * @param other The other iterable.
   * @returns The iterables concatenated.
   */
  concat(other: AsyncIterable<T>): Enumerable<T> {
    const iter = this.iter;

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          yield* iter;
          yield* other;
        },
      },
    ) as Enumerable<T>;
  }

  /**
   * Zip two {@link Enumerable}s together. If collections are unequal length,
   * the longer collection is truncated.
   *
   * **Example**
   *
   * ```typescript
   * const a = range({ from: 1, until: 3 });
   * const b = enumerate(["A", "B", "C"]);
   *
   * const result = a.zip(b);
   *
   * // [[1, "A"], [2, "B"], [3, "C"]]
   * ```
   *
   * @param other The other iterable.
   * @returns The result of zipping
   */
  zip<U>(other: AsyncIterable<U>): Enumerable<[T, U]> {
    const iterA = identity(this);
    const iterB = identity(other);

    return enumerate(
      {
        async *[Symbol.asyncIterator]() {
          try {
            for (;;) {
              const [a, b] = await Promise.all([
                iterA.next(),
                iterB.next(),
              ]);

              if (a.done || b.done) {
                break;
              }

              yield [a.value, b.value];
            }
          } finally {
            await Promise.all([
              async () => {
                for await (const _a of iterA) {
                  break;
                }
              },
              async () => {
                for await (const _b of iterB) {
                  break;
                }
              },
            ]);
          }
        },
      },
    );
  }

  /**
   * Unzip a collection of `[A, B]` into `Enumerable<A>` and `Enumerable<B>`.
   *
   * Note that this operations uses {@link tee}, so it will use memory during the
   * iteration.
   *
   * **Example**
   *
   * ```typescript
   * const [a, b] = enumerate([[1, "A"], [2, "B"], [3, "C"]]).unzip();
   *
   * // a is number[] -> [1, 2, 3]
   * // b is string[] -> ["A", "B", "C"]
   * ```
   *
   * @returns Two enumerables, one for the left side of the tuple and the other for the right.
   */
  unzip<A, B>(): Unzip<T> {
    const [a, b] = (this as Enumerable<[A, B]>).tee();

    return [
      enumerate(a.map((it) => it[0])),
      enumerate(b.map((it) => it[1])),
    ] as Unzip<T>;
  }

  /**
   * Convert the output to text lines.
   *
   * Note that this should probably only be used with small data. Consider {@link chunkedLines}
   * to improve performance with larger data.
   */
  get lines(): Lines<T> {
    return enumerate(toLines(this as Enumerable<Uint8Array>)) as Lines<T>;
  }
}

/**
 * Enumerable which may be substituted when we know we are returning `Uint8Array` data.
 */
export class ProcessEnumerable<S> extends Enumerable<Uint8Array> {
  constructor(protected process: Process<S>) {
    super(process.stdout);
  }

  /** Process PID. */
  get pid() {
    return this.process.pid;
  }

  /** Process status. */
  get status() {
    return this.process.status;
  }

  /**
   * Dump output to `stdout`. Shorthand for `p.writeTo(Deon.stdout.writable, {noclose: true});`.
   */
  async toStdout() {
    await this.writeTo(Deno.stdout.writable, {
      noclose: true,
    });
  }
}
