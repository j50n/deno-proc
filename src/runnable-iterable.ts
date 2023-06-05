import { Command, ProcessOptions } from "./command.ts";
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
import { WritableIterable } from "./writable-iterable.ts";

type ElementType<T> = T extends Iterable<infer E> | AsyncIterable<infer E> ? E
  : never;

type Tuple<T, N extends number> = N extends N
  ? number extends N ? T[] : TupleOf<T, N, []>
  : never;
type TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : TupleOf<T, N, [T, ...R]>;

/**
 * Create a new runnable.
 * @param iter The wrapped iterator.
 * @returns A new runnable.
 */
export function runnable<T>(iter: AsyncIterable<T>): Runnable<T> {
  return new Runnable(iter);
}

export class Runnable<T> implements AsyncIterable<T> {
  constructor(protected iter: AsyncIterable<T>) {
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    for await (const item of this.iter) {
      yield item;
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
  writeTo(writer: WritableIterable<T>) {
    const iter = this.iter;
    (async () => {
      try {
        for await (const it of iter) {
          if (writer.closed) {
            break;
          }

          writer.write(it);
        }
        await writer.close();
      } catch (e) {
        await writer.close(e);
      }
    })();
  }

  /**
   * Transform the iterable from one type to another with an opportunity to catch
   * and handle errors.
   * @param fn The transform function.
   * @returns The transformed iterable.
   */
  transform<U>(
    fn: (it: AsyncIterable<T>) => AsyncIterable<U>,
  ): Runnable<U> {
    return new Runnable(fn(this.iter));
  }

  /**
   * Map the iterator from one type to another.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values.
   */
  map<U>(mapFn: (item: T) => U | Promise<U>): Runnable<U> {
    const iter = this.iter;
    return new Runnable({
      async *[Symbol.asyncIterator]() {
        yield* map(iter, mapFn);
      },
    }) as Runnable<U>;
  }

  /**
   * Flatten the iterable.
   * @returns An iterator where a level of indirection has been removed.
   */
  public flatten(): Runnable<ElementType<T>> {
    const iterable = this.iter;
    return new Runnable(
      flatten(
        iterable as AsyncIterable<
          AsyncIterable<ElementType<T>> | Iterable<ElementType<T>>
        >,
      ),
    );
  }

  /**
   * Map the sequence from one type to another, concurrently.
   *
   * Results are returned in order.
   *
   * @param mapFn The mapping function.
   * @param concurrency The maximum concurrency.
   * @returns An iterable of mapped values.
   */
  concurrentMap<U>(
    mapFn: (item: T) => Promise<U>,
    concurrency?: number,
  ): Runnable<U> {
    const iterable = this.iter;
    return new Runnable(
      concurrentMap(iterable, mapFn, concurrency),
    ) as Runnable<U>;
  }

  /**
   * Map the sequence from one type to another, concurrently.
   *
   * Items are iterated out of order. This allows maximum concurrency
   * at all times, but the output order cannot be assumed to be the
   * same as the input order.
   *
   * @param mapFn The mapping function.
   * @param concurrency The maximum concurrency.
   * @returns An iterable of mapped values.
   */
  concurrentUnorderedMap<U>(
    mapFn: (item: T) => Promise<U>,
    concurrency?: number,
  ): Runnable<U> {
    const iterable = this.iter;
    return new Runnable(
      concurrentUnorderedMap(iterable, mapFn, concurrency),
    ) as Runnable<U>;
  }

  /**
   * Filter the sequence to contain just the items that pass a test.
   * @param filterFn The filter function.
   * @returns An iterator returning the values that passed the filter function.
   */
  filter(
    filterFn: (item: T) => boolean | Promise<boolean>,
  ): Runnable<T> {
    const iterable = this.iter;
    return new Runnable(filter(iterable, filterFn)) as Runnable<T>;
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
   * @param cmd The command.
   * @param options Options.
   * @returns A child process instance.
   */
  run<S>(
    options: ProcessOptions<S>,
    ...cmd: Cmd
  ): Runnable<Uint8Array>;

  /**
   * Run a process.
   * @param cmd The command.
   * @returns A child process instance.
   */
  run(...cmd: Cmd): Runnable<Uint8Array>;

  run<S>(
    ...cmd: unknown[]
  ): Runnable<Uint8Array> {
    const { options, command, args } = parseArgs(cmd);

    const c = new Command(
      { ...options as ProcessOptions<S>, stdout: "piped", stdin: "piped" },
      command,
      ...args,
    );

    const p = c.spawn();

    this.writeTo(p.stdin as unknown as WritableIterable<T>);

    return new Runnable(p.stdout);
  }

  tee<N extends number = 2>(n?: N): Tuple<AsyncIterable<T>, N> {
    return tee(this.iter, n);
  }
}
