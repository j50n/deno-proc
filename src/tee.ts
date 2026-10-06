import { abandon } from "./helpers.ts";

/** One item in the chain the branches walk along. */
type Node<T> = { value?: T; next?: Node<T> };

/**
 * Implements `Enumerable.tee`: `n` iterables that each yield every item of
 * `source`, which is read once.
 *
 * The items form a chain, and each branch holds only its own place in it, so
 * an item is garbage once every branch has passed it. A source error reaches
 * every branch, after the items before it. The source is closed when every
 * branch has stopped; a branch that is never read keeps it open, and keeps
 * every item from the start.
 */
export function tee<T>(
  source: AsyncIterable<T>,
  n: number,
): AsyncIterable<T>[] {
  if (!(Number.isInteger(n) && n >= 1)) {
    abandon(source);
    throw new RangeError(`tee needs a whole number of at least 1; got ${n}`);
  }
  const iterator = source[Symbol.asyncIterator]();
  let last: Node<T> = {};
  let pulling: Promise<void> | undefined;
  let ended = false;
  let failure: { error: unknown } | undefined;
  let open = n;

  /** Add the next item to the chain; one pull at a time, shared. */
  function pull(): Promise<void> {
    pulling ??= (async () => {
      try {
        const result = await iterator.next();
        if (result.done) ended = true;
        else last = last.next = { value: result.value };
      } catch (error) {
        ended = true;
        failure = { error };
      } finally {
        pulling = undefined;
      }
    })();
    return pulling;
  }

  // `node` is the branch's only hold on the chain: moving it lets go.
  async function* branch(node: Node<T>): AsyncGenerator<T> {
    try {
      while (true) {
        if (node.next !== undefined) {
          node = node.next;
          yield node.value as T;
        } else if (ended) {
          if (failure) throw failure.error;
          return;
        } else {
          await pull();
        }
      }
    } finally {
      if (--open === 0 && !ended) {
        ended = true;
        await iterator.return?.();
      }
    }
  }

  const branches: AsyncIterable<T>[] = [];
  for (let i = 0; i < n; i++) branches.push(branch(last));
  return branches;
}
