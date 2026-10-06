type QueueEntry<T> = { promise: Promise<T>; resolve: (item: T) => void };

class Some<T> {
  constructor(public readonly item: T) {
  }
}

class None {
  constructor(public readonly error?: Error) {}
}

/**
 * Something you write items to and then close: a {@link WritableIterable}, or
 * a process's `stdin`. `Enumerable.writeTo()` accepts one.
 *
 * @typeParam T The type of the items.
 */
export interface Writable<T> {
  /** Whether `close()` has been called. */
  get isClosed(): boolean;

  /**
   * Signal the end of the data. Nothing closes a writable for you: until you
   * call this, whoever reads from the other side waits for more.
   *
   * Only the first call counts; later calls, and the errors passed to them,
   * are ignored.
   *
   * @param error Pass an error to end the data with that error instead: the
   *   reader gets the items written before it, then the error is thrown.
   */
  close(error?: Error): Promise<void>;

  /**
   * Write one item. After `close()`, the promise rejects with `Error`.
   *
   * @param item The item.
   */
  write(item: T): Promise<void>;
}

/**
 * A queue you write to from push-style code (callbacks, event handlers) and
 * read from as an async iterable.
 *
 * `write()` queues the item and returns at once; it does not wait for a
 * reader. Nothing limits the queue, so if the reader is slower than the
 * writer, or there is no reader yet, items pile up in memory. Once a reader
 * has stopped early, written items are dropped.
 *
 * Call `close()` when the data ends, or the reader waits forever after the
 * last item. `close(error)` ends it with an error instead: the reader gets
 * every item written before, then the error is thrown from its loop.
 * `write()` after `close()` rejects with `Error`; in an event handler, catch
 * it, or an unhandled rejection ends the program.
 *
 * Read it once, with one reader: a second throws `TypeError`.
 *
 * @example From events to a loop
 * ```typescript
 * import { WritableIterable } from "@j50n/proc";
 *
 * const ws = new WebSocket("wss://example.com/feed");
 * const messages = new WritableIterable<string>();
 * ws.onmessage = (e) => messages.write(e.data);
 * ws.onclose = () => messages.close();
 * ws.onerror = () => messages.close(new Error("websocket failed"));
 *
 * for await (const message of messages) {
 *   console.log(message);
 * }
 * ```
 *
 * @example Ending with an error
 * ```typescript
 * import { WritableIterable } from "@j50n/proc";
 *
 * const items = new WritableIterable<number>();
 * await items.write(1);
 * await items.close(new Error("source failed"));
 *
 * try {
 *   for await (const n of items) console.log(n); // 1
 * } catch (error) {
 *   if (error instanceof Error) console.error(error.message); // source failed
 * }
 * ```
 *
 * @typeParam T The type of the items.
 */
export class WritableIterable<T> implements Writable<T>, AsyncIterable<T> {
  private _closed = false;

  /** Whether `close()` has been called. */
  get isClosed(): boolean {
    return this._closed;
  }

  private queue: QueueEntry<Some<T> | None>[] = [];
  private reading = false;
  private abandoned = false;

  /**
   * Create an empty, open queue.
   *
   * @param options.onclose Called on the first `close()`, which waits for it.
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
   * End the data, or with `error`, end it with that error. Only the first
   * call counts.
   *
   * @param error Thrown to the reader after the items written before it.
   */
  async close(error?: Error): Promise<void> {
    if (!this.isClosed) {
      this._closed = true;
      this.queue[this.queue.length - 1].resolve(new None(error));
      if (this.options?.onclose != null) {
        await this.options.onclose();
      }
    }
  }

  /**
   * Queue one item for the reader. Resolves at once, without waiting for the
   * item to be read. Rejects with `Error` after `close()`. Once the reader has
   * stopped early (a `break`, say), items go nowhere instead of piling up.
   *
   * @param item The item.
   */
  async write(item: T): Promise<void> {
    if (this.isClosed) {
      throw new Error("writable is already closed");
    }
    if (this.abandoned) return;

    this.queue[this.queue.length - 1].resolve(new Some(item));
    this.addEmptyPromiseToQueue();

    if (this.queue.length > 1) {
      await this.queue[0].promise;
    }
  }

  /**
   * Read the items written, in order, until `close()`. It can be read once,
   * by one reader; a second throws `TypeError`.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.reading) {
      throw new TypeError("a WritableIterable can be read only once");
    }
    this.reading = true;

    try {
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
    } finally {
      // Nothing will read what is written from now on.
      this.abandoned = true;
      this.queue = [];
      this.addEmptyPromiseToQueue();
    }
  }
}
