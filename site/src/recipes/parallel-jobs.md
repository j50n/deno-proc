# Running jobs in parallel

The task: check a directory of nightly database backups with `gzip -t`, four at
a time, and report every broken one, not just the first.

```typescript
{{#include ../../examples/recipes/parallel-jobs.ts}}
```

```text
{{#include ../../examples/recipes/parallel-jobs.out}}
```

Three pieces do the work:

- **`concurrentUnorderedMap(check, { concurrency: 4 })`** keeps up to four calls
  of `check` running, and starts the next file as soon as any one finishes.
  Results come out in the order they finish, which is why the report sorts them.
  Without `concurrency`, it runs as many at once as the machine has CPUs.
- **`check` returns its failure instead of throwing.** That is what lets the
  other jobs carry on. The `try` sits inside the job, around the one command.
- **`fnStderr` and `fnError`** capture what `gzip` wrote to stderr and put it in
  the error, so the report says why each file failed. Without them, each child's
  stderr goes straight to your terminal, interleaved with the others, and the
  error says only `exit code: 1`.

The script needs `--allow-read=recipes-backups --allow-run=gzip`.

To make the script itself fail when any job did, as a CI step or a cron job
should, end it with `if (failed.length > 0) Deno.exitCode = 1;`.

## Why the `try` goes inside

This is a fragment, the same loop without the `try`:

```typescript
await enumerate(files)
  .concurrentUnorderedMap((file) => run("gzip", "-t", file).collect())
  .collect();
```

The first job that fails throws its `ExitCodeError` out of the `await`, and the
loop is over. The jobs already running carry on to the end in the background,
with no one waiting for them; the files not yet started are never checked. That
is the behavior you want when one failure makes the rest pointless (a build
whose first step broke). For a batch where each job stands alone, catch inside.

## Ordered results

`concurrentMap` takes the same arguments and yields results in input order. The
cost is that a slow job holds back the results behind it, and while it does,
fewer than `concurrency` jobs run. Use it when you print as you go and the order
matters; otherwise `concurrentUnorderedMap` keeps every slot busy.
[Doing work concurrently](../iterables/concurrency.md) covers both.

## Variations

- **A time limit per job**: put `timeout` in front of the command,
  `run("timeout", "60", "gzip", "-t", file)`. A job that runs over is stopped
  and exits with code 124, an `ExitCodeError` like any other failure.
- **Keeping each job's output**: return `await run(...).lines.collect()` from
  the job along with the file name. It is all held in memory until the end, so
  for large output, write each job's output to its own file with `.writeTo()`.
- **Jobs that are not commands**: the same shape works for any async function,
  such as `fetch` calls. `concurrency` is the number of requests in flight.
- **Showing progress**: log from inside `check` when it finishes, or use
  `.forEach()` instead of `.collect()` to handle each result as it arrives.
