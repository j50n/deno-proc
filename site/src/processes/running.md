# Running a command

```typescript
{{#include ../../examples/processes/running-first.ts}}
```

```text
{{#include ../../examples/processes/running-first.out}}
```

[`run()`](https://jsr.io/@j50n/proc/doc/~/run) takes the program and its
arguments as separate strings. No shell is involved, so nothing needs quoting,
and `run("head -n 3 app.log")` looks for a program with that whole name. The
program is looked up on `PATH`, or given as a path or a file URL. A relative
path such as `./build.sh` is found from the child's working directory, so with
the `cwd` option below it is looked for in `cwd`, not where your program runs.

The child starts at the call. `run()` returns a
[`ProcessEnumerable`](https://jsr.io/@j50n/proc/doc/~/ProcessEnumerable): the
child's stdout as an async iterable of bytes, with all the
[Enumerable methods](../iterables/enumerable.md). Steps such as `.lines` wait
until a consumer pulls; the process doesn't. If the command fails, the
consumer's `await` throws (see [Errors](./errors.md)).

## Reading the output

```typescript
{{#include ../../examples/processes/running-output.ts}}
```

```text
{{#include ../../examples/processes/running-output.out}}
```

- `.lines` decodes UTF-8 and splits on `"\n"` (a `"\r"` before it goes too). It
  is a property, not a method.
- `.collect()` gathers everything into an array. For large output, use
  `for await` or `.forEach()` instead, which handle one line at a time and keep
  nothing.
- `.first` is a promise of the first line. It stops reading there, which ends
  the command early (see [Pipelines](./pipelines.md#stopping-early)), and throws
  `RangeError` if there is no output at all.
- Without `.lines` the items are `Uint8Array` chunks of whatever size the pipe
  delivered, not lines. `concat()` joins them.
- `.toStdout()` copies the output to your program's stdout. Use it when you only
  want the user to see it.

The output can be read once
([Key ideas](../start/key-ideas.md#5-an-enumerable-is-used-once)): a second pass
finds nothing, and doesn't throw a failed command's error again.

## Working directory and environment

Options go before the command:

```typescript
{{#include ../../examples/processes/running-options.ts}}
```

```text
{{#include ../../examples/processes/running-options.out}}
```

`cwd` sets the child's working directory. `env` adds variables to the
environment the child inherits, or overrides them; it can't remove one. A `PATH`
in `env` also changes where the program is looked up, so `run({ env }, "ls")`
runs whatever `ls` comes first on that `PATH`. Don't build `env` from untrusted
input. `clearEnv: true` starts the child with only `env`, to keep secrets in
your environment from reaching it; give it a `PATH`, or the program by its path.

`timeoutMs` stops a child that runs too long: proc sends it SIGTERM, and reading
its output throws a `TimeoutError` ([Errors](./errors.md#timed-out)). The other
options, `fnStderr` and `fnError`, are about errors and are covered in
[Errors](./errors.md). All of them are listed under
[`ProcessOptions`](https://jsr.io/@j50n/proc/doc/~/ProcessOptions).

## Status and PID

```typescript
{{#include ../../examples/processes/running-status.ts}}
```

```text
{{#include ../../examples/processes/running-status.out}}
```

`.status` resolves when the child exits, with `success`, `code`, and `signal`.
It never throws for a failed exit; it tells you about it. `.pid` is the child's
process ID, available as soon as `run()` returns.

## Waiting for a command you don't want output from

`.status` resolves only when the child exits, and a child that writes more than
its stdout pipe holds (typically 64 KB) can't exit until someone reads. This
fragment hangs forever, because nothing reads `seq`'s output:

```typescript
await run("seq", "1", "100000").status; // hangs: nobody reads the output
```

So read the output even when you don't want it:

```typescript
{{#include ../../examples/processes/running-wait.ts}}
```

```text
{{#include ../../examples/processes/running-wait.out}}
```

Calling `.forEach()` on the raw bytes skips decoding them, and a failed exit
still throws. Use `.status` alone only for a command that prints little or
nothing, such as `test` or `grep -q`, and when a failed exit is an answer rather
than an error.

## stderr goes to your terminal

```typescript
{{#include ../../examples/processes/running-stderr.ts}}
```

```text
{{#include ../../examples/processes/running-stderr.out}}
```

Only stdout is captured. The child's stderr is connected straight to your
program's, so `to stderr` appeared on the terminal and isn't in the result. To
capture it, pass `fnStderr`; see
[Capturing stderr](./errors.md#putting-stderr-into-the-error).

The child's stdin is closed: a program that reads stdin sees end of input at
once. To feed it data, pipe into it with `.run()`, as
[Pipelines and input](./pipelines.md) shows.

## A program that isn't there

If the program doesn't exist, `run()` itself throws `Deno.errors.NotFound`,
before any consumer runs. Keep the `run()` call inside the same `try` as the
`await`, and it is caught with everything else; see
[Errors](./errors.md#a-missing-program-or-file).

## Permissions

Running a command needs `--allow-run`, or `--allow-run=head,sort` to allow only
those programs. Passing `env` doesn't need `--allow-env`. See
[Install](../start/install.md#permissions).
