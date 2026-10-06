import { retry } from "@std/async/retry";

/**
 * Milliseconds in a second. The time constants are plain numbers of
 * milliseconds, for {@link cache}'s `timeout`, {@link sleep}, or anything else
 * that takes milliseconds: `4 * HOURS`.
 */
export const SECONDS = 1000;

/** The number of milliseconds in a minute. */
export const MINUTES = 60 * SECONDS;

/** The number of milliseconds in an hour. */
export const HOURS = 60 * MINUTES;

/** The number of milliseconds in a day. */
export const DAYS = 24 * HOURS;

/** The number of milliseconds in a week. */
export const WEEKS = 7 * DAYS;

function cacheKey(key: string | string[]): string[] {
  if (Array.isArray(key)) {
    return [".oO(CACHE)", ...key];
  } else {
    return [".oO(CACHE)", key];
  }
}

/**
 * Read the raw entry {@link cache} stored under `key`, whether or not it has
 * expired, for debugging. Use `cache` itself to get values.
 *
 * The entry's `value` is `{ timestamp, value }`, with `timestamp` the time it
 * was stored, or `null` if nothing is stored under the key. Throws as `cache`
 * does when Deno KV is not enabled.
 *
 * @param key The cache key, as given to `cache`.
 */
export async function fetchRecord<T>(
  key: string | string[],
): Promise<
  Deno.KvEntryMaybe<{
    timestamp: Date;
    value: T;
  }>
> {
  const kv = await retry(async () => await Deno.openKv(), { maxAttempts: 3 });
  try {
    return await kv.get<{ timestamp: Date; value: T }>(cacheKey(key));
  } finally {
    kv.close();
  }
}

async function fetch<T>(
  key: string | string[],
  options?: { timeout?: number },
): Promise<T | null> {
  const item = await fetchRecord<T>(key);
  if (item.value == null) {
    return null;
  } else {
    const now = new Date().getTime();

    const tout = options?.timeout == null
      ? 24 * 60 * 60 * 1000
      : options.timeout;

    if (now - item.value.timestamp.getTime() < tout) {
      return item.value.value;
    } else {
      return null;
    }
  }
}

async function put<T>(key: string | string[], value: T): Promise<void> {
  const kv = await Deno.openKv();
  try {
    await kv.delete(cacheKey(key));
    await kv.set(cacheKey(key), { timestamp: new Date(), value });
  } finally {
    kv.close();
  }
}

/**
 * Return the value stored under `key` if it is younger than `timeout`;
 * otherwise call `value`, store what it returns, and return that.
 *
 * Values are kept in Deno KV's default database (`Deno.openKv()` with no
 * path), so they last across runs and are shared with every program that
 * opens the same database. A key of `"x"` is the same as `["x"]`. Age is
 * checked when read, against the `timeout` of that call: an older entry is
 * recomputed and replaced, and nothing is ever deleted.
 *
 * Things to know:
 *
 * - Deno KV is unstable: run with `--unstable-kv` (or `"unstable": ["kv"]` in
 *   `deno.json`). Without it, `cache` throws `RetryError` from `@std/async`,
 *   with the real `TypeError` as its `cause`.
 * - `null` and `undefined` are not cached; `value` is called every time.
 * - The value must fit in a KV entry: structured-cloneable (no functions) and
 *   at most 64 KiB, or storing it throws `TypeError` (after `value` has run).
 * - Two calls that miss at the same time both call `value`.
 * - An error thrown by `value` comes out of `cache` unchanged, and nothing is
 *   stored.
 *
 * @example
 * ```typescript
 * import { cache, HOURS } from "@j50n/proc";
 *
 * const release = await cache(
 *   ["github", "denoland/deno", "latest"],
 *   async () => {
 *     const response = await fetch(
 *       "https://api.github.com/repos/denoland/deno/releases/latest",
 *     );
 *     return (await response.json()).tag_name as string;
 *   },
 *   { timeout: 4 * HOURS },
 * );
 * ```
 *
 * @param key The cache key: a string, or an array of strings.
 * @param value Computes the value when there is no fresh one stored.
 * @param options.timeout How old a stored value may be, in milliseconds.
 *   Default 24 hours.
 */
export async function cache<T>(
  key: string | string[],
  value: () => T | Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  let v: T | null = await fetch(
    key,
    options,
  );
  if (v == null) {
    v = await value();
    await put(key, v);
  }
  return v;
}
