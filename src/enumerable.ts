import { Process, type ProcessOptions } from "./process.ts";
import { parseArgs } from "./helpers.ts";
import type { Cmd } from "./run.ts";
import type { Writable } from "./writable-iterable.ts";
import {
  toChunkedLines,
  toLines,
  transformerFromTransformStream,
  type TransformerFunction,
} from "./transformers.ts";
import { writeAll } from "./utility.ts";
import { concurrentMap, concurrentUnorderedMap } from "./concurrent.ts";
import type { Closer, Writer } from "@std/io/types";
import { tee } from "@std/async/tee";

type ElementType<T> = T extends Iterable<infer E> | AsyncIterable<infer E> ? E
  : never;

type Tuple<T, N extends number> = N extends N
  ? number extends N ? T[] : TupleOf<T, N, []>
  : never;
type TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : TupleOf<T, N, [T, ...R]>;

type TransformStream<R, S> = ReadableWritablePair<S, R>;

function isReadableWritablePair(item: unknown): item is ReadableWritablePair {
  return (item != null && typeof item === "object" && "writable" in item &&
    "readable" in item);
}
/** Conditional type for {@link Enumerable.unzip}. */
export type Unzip<T> = T extends [infer A, infer B]
  ? [Enumerable<A>, Enumerable<B>]
  : never;

/** Conditional type for {@link Enumerable.lines}. */
export type Lines<T> = T extends Uint8Array ? Enumerable<string> : never;

/** Conditional type for {@link Enumerable.chunkedLines}. */
export type ChunkedLines<T> = T extends Uint8Array ? Enumerable<string[]>
  : never;

export type ByteSink<T> = T extends Uint8Array ? Promise<void> : never;

/** Conditional type for {@link Enumerable.run}. */
export type Run<S, T> = T extends Uint8Array | Uint8Array[] | string | string[]
  ? ProcessEnumerable<S>
  : never;

