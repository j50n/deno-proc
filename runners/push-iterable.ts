type QueueEntry<T> = { promise: Promise<T>; resolve: (item: T) => void };

class Some<T> {
  constructor(public readonly item: T) {
  }
}

class None {}

/**
 * Invert the normal data flow of an `AsyncIterable`, allowing you to push writes on one side and
 * iterate on the other.
 *
 * The `write()` side **must** call `close()` when all write operations are done.
 */
export class PushIterable<T> implements Deno.Closer {
  private closed = false;

  private queue: QueueEntry<Some<T> | None>[] = [];

  /**
   * Create a new `PushIterable`.
   */
  constructor() {
    this.addEmptyPromiseToQueue();
  }

  /**
   * Add an unresolved promise to the end of the queue.
   */
  private addEmptyPromiseToQueue(): void {
    let resolve: (item: Some<T> | None) => void;
    const promise = new Promise<Some<T> | None>((res, _rej) => {
      resolve = res;
    });
    this.queue.push({ promise, resolve: resolve! });
  }

  /**
   * Close the iterable.
   *
   * Once closed, subsequent calls to `write(...)` will throw an error.
   *
   * It is safe to call `close()` multiple times.
   */
  close(): void {
    this.closed = true;
    this.queue[this.queue.length - 1].resolve(new None());
  }

  /**
   * Write an item.
   * @param item The item.
   */
  async write(item: T): Promise<void> {
    if (this.closed) {
      throw new Error("already closed");
    }

    this.queue[this.queue.length - 1].resolve(new Some(item));
    this.addEmptyPromiseToQueue();

    if (this.queue.length > 1) {
      await this.queue[0].promise;
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (true) {
      const item = await this.queue[0].promise;
      if (item instanceof Some) {
        yield item.item;
      } else {
        break;
      }
      this.queue.shift();
    }
  }
}
