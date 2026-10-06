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

/** What {@link cache} stores under a key. */
type Entry<T> = { timestamp: Date; value: T };

/**
 * Open Deno KV's default database. Without KV enabled, say how to enable it
 * rather than fail later. Opening is retried, since another process can hold
 * the database for a moment; a `TypeError` won't go away on its own, so it
 * isn't.
 */
async function openKv(): Promise<Deno.Kv> {
  if (typeof Deno.openKv !== "function") {
    throw new TypeError(
      'cache needs Deno KV: run with --unstable-kv, or add "unstable": ["kv"] to deno.json',
    );
  }
  return await retry(() => Deno.openKv(), {
    maxAttempts: 3,
    isRetriable: (error) => !(error instanceof TypeError),
  });
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
): Promise<Deno.KvEntryMaybe<{ timestamp: Date; value: T }>> {
  const kv = await openKv();
  try {
    return await kv.get<Entry<T>>(cacheKey(key));
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
 * opens the same database: with a `deno.json`, every script in the project;
 * without one, each main script has its own. The database is an unencrypted
 * file under `DENO_DIR`, so don't cache secrets. A key of `"x"` is the same
 * as `["x"]`. Age is checked when read, against the `timeout` of that call:
 * an older entry is recomputed and replaced. Deno KV also deletes each entry
 * once it is older than the `timeout` it was stored with, so the database
 * doesn't grow without end.
 *
 * Things to know:
 *
 * - Deno KV is unstable: run with `--unstable-kv` (or `"unstable": ["kv"]` in
 *   `deno.json`). Without it, `cache` throws a `TypeError` saying so.
 * - `null` and `undefined` are not cached; `value` is called every time. Nor
 *   is anything with a `timeout` of 0.
 * - To be cached, the value must fit in a KV entry: structured-cloneable (no
 *   functions) and at most 64 KiB. One that doesn't is returned uncached, so
 *   `value` runs on every call. A hit returns a structured clone: a class
 *   instance comes back as a plain object, whatever `T` says.
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
  const timeout = options?.timeout ?? DAYS;
  const kv = await openKv();
  try {
    const stored = await kv.get<Entry<T>>(cacheKey(key));
    if (
      stored.value != null &&
      Date.now() - stored.value.timestamp.getTime() < timeout
    ) {
      return stored.value.value;
    }

    const fresh = await value();
    // With no time to live, a stored value would never be read.
    if (fresh != null && timeout > 0) {
      try {
        await kv.set(
          cacheKey(key),
          { timestamp: new Date(), value: fresh },
          // KV deletes the entry once it is this old; reads check age anyway.
          Number.isFinite(timeout) ? { expireIn: timeout } : undefined,
        );
      } catch {
        // A value KV can't hold (too large, not cloneable) is returned, not
        // stored: the call worked, only the caching didn't.
      }
    }
    return fresh;
  } finally {
    kv.close();
  }
}
