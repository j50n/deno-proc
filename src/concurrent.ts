import { abandon, handled } from "./helpers.ts";

/**
 * `concurrency` rounded up; the CPU count if not given. Below 1 it throws,
 * and closes `items`, which nothing will read.
 */
function resolvedConcurrency(
  items: AsyncIterable<unknown>,
  concurrency?: number | undefined,
) {
  if (concurrency === undefined) {
    return navigator.hardwareConcurrency;
  }
  const c = Math.ceil(concurrency);
  if (!(c >= 1)) {
    abandon(items);
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
  const c = resolvedConcurrency(items, concurrency);
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
 *
 * Each call and each pull records its outcome and wakes the
 * loop, so a step costs the same however many calls are in flight.
 */
export async function* concurrentUnorderedMap<T, U>(
  items: AsyncIterable<T>,
  mapFn: (item: T) => Promise<U>,
  concurrency?: number,
): AsyncIterableIterator<U> {
  const c = resolvedConcurrency(items, concurrency);
  const source = items[Symbol.asyncIterator]();
  /** Outcomes of calls, in the order they finished, not yet yielded. */
  const finished: ({ value: U } | { error: unknown })[] = [];
  /** Calls started whose outcome hasn't been yielded yet. */
  let started = 0;
  let pulling: Promise<IteratorResult<T>> | undefined;
  let arrived: { result: IteratorResult<T> } | { error: unknown } | undefined;
  let ended = false;
  let failure: { error: unknown } | undefined;
  let wake: (() => void) | undefined;
  const wakeUp = () => {
    const w = wake;
    wake = undefined;
    w?.();
  };

  try {
    while (true) {
      if (arrived !== undefined) {
        const outcome = arrived;
        arrived = pulling = undefined;
        if ("error" in outcome) {
          ended = true;
          failure = outcome;
        } else if (outcome.result.done) {
          ended = true;
        } else {
          started += 1;
          call(mapFn, outcome.result.value).then(
            (value) => (finished.push({ value }), wakeUp()),
            (error) => (finished.push({ error }), wakeUp()),
          );
        }
      }

      if (!ended && pulling === undefined && started < c) {
        pulling = source.next();
        pulling.then(
          (result) => (arrived = { result }, wakeUp()),
          (error) => (arrived = { error }, wakeUp()),
        );
      }

      const outcome = finished.shift();
      if (outcome !== undefined) {
        started -= 1;
        if ("error" in outcome) throw outcome.error;
        yield outcome.value;
      } else if (started === 0 && pulling === undefined) {
        break;
      } else {
        // Nothing to do until a call finishes or the pull settles.
        await new Promise<void>((resolve) => wake = resolve);
      }
    }
  } finally {
    if (!ended) {
      await close(source, arrived === undefined ? pulling : undefined);
    }
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
