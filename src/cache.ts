import { retry } from "./deps/retry.ts";

/** The number of milliseconds in a second. */
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

async function fetch<T>(
  key: string | string[],
  options?: { timeout?: number },
): Promise<T | null> {
  const kv = await retry(async () => await Deno.openKv(), { maxAttempts: 3 });
  try {
    const item = await kv.get<{ timestamp: Date; value: T }>(cacheKey(key));
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
  } finally {
    kv.close();
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
 * {@link fetch} and {@link put} in one step.
 *
 * **Example**
 *
 * ```typescript
 * const peerings = await cache.cache(
 *   "vpc-peerings",
 *   async () => await proc.enumerate(allPeerings()).collect(),
 *   { timeout: 4 * HOURS },
 * );
 * ```
 *
 * @param key The cache key.
 * @param value The `value` function. This is called to fill the cache if needed.
 * @param options Options. Timeout in milliseconds.
 * @returns The (optionally cached) value.
 */
export async function cache<T>(
  key: string | string[],
  value: () => T | Promise<T>,
  options?: { timeout?: number },
) {
  let v: T | null = await fetch(
    key,
    options,
  );
  if (v == null) {
    v = await value();
    put(key, v);
  }
  return v;
}
