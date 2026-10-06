# Architecture

proc is a few small layers over two things Deno already has: async iterables and
`Deno.Command`. This page follows a pipeline down through them.

## The modules

| File                       | What it does                                                             |
| -------------------------- | ------------------------------------------------------------------------ |
| `src/enumerable.ts`        | `Enumerable` (every step and consumer), `ProcessEnumerable`, `enumerate` |
| `src/run.ts`               | `run()` and the `Cmd` type                                               |
| `src/process.ts`           | `Process`, the error classes, and the option and handler types           |
| `src/concurrent.ts`        | the two concurrent maps                                                  |
| `src/transformers.ts`      | the functions for `.transform()`: lines, bytes, gzip, JSON, `buffer`     |
| `src/writable-iterable.ts` | `WritableIterable` and the `Writable` interface                          |
| `src/shutdown.ts`          | `main()`, `terminateAll()`, and the set of running children              |
| `src/utility.ts`           | `read`, `readLines`, `range`, `sleep`, and small byte helpers            |
| `src/cache.ts`             | `cache()` over Deno KV, and the time constants                           |
| `src/helpers.ts`           | internal: argument parsing for `run()`, `handled()`                      |
| `src/transforms/`          | the data formats (`@j50n/proc/transforms`)                               |
| `src/wasm/`                | the loader and wrapper for the WebAssembly module                        |

`mod.ts` re-exports the modules in `src/` but `concurrent.ts` and `helpers.ts`,
which are internal, and `transforms/` and `wasm/`.

## Enumerable

`Enumerable<T>` wraps one `AsyncIterable<T>`. Each step (`map`, `filter`,
`take`, ...) is an async generator over the one before, returned in a new
`Enumerable`, so nothing runs until a consumer pulls. Errors need no special
handling: an exception thrown anywhere in the chain unwinds through the
generators to the consumer's `await`. Stopping early works the same way in
reverse: when a consumer stops, `return()` is called down the chain, and each
generator's `finally` closes what it holds.

Because the wrapped iterable is read once, so is the `Enumerable`. A second pass
gets an exhausted generator, which yields nothing.

`lines`, `run`, `writeBytesTo`, and the rest of the methods that only make sense
for some item types use conditional types (`Lines<T>`, `Run<S, T>`, ...) that
resolve to `never` for the wrong items, so the mistake fails to type-check
instead of failing at run time.

## A command

`run(...cmd)` parses its arguments (an options object may come first) and builds
a `Process`, with stdin `"null"`, stdout `"piped"`, and stderr `"inherit"`, or
`"piped"` when there is an `fnStderr`. The `Process` constructor calls
`Deno.Command(...).spawn()` at once, which is why a missing program throws from
`run()` itself, and registers the child with `shutdown.ts`. `run()` returns a
`ProcessEnumerable`, an `Enumerable` over `Process.stdout`.

`Process.stdout` is where failures become errors. It is an async generator that
yields the child's stdout chunks; after the last one, in a `finally`, it awaits
the exit status and the `fnStderr` promise, and then throws `SignalError` or
`ExitCodeError` for a failed exit, or `UpstreamError` if the child succeeded but
its input failed. If there is an `fnError`, the error goes to it instead, and
whatever it throws is what the consumer sees. Since all of this happens after
the last chunk, the consumer has every line before the error arrives. If the
consumer stops early, the generator is closed before the check, so no exit code
is examined.

## A pipeline

`.run(...cmd)` on an `Enumerable` builds a `Process` with stdin `"piped"` and
calls `writeToStdin(this)` straight away. That starts a loop that reads the
upstream `Enumerable` and writes each item to the child's stdin (through
`toBytes`, and `buffer` when `buffer: true`), without waiting for anyone to read
the output. So `.run()` is the one step that is not lazy.

When the upstream iterable throws, `writeToStdin` keeps the error as the
process's "pass error" and closes stdin. The child sees end of input, finishes,
and exits; `Process.stdout` then attaches the pass error as `cause` to its own
`ExitCodeError`, or throws an `UpstreamError` around it if the child exited 0.
That is how an error from the first command in a chain reaches the `catch` after
the last. A child that exits before reading all its input (`head -1`) makes the
next write fail with `BrokenPipe`; the loop ignores that error and stops reading
upstream, which closes it like any early stop.

## Concurrency

`concurrentMap` and `concurrentUnorderedMap` in `src/concurrent.ts` keep up to
`concurrency` promises from the mapping function in flight. The ordered one
yields from the front of its buffer, so a slow item holds back the rest; the
unordered one yields whichever settles first. Neither cancels calls already
started when the consumer stops or an error is thrown.

## Shutdown

`shutdown.ts` keeps a set of the children proc started, adding each in the
`Process` constructor and removing it when its status resolves. `main()`
installs listeners for SIGTERM, SIGINT, and SIGHUP (only SIGINT on Windows) and
for uncaught errors and unhandled rejections, then runs the program. However it
ends, the first ending wins: it signals every child in the set, waits up to
`timeoutMs` for them to exit, and calls `Deno.exit` with the code for that
ending. A second signal exits at once. `terminateAll()` is the signal-and-wait
half on its own. An `unload` listener sends SIGTERM to the children if the
program exits some other way, though it can't wait for them.

## Small pieces

- **`WritableIterable`** is an unbounded queue of promises: `write()` resolves
  the promise at the tail and adds a new one, and the iterator awaits them in
  order. It has no backpressure by design; it is for push-style sources that
  can't wait anyway. A process's `stdin` is one.
- **`helpers.handled(promise)`** attaches an empty `catch` to a promise that
  will be awaited later, so that a rejection before then isn't reported as
  unhandled. It is used wherever proc holds a promise while doing something
  else: `map` and `forEach` read the next item before awaiting the call on the
  last one, the concurrent maps hold many, and the `fnStderr` reader runs beside
  stdout.
- **`cache()`** stores `{ timestamp, value }` under the key in Deno KV's default
  database and checks the age on read.

## Data formats and WebAssembly

`src/transforms/` holds one file per format. The TSV, record, JSON-lines, and
LazyRow-binary parsers are TypeScript: `common.ts` splits the input on a
separator and groups lines into batches of about 128 KiB. CSV parsing, CSV
writing, and the TSV and record writers go through WebAssembly:
`src/wasm/flatdata-processor.ts` wraps the module, compiled once and
instantiated per transform, and works on rows in the LazyRow binary layout.

The module is built from `odin/src/` (Odin) into `wasm/flatdata.wasm`.
`tools/embed-wasm.ts` writes it, base64-encoded, into
`src/wasm/flatdata-wasm.ts`, because a package loaded from JSR has `https:`
module URLs and can't read a `.wasm` file beside it. `src/wasm/odin-runtime.ts`
supplies the imports Odin-compiled modules expect. The `flatdata` CLI in
`scripts/flatdata/` uses the same processor. See
[Building and releasing](./build-process.md) for the build, and the
[CSV parser specification](./csv-parser.md) for what the parser accepts.
