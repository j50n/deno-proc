import { handled } from "./helpers.ts";

/** `concurrency` rounded up; the CPU count if not given. Throws below 1. */
function resolvedConcurrency(concurrency?: number | undefined) {
  if (concurrency === undefined) {
    return navigator.hardwareConcurrency;
  } else {
    const c = Math.ceil(concurrency);
    if (c < 1) {
      throw new Error(`concurrency must be greater than 0; got ${c}`);
    }
    return Math.ceil(concurrency);
  }
}

/**
 * Implements `Enumerable.concurrentMap`: up to `concurrency` calls of `mapFn`
 * in flight, results yielded in input order. A slow item holds back the
 * results after it, and while it does, fewer than `concurrency` calls run. A
 * rejection is thrown when its turn to be yielded comes.
 */
export async function* concurrentMap<T, U>(
  items: AsyncIterable<T>,
  mapFn: (item: T) => Promise<U>,
  concurrency?: number,
): AsyncIterableIterator<U> {
  const c = resolvedConcurrency(concurrency);

  const buffer: Promise<U>[] = [];

  for await (const item of items) {
    if (buffer.length >= c) {
      yield await buffer.shift()!;
    }

    buffer.push(handled(mapFn(item)));
  }

  while (buffer.length > 0) {
    yield await buffer.shift()!;
  }
}

/**
 * Implements `Enumerable.concurrentUnorderedMap`: keeps `concurrency` calls of
 * `mapFn` in flight and yields results in the order they finish. A rejection
 * is thrown when it would have been yielded.
 */
export async function* concurrentUnorderedMap<T, U>(
  items: AsyncIterable<T>,
  mapFn: (item: T) => Promise<U>,
  concurrency?: number,
): AsyncIterableIterator<U> {
  const c = resolvedConcurrency(concurrency);

  /*
   * The same slots go into both queues. Whichever call finishes next fills
   * the oldest unfilled slot (shift from aft); the consumer takes the oldest
   * slot (shift from fore). So slots fill in completion order, and the
   * consumer gets results in that order.
   */
  const buffAft: Esimorp<U>[] = [];
  const buffFore: Esimorp<U>[] = [];

  for await (const item of items) {
    if (buffFore.length >= c) {
      yield await buffFore.shift()!.promise;
    }

    const p: Esimorp<U> = esimorp();
    buffAft.push(p);
    buffFore.push(p);
    handled(p.promise);

    (async () => {
      try {
        const transItem = await mapFn(item);
        buffAft.shift()!.resolve(transItem);
      } catch (e) {
        buffAft.shift()!.reject(e);
      }
    })();
  }

  while (buffFore.length > 0) {
    yield await buffFore.shift()!.promise;
  }
}

type Resolve<T> = (value: T) => void;

type Reject = (reason?: unknown) => void;

type Esimorp<T> = { promise: Promise<T>; resolve: Resolve<T>; reject: Reject };

/** A pending promise with its `resolve` and `reject` (promise backwards). */
function esimorp<T>(): Esimorp<T> {
  let rs: Resolve<T>;
  let rj: Reject;

  const p = new Promise<T>((resolve, reject) => {
    rs = resolve;
    rj = reject;
  });

  return { promise: p, resolve: rs!, reject: rj! };
}
