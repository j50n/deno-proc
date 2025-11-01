type QueueEntry<T> = { promise: Promise<T>; resolve: (item: T) => void };

class Some<T> {
  constructor(public readonly item: T) {
  }
}

class None {
  constructor(public readonly error?: Error) {}
}

/**
 * Simplified writable.
 *
 * @typedef T The type of data that may be written.
 */
export interface Writable<T> {
  /** Indicates this is closed. */
  get isClosed(): boolean;

  /**
   * Close the writable.
   *
   * This must be called. The underlying resource will not be closed automatically.
   *
   * Once closed, subsequent calls to `write(...)` will throw an error.
   *
   * It is safe to call `close()` multiple times. Calls to `close()` after the first are a no-op.
   *
   * If an error is passed on `close()`, it propagates forward.
   *
   * The error (or `undefined`) passed on the first call to `close()` will be the one that is used.
   * Error conditions passed on subsequent calls to `close` will be ignored.
   *
   * @param error If an error is passed on close, it is propagated
   *     forward.
   */
  close(error?: Error): Promise<void>;

  /**
   * Write an item.
   * @param item The item.
   */
  write(item: T): Promise<void>;
}

/**
 * Invert data flow: push writes on one side, iterate on the other.
 *
 * WritableIterable bridges the gap between push-based (write) and pull-based (iterate)
 * programming models. It's useful when you need to feed data into an AsyncIterable
 * from imperative code.
 *
 * **Important:** You must call `close()` when done writing, or iteration will hang.
 *
 * **Why use this?**
 * - Convert callback-based APIs to AsyncIterable
 * - Feed data to process stdin programmatically
 * - Bridge between different async patterns
 * - Proper error propagation
 *
 * @example Basic usage
 * ```typescript
 * import { WritableIterable } from "jsr:@j50n/proc";
 *
 * const writable = new WritableIterable<number>();
 *
 * // Write in background
 * (async () => {
 *   await writable.write(1);
 *   await writable.write(2);
 *   await writable.write(3);
 *   await writable.close();
 * })();
 *
 * // Read
 * for await (const item of writable) {
 *   console.log(item);
 * }
 * ```
 *
 * @example Error propagation
 * ```typescript
 * import { WritableIterable } from "jsr:@j50n/proc";
 *
 * const writable = new WritableIterable<number>();
 *
 * (async () => {
 *   await writable.write(1);
 *   await writable.close(new Error("something failed"));
 * })();
 *
 * try {
 *   for await (const item of writable) {
 *     // Process items
 *   }
 * } catch (error) {
 *   console.error("Error:", error);
 * }
 * ```
 *
 * @typedef T The type of data written and read.
 */
export class WritableIterable<T> implements Writable<T>, AsyncIterable<T> {
  private _closed = false;

  get isClosed(): boolean {
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

  async close(error?: Error): Promise<void> {
    if (!this.isClosed) {
      this._closed = true;
      this.queue[this.queue.length - 1].resolve(new None(error));
      if (this.options?.onclose != null) {
        await this.options.onclose();
      }
    }
  }

  async write(item: T): Promise<void> {
    if (this.isClosed) {
      throw new Error("writable is already closed");
    }

    this.queue[this.queue.length - 1].resolve(new Some(item));
    this.addEmptyPromiseToQueue();

    if (this.queue.length > 1) {
      await this.queue[0].promise;
    }
  }

  /**
   * It is an `AsyncIterable<T>`.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
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