/**
 * Create an Enumerable from any iterable or async iterable.
 *
 * This is the factory function for creating Enumerable instances. It provides
 * a fluent API for working with async data streams, making it easy to chain
 * operations like map, filter, and transform.
 *
 * **Why use Enumerable?**
 * - Composable operations via method chaining
 * - Works seamlessly with async data
 * - Integrates with process I/O
 * - Lazy evaluation for memory efficiency
 * - Type-safe transformations
 *
 * @example Convert array to AsyncIterable
 * ```typescript
 * import { enumerate } from "jsr:@j50n/proc";
 *
 * const result = await enumerate([1, 2, 3]).collect();
 * // [1, 2, 3]
 * ```
 *
 * @example Use with for await
 * ```typescript
 * import { enumerate } from "jsr:@j50n/proc";
 *
 * for await (const n of enumerate([1, 2, 3])) {
 *   console.log(n);
 * }
 * ```
 *
 * @param iter An Iterable, AsyncIterable, or null/undefined (treated as empty).
 * @returns An Enumerable wrapping the input.
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
 * Fluent wrapper for AsyncIterable with composable operations.
 *
 * Enumerable provides a rich set of operations for working with async data streams:
 * - Transformations: map, filter, flatMap
 * - Aggregations: reduce, count, collect
 * - Utilities: take, drop, concat, zip
 * - Process integration: run, lines, toStdout
 * - Concurrency: concurrentMap, concurrentUnorderedMap
 *
 * **Create instances using {@link enumerate}, not the constructor directly.**
 *
 * @typedef T The type of elements in the sequence.
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
        let p: undefined | Promise<void>;

        for await (const it of iter) {
          await p;
          p = w.write(it);
        }

        await p;
      } finally {
        w.releaseLock();
        if (!options?.noclose) {
          await writer.close();
        }
      }
    } else {
      try {
        let p: undefined | Promise<void>;

        for await (const it of iter) {
          await p;

          if (writer.isClosed) {
            break;
          }

          p = writer.write(it);
        }

        await p;

        if (!options?.noclose) {
          await writer.close();
        }
      } catch (e) {
        if (!options?.noclose) {
          await writer.close(e as Error | undefined);
        }
      }
    }
  }

  /**
   * Transform the iterable from one type to another with an opportunity to catch
   * and handle errors.
   * @param fn The transformer function or `TransformStream`.
   * @returns The transformed iterable.
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
   * Map the iterator from one type to another.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values.
   */
  map<U>(mapFn: (item: T) => U | Promise<U>): Enumerable<U> {
    const iter = this.iter;
    return new Enumerable({
      async *[Symbol.asyncIterator]() {
        let p: undefined | Promise<U> | U;
        let first = true;

        for await (const it of iter) {
          if (first) {
            first = false;
          } else {
            yield await p;
          }
          p = mapFn(it);
        }
        if (!first) {
          yield await p;
        }
      },
    }) as Enumerable<U>;
  }

  /**
   * Flatten the iterable.
   * @returns An iterator where a level of indirection has been "flattened" out.
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
   * Map each item to an iterable and flatten the results.
   *
   * Equivalent to calling map() followed by flatten().
   *
   * @example Duplicate and scale each number
   * ```typescript
   * import { enumerate } from "jsr:@j50n/proc";
   *
   * const result = await enumerate([1, 2, 3])
   *   .flatMap(n => [n, n * 10])
   *   .collect();
   * // [1, 10, 2, 20, 3, 30]
   * ```
   *
   * @param mapFn The mapping function.
   * @returns An Enumerable of flattened mapped values.
   */
  flatMap<U>(mapFn: (item: T) => U | Promise<U>): Enumerable<ElementType<U>> {
    return this.map(mapFn).flatten();
  }

  /**
   * Map the sequence from one type to another, concurrently.
   *
   * Results are returned in order. The order of processing
   * is concurrent, and therefore somewhat arbitrary.
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
   * This guarantees maximum concurrency whereas {@link concurrentMap} does
   * not if the workload isn't balanced. Prefer {@link concurrentUnorderedMap}
   * to {@link concurrentMap} for best/consistent performance.
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
   * Keep only items that pass a test.
   *
   * @example Filter even numbers
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const evens = await range({ to: 5 })
   *   .filter(n => n % 2 === 0)
   *   .collect();
   * // [0, 2, 4]
   * ```
   *
   * @param filterFn The test function.
   * @returns An Enumerable of items that passed the test.
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
   * Find the first item that matches a condition.
   *
   * @example Find first item greater than 5
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const result = await range({ to: 10 })
   *   .find(n => n > 5);
   * // 6
   * ```
   *
   * @param findFn The test function.
   * @returns The first matching item, or undefined if none found.
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
   * Test if every item satisfies a condition.
   *
   * @example Check if all numbers are positive
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const allPositive = await range({ from: 1, to: 5 })
   *   .every(n => n > 0);
   * // true
   * ```
   *
   * @param everyFn The test function.
   * @returns True if all items pass the test.
   */
  async every(
    everyFn: (element: T) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    for await (const element of this.iter) {
      if (!everyFn(element)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Test if any item satisfies a condition.
   *
   * @example Check if any number is even
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const hasEven = await range({ to: 5 })
   *   .some(n => n % 2 === 0);
   * // true
   * ```
   *
   * @param someFn The test function.
   * @returns True if at least one item passes the test.
   */
  async some(
    someFn: (element: T) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    for await (const element of this.iter) {
      if (someFn(element)) {
        return true;
      }
    }
    return false;
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
      let count = 0;
      for await (const _item of this.iter) {
        count++;
      }
      return count;
    } else {
      let count = 0;
      for await (const item of this.iter) {
        if (filterFn(item)) {
          count++;
        }
      }
      return count;
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
   * Reduce the sequence to a single value.
   *
   * Executes a reducer function on each element, passing the accumulated result
   * from one element to the next.
   *
   * @example Sum numbers
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const sum = await range({ from: 1, until: 5 })
   *   .reduce((acc, n) => acc + n, 0);
   * // 15
   * ```
   *
   * @param reduceFn The reducer function.
   * @returns The final accumulated value.
   * @throws TypeError if the iteration is empty and no initial value provided.
   */
  async reduce(
    reduceFn: (acc: T, item: T, index: number) => T | Promise<T>,
  ): Promise<T>;

  /**
   * Reduce the sequence to a single value with an initial value.
   *
   * @param reduceFn The reducer function.
   * @param zero The initial accumulator value.
   * @returns The final accumulated value.
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
   * Perform an operation for each item in the sequence.
   * @param forEachFn The forEach function.
   */
  async forEach(
    forEachFn: (item: T) => void | Promise<void>,
  ): Promise<void> {
    let p: undefined | Promise<void> | void;

    for await (const item of this.iter) {
      await p;
      p = forEachFn(item);
    }
  }

  /**
   * Collect the items in this iterator to an array.
   * @returns The items of this iterator collected to an array.
   */
  async collect(): Promise<T[]> {
    const result = [];
    for await (const item of this.iter) {
      result.push(item);
    }
    return result;
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
   * Split the sequence into multiple identical streams.
   *
   * Useful when you need to process the same data in different ways.
   * Uses buffering internally, so be mindful of memory with large datasets.
   *
   * @example Split into two streams
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const [a, b] = range({ to: 3 }).tee();
   *
   * const resultA = await a.collect();  // [0, 1, 2]
   * const resultB = await b.collect();  // [0, 1, 2]
   * ```
   *
   * @param n The number of identical streams to create (default: 2).
   * @returns A tuple of n identical Enumerables.
   */
  tee<N extends number = 2>(n?: N): Tuple<Enumerable<T>, N> {
    return tee(this.iter, n).map((it: AsyncIterable<T>) =>
      enumerate(it)
    ) as Tuple<
      Enumerable<T>,
      N
    >;
  }

  /**
   * Take the first n items from the sequence.
   *
   * @example Get first 3 items
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const first3 = await range({ to: 10 })
   *   .take(3)
   *   .collect();
   * // [0, 1, 2]
   * ```
   *
   * @param n The number of items to take (default: 1).
   * @returns An Enumerable of the first n items.
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
   * Get the first item in the sequence.
   *
   * Consumes the enumeration and returns the first element.
   *
   * @example Get first item
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const first = await range({ from: 5, to: 10 }).first;
   * // 5
   * ```
   *
   * @throws RangeError if the sequence is empty.
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
   * Skip the first n items and return the rest.
   *
   * @example Skip first 2 items
   * ```typescript
   * import { range } from "jsr:@j50n/proc";
   *
   * const rest = await range({ to: 5 })
   *   .drop(2)
   *   .collect();
   * // [2, 3, 4]
   * ```
   *
   * @param n The number of items to skip (default: 1).
   * @returns An Enumerable of remaining items.
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
   * Concatenate this sequence with another.
   *
   * @example Join two sequences
   * ```typescript
   * import { enumerate } from "jsr:@j50n/proc";
   *
   * const result = await enumerate([1, 2])
   *   .concat(enumerate([3, 4]))
   *   .collect();
   * // [1, 2, 3, 4]
   * ```
   *
   * @param other The sequence to append.
   * @returns An Enumerable of concatenated items.
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
   * Convert to text lines.
   *
   * Note that this should probably only be used with small data. Consider {@link chunkedLines}
   * to improve performance with larger data.
   */
  get lines(): Lines<T> {
    return enumerate(toLines(this.iter as Enumerable<Uint8Array>)) as Lines<T>;
  }

  /**
   * Convert to text lines, grouped into arrays.
   *
   * For large data or data that is broken into many small lines, this can improve performance
   * over {@link lines}.
   */
  get chunkedLines(): ChunkedLines<T> {
    return enumerate(
      toChunkedLines(this as Enumerable<Uint8Array>),
    ) as ChunkedLines<T>;
  }

  /**
   * Dump output to `stdout`. Non-locking.
   */
  toStdout(): ByteSink<T> {
    const iter = this.iter as AsyncIterable<Uint8Array>;
    async function inner() {
      let p: undefined | Promise<void>;

      for await (const buff of iter) {
        await p;
        p = writeAll(buff, Deno.stdout);
      }
      await p;
    }
    return inner() as ByteSink<T>;
  }

  /**
   * Dump output to a writer and close it.
   *
   * This is a low-level asynchronous write of bytes without locking.
   *
   * @param writer The target writer.
   */
  writeBytesTo(writer: Writer & Closer): ByteSink<T> {
    const iter = this.iter as AsyncIterable<Uint8Array>;
    async function inner() {
      try {
        let p: undefined | Promise<void>;

        for await (const buff of iter) {
          await p;
          p = writeAll(buff, writer);
        }
        await p;
      } finally {
        writer.close();
      }
    }

    return inner() as ByteSink<T>;
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
  get pid(): number {
    return this.process.pid;
  }

  /** Process status. */
  get status(): Promise<Deno.CommandStatus> {
    return this.process.status;
  }
}
