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
 * Map an async sequence concurrently while preserving order.
 *
 * Processes multiple items simultaneously up to the concurrency limit,
 * but yields results in the original input order. This is useful when
 * you need to maintain order but want parallel processing.
 *
 * **Why use this?**
 * - Process items in parallel for better performance
 * - Maintain original order in results
 * - Control resource usage with concurrency limit
 * - Simpler than managing Promise.all() manually
 *
 * @example Process items concurrently
 * ```typescript
 * import { range } from "jsr:@j50n/proc";
 *
 * const results = await range({ to: 10 })
 *   .concurrentMap(async (n) => {
 *     // Simulate async work
 *     await new Promise(resolve => setTimeout(resolve, 100));
 *     return n * 2;
 *   }, { concurrency: 3 })
 *   .collect();
 * // [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] - in order
 * ```
 *
 * @param items The input sequence.
 * @param mapFn The async mapping function.
 * @param concurrency Max concurrent operations (defaults to CPU count).
 * @returns An ordered iterator of mapped values.
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

    buffer.push(mapFn(item));
  }

  while (buffer.length > 0) {
    yield await buffer.shift()!;
  }
}

/**
 * Map an async sequence concurrently without preserving order.
 *
 * Processes multiple items simultaneously and yields results as soon as they complete,
 * regardless of input order. This maximizes throughput when order doesn't matter.
 *
 * **Why use this instead of concurrentMap?**
 * - Maximum throughput - no waiting for slower items
 * - Better performance with unbalanced workloads
 * - Use when output order doesn't matter
 *
 * **Why use this instead of Promise.all()?**
 * - Streams results as they complete (lower memory)
 * - Controls concurrency (won't spawn unlimited promises)
 * - Works with AsyncIterables naturally
 *
 * @example Process items for maximum throughput
 * ```typescript
 * import { range } from "jsr:@j50n/proc";
 *
 * const results = await range({ to: 10 })
 *   .concurrentUnorderedMap(async (n) => {
 *     // Simulate variable work time
 *     await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
 *     return n * 2;
 *   }, { concurrency: 3 })
 *   .collect();
 * // Results in completion order, not input order
 * ```
 *
 * @param items The input sequence.
 * @param mapFn The async mapping function.
 * @param concurrency Max concurrent operations (defaults to CPU count).
 * @returns An unordered iterator of mapped values.
 */
export async function* concurrentUnorderedMap<T, U>(
  items: AsyncIterable<T>,
  mapFn: (item: T) => Promise<U>,
  concurrency?: number,
): AsyncIterableIterator<U> {
  const c = resolvedConcurrency(concurrency);

  /*
   * Two queues. The same Esimorps are pushed into each in the same order.
   * The shifts are done at different times - one at the backend (aft) when
   * a promise is resolved, and one at the frontend (fore) when the result
   * of that promise can be yielded.
   *
   * Kind of hard to see how it works, but it was an "Aha!" moment for me.
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

/**
 * An unresolved/unrejected promise turned inside-out.
 */
function esimorp<T>(): Esimorp<T> {
  let rs: Resolve<T>;
  let rj: Reject;

  const p = new Promise<T>((resolve, reject) => {
    rs = resolve;
    rj = reject;
  });

  return { promise: p, resolve: rs!, reject: rj! };
}
