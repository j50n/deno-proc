# Files and standard streams

`read(path)` gives a file's bytes as an `Enumerable`, and `writeTo(path)` writes
bytes to a file. In between, the data streams a chunk at a time.

```typescript
{{#include ../../examples/iterables/read-write.ts}}
```

```text
{{#include ../../examples/iterables/read-write.out}}
```

`read()` opens the file when reading starts, not at the call, and closes it when
reading ends, including when the consumer stops early. A missing file throws
`Deno.errors.NotFound` from the consumer's `await`. `readLines(path)` is
shorthand for `read(path).lines`.

## Writing a file

`writeTo(path)` creates the file, or replaces what it held, and closes it when
the sequence ends. It writes items as `toStdout()` does: bytes as they are, and
each string as a line, with a `"\n"` added. If the source throws, including a
command in the pipeline that fails, the file is closed holding what was written
so far, and the error comes out of `writeTo`. The file is emptied before
anything is read, so what it held before is gone either way, and a pipeline that
reads the same file (`read(path)` ... `writeTo(path)`) finds it already empty,
as `cmd < f > f` does in a shell.

To replace a file only once everything has worked, or to rewrite one in place,
pass `{ atomic: true }`:

```typescript
{{#include ../../examples/iterables/rewrite.ts}}
```

```text
{{#include ../../examples/iterables/rewrite.out}}
```

With `atomic`, proc writes a new file beside the old one, flushes it to disk,
and renames it into place once everything is written. A failure leaves the old
file as it was, with nothing beside it, and so does a program that exits partway
under `main`. A symlink stays a symlink, and the file keeps its mode. Anything
reached through `/dev` or `/proc`, such as `/dev/stdout`, is written in place.
It needs read permission on the file and write permission on its directory, and
the result is a new file, so a hard link to the old one still shows the old
content.

To add to a file instead of replacing it, open it yourself and pass its
`writable`:

```typescript
{{#include ../../examples/iterables/append.ts}}
```

```text
{{#include ../../examples/iterables/append.out}}
```

`writeTo(stream)` takes any `WritableStream` and closes it at the end, which
closes the file too.

## stdout

```typescript
{{#include ../../examples/iterables/stdout.ts}}
```

```text
{{#include ../../examples/iterables/stdout.out}}
```

`toStdout()` writes each string with a `"\n"` added, and bytes as they are, and
leaves stdout open. Use it for a command's output too: `run("ls").toStdout()`.
When stdout's reader goes away before the program is done writing, as when its
output is piped into `head`, `toStdout()` stops as a consumer that stops early
does: it closes the source and resolves, without an error.

`writeTo(Deno.stdout.writable)` works, but closes stdout when it finishes unless
you pass `{ noclose: true }`. After that, every `console.log` in the program
throws `BadResource`.

## stdin

`Deno.stdin.readable` is a stream of bytes, so `enumerate()` wraps it like any
other source:

```typescript
{{#include ../../examples/iterables/stdin-errors.ts}}
```

```sh
deno run stdin-errors.ts < app.log
```

```text
{{#include ../../examples/iterables/stdin-demo.out}}
```

Reading stdin needs no permission. A child process started with `run()` gets no
stdin by default; to feed it, pipe into it with `.run()`
([Pipelines and input](../processes/pipelines.md)).

## Compressed files

`CompressionStream` and `DecompressionStream` take byte chunks, so the bytes
from `read()`, a command's output, or `toBytes` go straight in:

```typescript
{{#include ../../examples/iterables/gzip.ts}}
```

```text
{{#include ../../examples/iterables/gzip.out}}
```

The `gzip` and `gunzip` steps do the same, and also accept lines of text, which
they turn into bytes first. Data that isn't valid gzip throws `TypeError`.
`.run("gzip", "-dc")` works too, in a child process.

## Lines or bytes

`.lines` decodes UTF-8 and splits on `"\n"`, dropping a `"\r"` before it, so
CRLF files work. Invalid UTF-8 throws `TypeError`. Keep the bytes for anything
that isn't text: compressed data, images, or a copy that must be exact.
`toByteLines` splits bytes into lines without decoding them. For files with a
great many short lines, `.chunkedLines` gives the same lines an array at a time,
and is several times faster.

## Large files

A chain that streams from `read()` to `writeTo()` holds only a few chunks at a
time, whatever the size of the file: filtering a 1.2 GB log through gzip peaked
at 150 MB of process memory, no more than a 300 MB log took. Two things break
that: `collect()`, which keeps every item, and a single line so long that it
doesn't fit, since `.lines` holds a line until it ends. Count, reduce, or write
as you go instead of collecting.
