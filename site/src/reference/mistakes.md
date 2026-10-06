# Common mistakes

The traps that actually bite, by what you see: the symptom, why it happens, and
the fix. Error messages are what Deno prints; `deno check` errors appear in your
editor too.

## The program hangs

**Nothing reads a command's output.** A child's stdout is a pipe that holds
about 64 KB. A child that writes more waits until someone reads, so this
fragment never finishes:

```typescript
const p = run("seq", "1", "100000");
await p.status; // waits for an exit that never comes
```

Small output fits in the pipe, which is why the same code "works" in a test and
hangs on real data. Fix: end every command's pipeline with a consumer,
`await run(...).lines.collect()`, or `.forEach(() => {})` to throw the output
away. `.status` is for after, or alongside, reading. The same goes for
`fnStderr`: read stderr to the end, or a child that writes a lot to it blocks.

**It finished its work, but doesn't exit.** A command it stopped reading early
is still running, such as a server whose "ready" line `.first` returned, and
Deno doesn't exit while a child runs. Wrap the program in `main()`, which stops
the children on the way out, or stop that one yourself with `Deno.kill(p.pid)`.

**A `WritableIterable` is never closed.** The reader waits for more items after
the last one. Call `close()` when the data ends, and `close(error)` when it
fails.

## It throws

