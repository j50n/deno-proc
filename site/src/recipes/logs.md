# Searching logs

The task: find the database errors in an application's logs, where the current
file is plain text and the rotated ones are gzipped (`app.log`, `app.log.1.gz`,
`app.log.2.gz`, as `logrotate` leaves them).

```typescript
{{#include ../../examples/recipes/logs-search.ts}}
```

```text
{{#include ../../examples/recipes/logs-search.out}}
```

`logLines()` is the one piece of logic: a `.gz` file goes through
`DecompressionStream` before `.lines`, a plain one doesn't. `flatMap` reads the
files one after another as a single stream of lines, so memory stays flat
however big the logs are, and `toStdout()` prints each match as it is found.
`Deno.readDir` lists files in no particular order, hence the sort.

The script needs `--allow-read=recipes-logs` and nothing else: no command is
run.

## Summarizing

Counting is a `forEach` into a `Map`. Slicing fixed columns is the fastest way
to pick a line apart when the format is fixed; use a regular expression when it
isn't.

```typescript
{{#include ../../examples/recipes/logs-summary.ts}}
```

```text
{{#include ../../examples/recipes/logs-summary.out}}
```

Timestamps in this format sort as strings, so a time window is a string
comparison:
`.filter((line) => line >= "2026-10-04 06:00" && line < "2026-10-04 14:00")`.

## Letting grep do the searching

For gigabytes of logs, `grep` finds matches faster than a JavaScript filter, and
`zgrep` reads plain and gzipped files alike. The trap is that grep exits with
code 1 when nothing matches, which proc, like `set -e`, treats as a failure. An
`fnError` handler that lets exit code 1 through turns "no matches" back into "no
lines":

```typescript
{{#include ../../examples/recipes/logs-grep.ts}}
```

```text
{{#include ../../examples/recipes/logs-grep.out}}
```

Exit code 2 (a missing file, a bad pattern) still throws `ExitCodeError`.
[Errors](../processes/errors.md) has more on `fnError`.

The same applies to grep in the middle of a pipeline:
`read(path).run({ fnError: noMatchIsFine }, "grep", "ERROR")`.

## Variations

- **Following a log as it grows**: `read()` stops at the end of the file. For
  `tail -f`, run it: `await run("tail", "-F", "app.log").lines.forEach(...)`
  goes on until you stop it.
- **Many large files at once**: wrap the per-file work in
  [`concurrentMap`](../iterables/concurrency.md), one file per call, and combine
  the counts at the end.
- **The first match only**: `.find((line) => ...)` stops reading at the match
  and closes the file.
- **Structured logs** (one JSON object per line): `.transform(jsonParse)` after
  `.lines`, or see [JSON lines](../data/json.md).
- **Writing the matches to a file**: end with
  `.transform(toBytes).writeTo(path)` instead of `.toStdout()`. `writeTo` takes
  bytes, not strings.
