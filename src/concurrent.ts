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
 * Map the sequence from one type to another, concurrently.
 *
 * Items are iterated in order.
 *
 * @param iterable An iterable collection.
 * @param mapFn The mapping function.
 * @returns An iterator of mapped values.
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
 * Map the sequence from one type to another, concurrently.
 *
 * Items are iterated out of order. This allows maximum concurrency
 * at all times, but the output order cannot be assumed to be the
 * same as the input order.
 *
 * @param iterable An iterable collection.
 * @param mapFn The mapping function.
 * @returns An iterator of mapped values.
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
