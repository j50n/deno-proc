import {
  collect,
  concurrentMap,
  concurrentUnorderedMap,
  filter,
  forEach,
  map,
  reduce,
} from "./deps/asynciter.ts";

export class RunnableIterable<T> {
  constructor(protected iter: AsyncIterable<T>) {
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    for await (const item of this.iter) {
      yield item;
    }
  }

  /**
   * Transform the iterable from one type to another with an opportunity to catch
   * and handle errors.
   * @param fn The transform function.
   * @returns The transformed iterable.
   */
  public transform<U>(
    fn: (it: AsyncIterable<T>) => AsyncIterable<U>,
  ): RunnableIterable<U> {
    return new RunnableIterable(fn(this.iter));
  }

  /**
   * Map the iterator from one type to another.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values.
   */
  map<U>(mapFn: (item: T) => U | Promise<U>): RunnableIterable<U> {
    const iterable = this.iter;
    return new RunnableIterable({
      async *[Symbol.asyncIterator]() {
        yield* map(iterable, mapFn);
      },
    });
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
  public concurrentMap<U>(
    mapFn: (item: T) => Promise<U>,
    concurrency?: number,
  ): RunnableIterable<U> {
    const iterable = this.iter;
    return new RunnableIterable({
      async *[Symbol.asyncIterator]() {
        yield* concurrentMap(iterable, mapFn, concurrency);
      },
    });
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
  public concurrentUnorderedMap<U>(
    mapFn: (item: T) => Promise<U>,
    concurrency?: number,
  ): RunnableIterable<U> {
    const iterable = this.iter;
    return new RunnableIterable({
      async *[Symbol.asyncIterator]() {
        yield* concurrentUnorderedMap(iterable, mapFn, concurrency);
      },
    });
  }

  /**
   * Filter the sequence to contain just the items that pass a test.
   * @param filterFn The filter function.
   * @returns An iterator returning the values that passed the filter function.
   */
  public filter(
    filterFn: (item: T) => boolean | Promise<boolean>,
  ): RunnableIterable<T> {
    const iterable = this.iter;
    return new RunnableIterable({
      async *[Symbol.asyncIterator]() {
        yield* filter(iterable, filterFn);
      },
    });
  }

  /**
   * Reduce a sequence to a single value.
   * @param reduce The reducing function.
   * @returns The result of applying the reducing function to each item and accumulating the result.
   */
  public async reduce<U>(
    zero: U,
    reduceFn: (acc: U, item: T) => U | Promise<U>,
  ): Promise<U> {
    return await reduce(this.iter, zero, reduceFn);
  }

  /**
   * Perform an operation for each item in the sequence.
   * @param forEachFn The forEach function.
   */
  public async forEach(
    forEachFn: (item: T) => void | Promise<void>,
  ): Promise<void> {
    await forEach(this.iter, forEachFn);
  }

  /**
   * Collect the items in this iterator to an array.
   * @returns The items of this iterator collected to an array.
   */
  public async collect(): Promise<T[]> {
    return await collect(this.iter);
  }
}