**`ExitCodeError: grep exited with code 1`.** grep exits 1 when nothing matches,
and proc treats every non-zero exit as a failure. So do `diff` (files differ),
`cmp`, and `test`. Fix: an `fnError` handler that lets code 1 through, as in
[Searching logs](../recipes/logs.md#letting-grep-do-the-searching), or catch
`ExitCodeError` and check `.code`.

**`RangeError: .first: the sequence is empty`.** `.first` on a sequence with no
items: a command that printed nothing and succeeded (one that failed throws its
`ExitCodeError` instead), or a filter that matched nothing. `.first` never
resolves to `undefined`. When the output may be empty, take an array of at most
one:

```typescript
{{#include ../../examples/reference/first-empty.ts}}
```

```text
{{#include ../../examples/reference/first-empty.out}}
```

**`NotFound: Failed to spawn 'ls -la': entity not found`.** The whole command
was passed as one string, so Deno looked for a program named `ls -la`. Pass each
argument separately: `run("ls", "-la")`. The same error, with a real name, means
the program isn't installed or isn't on `PATH`.

**`NotCapable: Requires run access to "grep", run again with the --allow-run
flag`.**
Deno's permissions. Grant what the script uses: `--allow-run=grep`,
`--allow-read=./logs`, `--allow-write=out.txt`.

**`TypeError: cache needs Deno KV`** from `cache()`. `cache` uses Deno KV, which
is unstable. Run with `--unstable-kv`, or add `"unstable": ["kv"]` to
`deno.json`.

**`BrokenPipe: Broken pipe (os error 32)`** when you pipe the script's output
into `head` or `less` and quit early, from a write of your own to `Deno.stdout`.
`toStdout()` and `writeTo(Deno.stdout.writable)` stop quietly instead, and
`console.log` ignores it. Use one of those, or catch it:
`if (!(error instanceof Deno.errors.BrokenPipe)) throw error;`.

**`SyntaxError: Unexpected end of JSON input`** from `jsonParse`. A blank line
is not JSON. Filter blank lines out before it, or use `fromJsonToRows()` from
`@j50n/proc/transforms`, which skips them.

**The error says `exited with code 1` and nothing else.** The command's own
explanation went to stderr, which is your terminal by default. To put it in the
error, capture it with `fnStderr` and rethrow from `fnError`; see
[Errors](../processes/errors.md).

## It doesn't type-check

**`This expression is not callable because it is a 'get' accessor. Did you
mean to use it without '()'?`**
(TS6234). `.lines`, `.chunkedLines`, `.first`, `.status`, and `.pid` are
properties: `await run("ls").lines.first`, not `.lines().first()`. Without type
checking, the same mistake fails at run time with
`TypeError: run(...).lines is not a function`.

**`This comparison appears to be unintentional because the types 'string[]'
and 'string' have no overlap.`**
(TS2367), on a row of parsed data. The parsers yield batches of rows, so without
`.flatten()` each item is an array of rows, not a row. Where the types don't
catch it, the counts are wrong:

```typescript
{{#include ../../examples/reference/flatten.ts}}
```

```text
{{#include ../../examples/reference/flatten.out}}
```

Add `.flatten()` after the parser. `toJson()` takes one value per item, so
flatten before it too: a batch left whole is written as one JSON array.

**`'error' is of type 'unknown'.`** (TS18046), on `error.code` in a `catch`.
Narrow first:
`if (error instanceof ExitCodeError) console.log(error.code); else throw error;`.

**`Module '".../mod.ts"' has no exported member 'fromCsvToRows'.`** The data
transforms are a separate entry point: import them from
`"@j50n/proc/transforms"`.

**`Property 'collect' does not exist on type 'never'.`** `.lines` and
`.chunkedLines` need bytes, and `.run()` needs strings or bytes; on other items
the type is `never`. Strings are lines already, so drop the `.lines`; before a
`.run()`, turn numbers or objects into strings with `.map(String)` or
`.transform(jsonStringify)`.

## Wrong results, no error

**The file came out empty.** `writeTo(path)` empties the file before anything is
read, so a pipeline that reads the same file finds nothing. Pass
`{ atomic: true }`, which writes a new file and renames it over the old one; see
[Files](../iterables/files.md#writing-a-file).

**The second pass finds nothing.** An `Enumerable` is used once; a second
`collect()` on it, or on another chain built from it, yields nothing and throws
nothing. Collect into an array first, or split with `tee()`. See
[Key ideas](../start/key-ideas.md#5-an-enumerable-is-used-once).

**A failed command didn't throw.** Stopping early (`.first`, `take`, `find`,
`break`) closes the pipeline without checking the exit code:

```typescript
{{#include ../../examples/reference/first-unchecked.ts}}
```

```text
{{#include ../../examples/reference/first-unchecked.out}}
```

Read the output to the end when the exit code matters. A command started with
`run()` and never consumed isn't checked either: the script waits for it to
exit, then ignores how.

**A result is a `Promise { <pending> }`.** Every consumer (`collect`, `forEach`,
`count`, `first`, ...) returns a promise; `await` it. An un-awaited `forEach`
may not have run when the next line does.

**Memory keeps growing with a `WritableIterable`.** `write()` returns at once,
without waiting for the reader; there is no backpressure:

```typescript
{{#include ../../examples/reference/no-backpressure.ts}}
```

```text
{{#include ../../examples/reference/no-backpressure.out}}
```

A producer that outruns its reader fills memory. When the source can wait (a
file, a socket, a paginated API), don't push into a queue; pull from it with an
async generator, or `enumerate()` a `ReadableStream`, so it is read only as fast
as you consume it.

## It's slow

**A pipeline of many short lines crawls**, especially one that feeds a command
with `.run()`: every step, and every write to the command, happens once per
line. Use `.chunkedLines` instead of `.lines`, and work on each array:
`.chunkedLines.map((lines) => lines.filter(...)).run("sort")`. On two million
lines that took a filter between two commands from 16 seconds to 0.3. See
[Lots of lines](../processes/pipelines.md#lots-of-lines).

## Children die without cleaning up

In a container, stopping it sends SIGTERM to Deno, Deno exits at once, and the
container's end kills the children before their cleanup runs: temporary files
are left behind, uploads cut off, locks held. On any host, an uncaught error
does the same: Deno kills its children as it exits. Wrap the program in
`main()`, which passes the signal on and waits for the children (30 seconds by
default) before exiting. See [Shutting down cleanly](../processes/shutdown.md).
