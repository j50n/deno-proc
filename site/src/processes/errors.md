# Errors

```typescript
{{#include ../../examples/processes/errors-exit-code.ts}}
```

```text
{{#include ../../examples/processes/errors-exit-code.out}}
```

A command that exits with a non-zero code throws
[`ExitCodeError`](https://jsr.io/@j50n/proc/doc/~/ExitCodeError) from the
consumer's `await`, after every line it wrote has been delivered: `partial`
printed first. Its `message` names the program and the code; `command` holds the
whole command line (left out of the message, since arguments can hold secrets),
and `code` the exit code. One `try` around the consumer catches the errors of
every command and every callback in the pipeline.

## What you see, and what to do

| What you see                                        | What it means                                           | Where to look                                                                     |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ExitCodeError`, and the code is expected           | `grep` found nothing (1), `diff` found a difference (1) | [Accepting expected exit codes](#accepting-expected-exit-codes)                   |
| `ExitCodeError: grep exited with code 1`, no reason | the reason went to stderr                               | [Putting stderr into the error](#putting-stderr-into-the-error)                   |
| `UpstreamError`, or an error with a `cause`         | an earlier command or callback failed                   | [Which error a pipeline throws](#which-error-a-pipeline-throws)                   |
| `SignalError`                                       | the command was killed                                  | [Killed by a signal](#killed-by-a-signal)                                         |
| `NotFound` from `run()` or `read()`                 | the program or file isn't there                         | [A missing program or file](#a-missing-program-or-file)                           |
| `NotCapable: Requires run access`                   | Deno's permissions                                      | [Install](../start/install.md#permissions)                                        |
| `RangeError: .first: the sequence is empty`         | `.first` on empty output                                | [Reading the output](./running.md#reading-the-output)                             |
| no error, the program just hangs                    | nothing reads a command's output                        | [Running a command](./running.md#waiting-for-a-command-you-dont-want-output-from) |

All three process errors extend
[`ProcessError`](https://jsr.io/@j50n/proc/doc/~/ProcessError), so
`error instanceof ProcessError` catches any of them. Narrow with `instanceof`
before using `code`, `signal`, or `command`.

## Killed by a signal

```typescript
{{#include ../../examples/processes/errors-signal.ts}}
```

```text
{{#include ../../examples/processes/errors-signal.out}}
```

A command killed by a signal throws
[`SignalError`](https://jsr.io/@j50n/proc/doc/~/SignalError), with the signal's
name in `signal`. `SIGKILL` usually means the out-of-memory killer or a
`kill -9`; `SIGTERM` means something asked it to stop. A command you stopped
early yourself (with `take`, `first`, or `break`) dies of `SIGPIPE`, but that
throws nothing.

## Which error a pipeline throws

```typescript
{{#include ../../examples/processes/errors-upstream.ts}}
```

```text
{{#include ../../examples/processes/errors-upstream.out}}
```

The consumer sees only the last command, so an earlier failure reaches it
through the chain, as the error's `cause`:

- **An earlier command fails and the last one succeeds**: the last command
  throws [`UpstreamError`](https://jsr.io/@j50n/proc/doc/~/UpstreamError), and
  `cause` is the earlier command's error. `UpstreamError.command` is the command
  that threw, not the one that failed; the `message` is copied from the cause.
- **Both fail**: the last command throws its own `ExitCodeError` (or
  `SignalError`), still with the earlier error as `cause`. This is common, since
  a command that gets cut-off or empty input often fails too: in the second
  case, `grep` exits 1 because it saw nothing to match.

In a longer pipeline the chain is longer, one link per command, in order from
the last command back to the first failure. Walk `cause` to find where it
started, as `chain()` does above.

## Putting stderr into the error

```typescript
{{#include ../../examples/processes/errors-stderr.ts}}
```

```text
{{#include ../../examples/processes/errors-stderr.out}}
```

Two options, passed before the command, work together:

- **`fnStderr`** receives the child's stderr as bytes (use `.lines` for text)
  and returns whatever you want to keep. With it, stderr no longer goes to the
  terminal. Read it to the end: a child that fills its stderr pipe (about 64 KB)
  blocks, and the program hangs.
- **`fnError`** decides what the process throws. It is called once, after the
  output has ended and the child has exited, with the error the process would
  throw (or `undefined`) and what `fnStderr` returned. Whatever it throws is
  what the consumer's `await` throws; set `cause` when you wrap the original. If
  it returns normally, nothing is thrown. It may be `async`.

Don't throw from `fnStderr` to fail the process: that replaces the process's own
error, and the exit code is lost. Return the data, and throw from `fnError`.
[`ErrorHandler`](https://jsr.io/@j50n/proc/doc/~/ErrorHandler) and
[`StderrHandler`](https://jsr.io/@j50n/proc/doc/~/StderrHandler) have the exact
rules.

## Accepting expected exit codes

```typescript
{{#include ../../examples/processes/errors-expected.ts}}
```

```text
{{#include ../../examples/processes/errors-expected.out}}
```

`grep` exits 1 when no line matches and 2 when something went wrong, such as a
missing file. An `fnError` that returns for code 1 and rethrows everything else
turns "no match" into an empty result and keeps real failures as errors. (The
missing file's message went to the terminal, from grep's stderr.) Other commands
with a meaningful code 1: `diff` (files differ), `cmp`, `test`.

If you only need the answer, not the output, ask the status instead: `grep -q`
prints nothing, so `.status` can be awaited without reading anything, and it
reports a failed exit rather than throwing it.

Catching the error afterward works too, but the consumer has thrown by then, so
any output it collected is lost. In a pipeline, put `fnError` on the command
that has the expected code (`.run({ fnError }, "grep", ...)`); the commands
after it then see no failure.

## Errors from your own callbacks

```typescript
{{#include ../../examples/processes/errors-callback.ts}}
```

```text
{{#include ../../examples/processes/errors-callback.out}}
```

An error thrown in a callback (`map`, `filter`, `forEach`, ...) stops the
pipeline and arrives at the consumer as it was thrown. If a `.run()` comes after
the callback, the error stops that command's input, and the command throws
`UpstreamError` with your error as its `cause`, as for a failed command
upstream. The same `try` catches both.

## A missing program or file

```typescript
{{#include ../../examples/processes/errors-not-found.ts}}
```

```text
{{#include ../../examples/processes/errors-not-found.out}}
```

Both throw `Deno.errors.NotFound`, at different times. `run()` throws it itself,
at the call, before any consumer runs; keep the call inside the `try`. A `cwd`
that doesn't exist throws it from `run()` too, with `No such cwd` in the
message. `read()` throws it from the consumer, when reading starts. Fed into a
command with `.run()`, a missing file becomes the `cause` of that command's
error
([Feeding a command from a file](./pipelines.md#feeding-a-command-from-a-file)).

## Stopping early skips the check

```typescript
{{#include ../../examples/processes/errors-early.ts}}
```

```text
{{#include ../../examples/processes/errors-early.out}}
```

A consumer that stops before the end (`first`, `take`, `find`, `some`, a
`break`) closes the command's output, and its exit code is never checked. If the
failure matters, read to the end. The same goes for a command cut short by one
after it, such as `head`; see [Stopping early](./pipelines.md#stopping-early).
