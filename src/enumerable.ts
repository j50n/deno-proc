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
   * Write all data to the writer.
   *
   * Note that this call returns immediately, although it continues to run
   * until the source iterable data is exhausted.
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
      return new Enumerable(transformerFromTransformStream(fn)(this.iter));
    } else {
      return new Enumerable(fn(this.iter));
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
  ): ProcessEnumerable<S>;

  /**
   * Run a process.
   * @param cmd The command.
   * @returns A child process instance.
   */
  run(...cmd: Cmd): ProcessEnumerable<unknown>;

  run<S>(
    ...cmd: unknown[]
  ): ProcessEnumerable<S> {
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

    return new ProcessEnumerable(p);
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
   * Drop the first `n` items, return the rest.
   * @param n The number of items to drop.
   * @returns The items that were not dropped.
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
}

/**
 * Enumerable which may be substituted when we know we are returning `Uint8Array` data.
 */
export class ProcessEnumerable<S> extends Enumerable<Uint8Array> {
  constructor(protected process: Process<S>) {
    super(process.stdout);
  }

  /**
   * Convert the output to text lines.
   *
   * Note that this should probably only be used with small data. Consider {@link chunkedLines}
   * to improve performance with larger data.
   */
  get lines(): Enumerable<string> {
    return enumerate(toLines(this.process.stdout));
  }

  /** Process PID. */
  get pid() {
    return this.process.pid;
  }

  /** Process status. */
  get status() {
    return this.process.status;
  }
}
