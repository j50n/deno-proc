# Pipelines and input

```typescript
{{#include ../../examples/processes/pipelines-chain.ts}}
```

```text
{{#include ../../examples/processes/pipelines-chain.out}}
```

`.run()` on a command's output starts another command with that output as its
stdin, as `|` does in a shell. Every command in the chain runs at the same time,
and the bytes pass from one to the next in chunks; nothing is collected in
between unless you collect it. If any command fails, the consumer at the end
throws; see [Errors](./errors.md#which-error-a-pipeline-throws).

## Feeding a command from an array

```typescript
{{#include ../../examples/processes/pipelines-array.ts}}
```

```text
{{#include ../../examples/processes/pipelines-array.out}}
```

`.run()` works on any [Enumerable](../iterables/enumerable.md), not only on a
command's output. `enumerate()` wraps an array, a `Set`, a generator, or any
other iterable or async iterable, and `.run()` writes its items to the command's
stdin.

## Feeding a command from a file

```typescript
{{#include ../../examples/processes/pipelines-file.ts}}
```

```text
{{#include ../../examples/processes/pipelines-file.out}}
```

[`read()`](../iterables/files.md) yields a file's bytes, and `.run()` sends them
to the command unchanged. It is the same as `grep -c ERROR < app.log`, without
an extra `cat` process. The file is opened when reading starts, which is at the
`.run()` call. If it is missing, the command sees empty input, and the consumer
throws with `Deno.errors.NotFound` as the `cause`: an `UpstreamError`, or the
command's own `ExitCodeError` if empty input makes it fail, as it does `grep -c`
(which prints `0` and exits 1).

## How items become stdin

```typescript
{{#include ../../examples/processes/pipelines-items.ts}}
```

```text
{{#include ../../examples/processes/pipelines-items.out}}
```

| Item           | Written as                           |
| -------------- | ------------------------------------ |
| `string`       | the string and a `"\n"`              |
| `string[]`     | each string as a line                |
| `Uint8Array`   | the bytes as they are, nothing added |
| `Uint8Array[]` | each array's bytes, nothing added    |

So lines from `.lines` go back in as lines, and bytes from a command or a file
go through untouched. For any other item type (numbers, objects), the return
type of `.run()` is `never` and the code doesn't type-check: turn the items into
strings with `.map()` first, as the array example does with numbers.

## Lots of lines

Each item written to a command is a write of its own, and each step pays for
every item it handles. With a few thousand lines that doesn't matter; with
millions it does. Work a chunk of lines at a time instead:

```typescript
{{#include ../../examples/processes/pipelines-chunked.ts}}
```

```text
{{#include ../../examples/processes/pipelines-chunked.out}}
```

`.chunkedLines` yields the same lines as `.lines`, in arrays, and `.run()`
writes each array in one go. On two million short lines, a filter between two
commands took 16 seconds a line at a time and 0.3 seconds a chunk at a time.

`run({ buffer: true }, ...)` is a smaller fix for a source you can't chunk: it
collects small items into writes of at least 16 KB, about twice as fast. The
child sees nothing until 16 KB has collected or the input ends, so leave it off
for a child that must answer each line as it arrives.

## Mixing commands and steps

```typescript
{{#include ../../examples/processes/pipelines-mixed.ts}}
```

```text
{{#include ../../examples/processes/pipelines-mixed.out}}
```

Any step can sit between two commands: `.lines` turns the bytes into text,
`.filter()` and `.map()` work on each line, and the next `.run()` writes the
strings back out as lines. Use a command where a tool already does the job well
(`sort` on data larger than memory, `grep` on a big file), and a TypeScript step
where the logic is easier to write and test in code.

## Stopping early

```typescript
{{#include ../../examples/processes/pipelines-early.ts}}
```

```text
{{#include ../../examples/processes/pipelines-early.out}}
```

There are two ways a pipeline stops before its first command runs out, and
neither is an error:

- **The consumer stops** (`take`, `first`, `find`, a `break` out of
  `for await`). proc closes the pipeline behind it, and the `await` returns at
  once. `seq` and `grep` die of SIGPIPE at their next write. Their exit codes
  are not checked.
- **A command stops reading**, like `head`. Writing to it ends quietly, and the
  command before it is closed the same way.

A command that goes quiet instead keeps running after the `await` has returned,
until it writes again, exits, or is stopped. That is what lets you start a
server and wait for its "ready" line. Deno doesn't exit while a child is still
running, though, so without `main()` the script ends only when the server does;
under `main()`, the server is stopped when the program ends.

When a pipeline is cut short, the commands before the cut may or may not have
finished, so don't rely on their failures being reported. A command whose output
proc read to the end has its exit code checked; one that was closed early
doesn't. With `head` in the middle, which of the two happens depends on timing:
`run("sh", "-c", "echo a; echo b; exit 3").run("head", "-n", "1")` throws an
`UpstreamError` for the exit 3 on some runs, and returns `["a"]` without one on
others.

## Pipelines run for their side effects

```typescript
{{#include ../../examples/processes/pipelines-side-effects.ts}}
```

```text
{{#include ../../examples/processes/pipelines-side-effects.out}}
```

A pipeline that writes a file ends in `.writeTo(path)`, which is its consumer;
it takes bytes, which is what a command produces. A command you run only for
what it does (`cp`, `mkdir`, `git commit`) still needs a consumer, and
`.forEach(() => {})` is the one to use: it reads and discards any output, and
throws if the command fails. `.toStdout()` is the other common ending, when the
output is for the user to see.

## `.run()` starts at once

Like `run()`, `.run()` starts its command when you call it, and it begins
reading the items before it into the command's stdin straight away, whether or
not anything reads the output yet. Callbacks in the steps before it (a `.map()`
that logs, say) run then too. The steps after it are lazy, as usual. Build a
pipeline only when you are about to consume it, and always consume it: an unread
pipeline can hang (see
[Waiting for a command](./running.md#waiting-for-a-command-you-dont-want-output-from)).

To write a child's stdin a piece at a time, as your program produces the data,
use [`Process`](https://jsr.io/@j50n/proc/doc/~/Process) and its `stdin`, or
feed `.run()` from a [`WritableIterable`](../iterables/writable-iterable.md).
