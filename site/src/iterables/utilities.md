# Utilities

Small helpers that come with proc, for the jobs scripts keep needing.

## `range`

```typescript
{{#include ../../examples/iterables/range.ts}}
```

```text
{{#include ../../examples/iterables/range.out}}
```

`range` counts from `from` (default 0) by `step` (default 1), as an
`Enumerable`. With `to` it stops before `to`; with `until` it includes `until`
when a step lands on it. A negative step counts down, a step that moves away
from the limit gives nothing, and a step of 0 throws `RangeError`. Numbers are
made as they are read, so `to: Infinity` is fine with `take`. Fractional steps
gather floating-point error: `{ until: 0.3, step: 0.1 }` stops at 0.2.

## `sleep` and the time constants

```typescript
{{#include ../../examples/iterables/sleep.ts}}
```

```text
{{#include ../../examples/iterables/sleep.out}}
```

`sleep(ms)` resolves after `ms` milliseconds without blocking anything else.
`SECONDS`, `MINUTES`, `HOURS`, `DAYS`, and `WEEKS` are plain numbers of
milliseconds, for `sleep`, `cache`, or anything else that takes milliseconds:
`sleep(2 * SECONDS)`.

## `shuffle`

```typescript
{{#include ../../examples/iterables/shuffle.ts}}
```

`shuffle` reorders an array in place and returns nothing. It uses `Math.random`,
so it is not for anything that must be unpredictable, such as tokens.

## `concat` and `concatLines`

```typescript
{{#include ../../examples/iterables/concat.ts}}
```

```text
{{#include ../../examples/iterables/concat.out}}
```

`concat` joins byte arrays into one; `concatLines` does the same with a `"\n"`
after each. Given a single array, `concat` returns that array itself, not a
copy. These are not `Enumerable.concat`, which appends one sequence to another.

## `cache`

`cache(key, compute, { timeout })` returns the value stored under `key` if it is
younger than `timeout` (default 24 hours); otherwise it calls `compute`, stores
the result, and returns it. The values live in Deno KV's default database, so
they last across runs, which is the point: an expensive lookup is done once a
day, not every time the script runs.

This is a fragment, not a checked example, because Deno KV is unstable: the
program needs `--unstable-kv` (or `"unstable": ["kv"]` in `deno.json`), and the
book's examples run without it. Without the flag, `cache` throws a `TypeError`
that says so.

```typescript
import { cache, HOURS, run } from "@j50n/proc";

const branches = await cache(
  ["git", "remote-branches"],
  () => run("git", "ls-remote", "--heads", "origin").lines.collect(),
  { timeout: 4 * HOURS },
);
```

`null` and `undefined` are never stored, so `compute` runs every time for them.
A value must fit in a KV entry (structured-cloneable, at most 64 KiB) to be
cached; one that doesn't is returned without being stored, so `compute` runs
every time for it. Deno KV deletes each entry once it is older than the timeout
it was stored with. Two calls that miss at the same time both compute.

To recompute whatever is stored, pass `refresh: true`: `compute` runs, and its
result is stored as on a miss, so later calls read it. A script's `--refresh`
flag maps straight onto it. A timeout of 0 also skips the read, but stores
nothing: use it for a call that shouldn't touch the cache at all. A refresh
whose result can't be stored removes the old entry, so a later call computes
again rather than getting the value the refresh replaced.

A value read back from the cache is a structured clone. A class instance comes
back as a plain object, without its methods or getters, though its type still
says it is the class; cache plain data.

Deno picks which database "default" means. With a `deno.json`, every script in
that project shares one, so two scripts that both use the key `"config"` get
each other's values; without one, each main script has its own. The database is
a SQLite file under Deno's cache directory (`DENO_DIR`), unencrypted, and an
entry stays in it until it expires, so don't cache secrets such as tokens. See
the [API reference](https://jsr.io/@j50n/proc/doc/~/cache).

## `debug`

```typescript
{{#include ../../examples/iterables/debug.ts}}
```

```text
{{#include ../../examples/iterables/debug.out}}
```

`debug` is a step that prints each item as JSON, in blue, as it passes, and
hands it on unchanged. It prints with `console.log`, so the lines land on stdout
among the program's own output. Remove it when you're done; an item JSON can't
hold (a `BigInt`) throws.

## `isString`

```typescript
{{#include ../../examples/iterables/is-string.ts}}
```

```text
{{#include ../../examples/iterables/is-string.out}}
```

`isString` is `typeof value === "string"` as a type guard, so TypeScript narrows
the value after it. A `String` object is not a string by this test.
