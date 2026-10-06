# Doing work concurrently

`concurrentMap` and `concurrentUnorderedMap` are `map` with several calls
running at once. The first gives results in input order; the second gives them
as they finish.

```typescript
{{#include ../../examples/iterables/ordered.ts}}
```

```text
{{#include ../../examples/iterables/ordered.out}}
```

## Which one to use

`concurrentMap` keeps the order, and pays for it: a slow item holds back the
results after it, and while it does, no new call starts. With one slow item in
every few, fewer calls run than you asked for. Use it when the output must line
up with the input.

`concurrentUnorderedMap` starts a new call as soon as any finishes, so every
slot stays busy. Use it when order doesn't matter, or carry the input along in
the result (`return { file, size }`) so you can tell which result is which.

Plain `map` makes one call at a time, even when the callback is async.

## How many at once

The `concurrency` option sets how many calls may be running. It defaults to
`navigator.hardwareConcurrency`, the number of CPUs. A fraction rounds up, and a
value below 1 throws an `Error` when reading starts, not at the call.

Calls overlap only while they wait: on a timer, a file, the network, or a child
process. The JavaScript inside the callbacks still runs one piece at a time, so
CPU-heavy work in a callback gets no faster. Put that work in a child process,
where it does run in parallel. The CPU count suits commands that keep one CPU
busy each; work that mostly waits on the network can go higher.

## Running several commands at once

```typescript
{{#include ../../examples/iterables/compress.ts}}
```

```text
{{#include ../../examples/iterables/compress.out}}
```

Each call must consume its command's output, here with `collect()`, even when
there is none to speak of. That is how the call waits for the command to finish,
and how a failed command throws: as an `ExitCodeError` from the callback, which
then surfaces as below. A command that writes to stdout and is never read
blocks, and its call never finishes (see [Key ideas](../start/key-ideas.md)).

## When a call fails

```typescript
{{#include ../../examples/iterables/errors.ts}}
```

```text
{{#include ../../examples/iterables/errors.out}}
```

An error thrown by the callback comes out of the consumer, so one `try` around
the `await` catches it. `concurrentMap` throws it when the failed item's turn
comes, after the results before it; `concurrentUnorderedMap` throws it in the
order it happened.

Nothing cancels the calls already running: "c" finished after the error was
caught. Their results are dropped, but whatever they do (write a file, start a
command) still happens. A consumer that stops early, with `take` or `break`,
leaves running calls going in the same way.

To let every job finish and see each outcome, catch inside the callback and
return the outcome as the result:

```typescript
{{#include ../../examples/iterables/all-results.ts}}
```

```text
{{#include ../../examples/iterables/all-results.out}}
```

For a larger worked example, see
[Running jobs in parallel](../recipes/parallel-jobs.md).
