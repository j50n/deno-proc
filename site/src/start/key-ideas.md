# Key ideas

Eight points cover how every part of proc behaves. The rest of the book is
detail.

## 1. A pipeline is a source, some steps, and a consumer

```typescript
{{#include ../../examples/key-ideas/pipeline.ts}}
```

```text
{{#include ../../examples/key-ideas/pipeline.out}}
```

A **source** produces items: `run()` (a command's output), `read()` (a file), or
`enumerate()` (any iterable or async iterable). Each **step** (`lines`, `map`,
`filter`, `take`, `run`, `transform`, ...) returns a new `Enumerable` and does
nothing yet. The **consumer** (`collect`, `forEach`, `count`, `reduce`, `first`,
`writeTo`, `toStdout`, or a `for await` loop) pulls items through one at a time
and returns a promise. Await it.

## 2. A command starts when you call `run()`, and you must read its output

`run()` starts the child process at once; only the steps after it wait. The
child's stdout is a pipe with a small buffer (typically 64 KB). A child that
writes more than that waits until someone reads, so if your code never consumes
the output, the child never finishes and neither does your program. Always end a
command's pipeline with a consumer. If you don't want the output, consume it
anyway: `await run("make").lines.forEach(() => {})`.

stderr is not piped by default: it goes straight to your terminal.

## 3. Errors come out of the consumer's `await`

```typescript
{{#include ../../examples/key-ideas/errors-at-end.ts}}
```

```text
{{#include ../../examples/key-ideas/errors-at-end.out}}
```

A command that exits with a non-zero code throws `ExitCodeError` once you have
read all of its output, so the lines it wrote before failing still reach you.
The same `catch` also gets an error from any command earlier in a pipeline (as
an `UpstreamError` whose `cause` is the original), and anything your own
callbacks throw. One `try` around the consumer covers the whole pipeline. See
[Errors](../processes/errors.md).

## 4. Stopping early is fine

```typescript
{{#include ../../examples/key-ideas/stop-early.ts}}
```

```text
{{#include ../../examples/key-ideas/stop-early.out}}
```

When a consumer stops before the end (`take`, `first`, `find`, a `break` out of
`for await`), proc closes the pipeline behind it without an error. A command
that is still writing stops at its next write, and the `await` returns once it
has exited.

## 5. An `Enumerable` is used once

```typescript
{{#include ../../examples/key-ideas/single-use.ts}}
```

```text
{{#include ../../examples/key-ideas/single-use.out}}
```

Consuming an `Enumerable` uses it up, and a second pass finds nothing, without
an error. To go over data twice, collect it into an array first, or split the
stream with `tee()`.

## 6. Some members are properties

`.lines`, `.chunkedLines`, `.first`, `.status`, and `.pid` take no parentheses.
`.first` and `.status` are promises: `await p.status`, not `p.status()`.
Everything else is a method.

## 7. Parsers yield batches

```typescript
{{#include ../../examples/key-ideas/batches.ts}}
```

```text
{{#include ../../examples/key-ideas/batches.out}}
```

For speed, the parsers in `@j50n/proc/transforms` yield arrays of rows rather
than one row at a time. Add `.flatten()` before a step that works on one row.
The writers (`toCsv()`, `toTsv()`, ...) take either.

## 8. Wrap a long-running program in `main()`

```typescript
{{#include ../../examples/key-ideas/main.ts}}
```

When Deno is told to stop (Ctrl-C, or a container's SIGTERM), it exits at once,
and in a container the children are killed with it before they can clean up.
`main()` runs your program, and however it ends (it returns, it throws, or a
signal arrives), it asks every child to stop and waits for them, up to 30
seconds, before exiting. See [Shutting down cleanly](../processes/shutdown.md).
