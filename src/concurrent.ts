import { handled } from "./helpers.ts";

/** `concurrency` rounded up; the CPU count if not given. Throws below 1. */
function resolvedConcurrency(concurrency?: number | undefined) {
  if (concurrency === undefined) {
    return navigator.hardwareConcurrency;
  }
  const c = Math.ceil(concurrency);
  if (!(c >= 1)) {
    throw new Error(`concurrency must be at least 1; got ${concurrency}`);
  }
  return c;
}

/** `mapFn(item)` as a promise, even if `mapFn` throws or isn't async. */
function call<T, U>(mapFn: (item: T) => Promise<U>, item: T): Promise<U> {
  return handled((async () => await mapFn(item))());
}

/**
 * Implements `Enumerable.concurrentMap`: up to `concurrency` calls of `mapFn`
 * in flight, results yielded in input order as soon as each is ready. A slow
 * item holds back the results after it, and while it does, fewer than
 * `concurrency` calls run. A rejection is thrown when its turn to be yielded
 * comes. If the source throws, the calls already started are yielded first.
 */
export async function* concurrentMap<T, U>(
  items: AsyncIterable<T>,
  mapFn: (item: T) => Promise<U>,
  concurrency?: number,
): AsyncIterableIterator<U> {
  const c = resolvedConcurrency(concurrency);
  const source = items[Symbol.asyncIterator]();
  const running: Promise<U>[] = [];
  let pulling: Promise<IteratorResult<T>> | undefined;
  let ended = false;
  let failure: { error: unknown } | undefined;

  try {
    while (true) {
      if (!ended && pulling === undefined && running.length < c) {
        pulling = source.next();
      }
      if (running.length === 0 && pulling === undefined) break;

      // Whichever comes first: the next result in order, or the next item.
      const next = await Promise.race([
        ...running.slice(0, 1).map((p) => p.then(head, head)),
        ...(pulling ? [pulling.then(pulled, pulled)] : []),
      ]);

      if (next === HEAD) {
        yield await running.shift()!;
      } else {
        try {
          const result = await pulling!;
          if (result.done) ended = true;
          else running.push(call(mapFn, result.value));
        } catch (error) {
          ended = true;
          failure = { error };
        }
        pulling = undefined;
      }
    }
  } finally {
    if (!ended) await close(source, pulling);
  }

  if (failure) throw failure.error;
}

/**
 * Implements `Enumerable.concurrentUnorderedMap`: up to `concurrency` calls of
 * `mapFn` in flight, results yielded as they finish. A rejection is thrown as
 * soon as it happens. If the source throws, the calls already started are
 * yielded first.
 */
export async function* concurrentUnorderedMap<T, U>(
  items: AsyncIterable<T>,
  mapFn: (item: T) => Promise<U>,
  concurrency?: number,
): AsyncIterableIterator<U> {
  const c = resolvedConcurrency(concurrency);
  const source = items[Symbol.asyncIterator]();
  const running = new Set<Promise<Settled<U>>>();
  let pulling: Promise<IteratorResult<T>> | undefined;
  let ended = false;
  let failure: { error: unknown } | undefined;

  try {
    while (true) {
      if (!ended && pulling === undefined && running.size < c) {
        pulling = source.next();
      }
      if (running.size === 0 && pulling === undefined) break;

      const next = await Promise.race([
        ...running,
        ...(pulling ? [pulling.then(pulled, pulled)] : []),
      ]);

      if (next === PULLED) {
        try {
          const result = await pulling!;
          if (result.done) ended = true;
          else running.add(settle(call(mapFn, result.value)));
        } catch (error) {
          ended = true;
          failure = { error };
        }
        pulling = undefined;
      } else {
        running.delete(next.self);
        if ("error" in next) throw next.error;
        yield next.value;
      }
    }
  } finally {
    if (!ended) await close(source, pulling);
  }

  if (failure) throw failure.error;
}

/**
 * Close a source the consumer stopped reading early. With a pull still
 * pending, the close waits behind it, and the item may never come, so don't
 * wait for it.
 */
async function close<T>(
  source: AsyncIterator<T>,
  pulling: Promise<IteratorResult<T>> | undefined,
): Promise<void> {
  const closing = source.return?.();
  if (pulling === undefined) await closing;
  else handled(closing);
}

const HEAD = Symbol("head");
const PULLED = Symbol("pulled");
const head = (): typeof HEAD => HEAD;
const pulled = (): typeof PULLED => PULLED;

type Settled<U> =
  & { self: Promise<Settled<U>> }
  & ({ value: U } | { error: unknown });

/** A promise of `p`'s outcome that knows itself, so it can leave `running`. */
function settle<U>(p: Promise<U>): Promise<Settled<U>> {
  const self: Promise<Settled<U>> = p.then(
    (value) => ({ self, value }),
    (error) => ({ self, error }),
  );
  return self;
}
