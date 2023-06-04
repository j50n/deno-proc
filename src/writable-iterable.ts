type QueueEntry<T> = { promise: Promise<T>; resolve: (item: T) => void };

class Some<T> {
  constructor(public readonly item: T) {
  }
}

class None {
  constructor(public readonly error?: Error) {}
}

/**
 * Invert the normal data flow of an `AsyncIterable`, allowing you to push writes on one side and
 * iterate on the other.
 *
 * The `write()` side **must** call `close()` when all write operations are done.
 */
export class WritableIterable<T> implements AsyncIterable<T> {
  private _closed = false;

  get closed() {
    return this._closed;
  }

  private queue: QueueEntry<Some<T> | None>[] = [];

  /**
   * Create a new `PushIterable`.
   */
  constructor(protected options?: { onclose?: () => void | Promise<void> }) {
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
   * Close the iterable. This must be called.
   *
   * Once closed, subsequent calls to `write(...)` will throw an error.
   *
   * It is safe to call `close()` multiple times. The error (or no error)
   * passed on the first call will be honored.
   */
  async close(error?: Error): Promise<void> {
    if (!this.closed) {
      this._closed = true;
      this.queue[this.queue.length - 1].resolve(new None(error));
      if (this.options?.onclose != null) {
        await this.options.onclose();
      }
    }
  }

  /**
   * Write an item.
   * @param item The item.
   */
  async write(item: T): Promise<void> {
    if (this.closed) {
      throw new Error("writable is already closed");
    }

    this.queue[this.queue.length - 1].resolve(new Some(item));
    this.addEmptyPromiseToQueue();

    if (this.queue.length > 1) {
      await this.queue[0].promise;
    }
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      try {
        const item = await this.queue[0].promise;
        if (item instanceof Some) {
          yield item.item;
        } else {
          if (item.error != null) {
            throw item.error;
          } else {
            break;
          }
        }
      } finally {
        this.queue.shift();
      }
    }
  }
}
