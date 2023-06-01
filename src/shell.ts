import { WritableIterable } from "./writable-iterable.ts";
import { map } from "./deps/asynciter.ts";

export async function pipeTo<T>(
  src: AsyncIterable<T>,
  dest: WritableIterable<T>,
) {
  try {
    for await (const item of src) {
      dest.write(item);
    }
  } finally {
    dest.close();
  }
}

export async function* pipeThrough<T, U>(
  src: AsyncIterable<T>,
  transform: (item: T) => U | Promise<U>,
): AsyncIterableIterator<U> {
  for await (const item of src) {
    yield transform(item);
  }
}

export class Shell implements Deno.Closer {
  constructor() {}

  async close(): Promise<void> {
  }
}

export class AsyncIterableRunnable<T> {
  constructor(protected readonly iterator: AsyncIterable<T>) {
  }

  public async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    for await (const item of this.iterator) {
      yield item;
    }
  }

  /**
   * Map the sequence from one type to another.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values.
   */
  public map<U>(mapFn: (item: T) => U | Promise<U>) {
    const iterable = this.iterator;
    return new AsyncIterableRunnable({
      async *[Symbol.asyncIterator]() {
        yield* map(iterable, mapFn);
      },
    });
  }
}
