# From callbacks to iterables

`WritableIterable` is a queue: push-style code (callbacks, event handlers,
timers) writes items into it, and a `for await` loop or an `Enumerable` chain
reads them out.

```typescript
{{#include ../../examples/iterables/timer.ts}}
```

```text
{{#include ../../examples/iterables/timer.out}}
```

It has three operations:

- `write(item)` adds an item to the queue and returns at once.
- `close()` ends the data. The reader gets every item written, then its loop
  ends.
- `close(error)` ends the data with an error. The reader gets every item written
  before it, then the error is thrown from its loop.

Only the first `close` counts; later ones are ignored. `isClosed` tells you
whether it has happened.

## Bridging events

```typescript
{{#include ../../examples/iterables/events.ts}}
```

```text
{{#include ../../examples/iterables/events.out}}
```

The handlers run before anything reads, so the items wait in the queue until the
loop starts. The error event closes the queue with an error, which the reader
sees after "hello" and "world"; the message after that is refused.

## Feeding a command

A `WritableIterable` can be a command's stdin. `.run()` starts the command at
once and passes items to it as they are written:

```typescript
{{#include ../../examples/iterables/to-process.ts}}
```

```text
{{#include ../../examples/iterables/to-process.out}}
```

`Enumerable.writeTo()` also accepts a `WritableIterable`, to copy a sequence
into one.

## Traps

**Nothing closes it for you.** Until `close()` is called, the reader waits for
the next item. If something else keeps the program alive (a timer, a server), it
waits forever; if nothing does, Deno stops with
`error: Top-level await promise never resolved`. Make sure every way the source
can end, including failure, leads to a `close`.

**There is no backpressure.** `write()` doesn't wait for the reader; its promise
resolves right away. When the writer is faster than the reader, or nothing reads
at all, the queue grows without limit and every item stays in memory. That suits
events, which can't be paused anyway. If the producer can wait, and the data is
large, make it a generator instead and let the reader pull.

**`write()` after `close()` rejects.** In an event handler, nobody awaits that
promise, so the rejection is unhandled and ends the program. Catch it, as the
example does, or check `isClosed` first.

**One reader, once.** Read it with a single loop or chain. Two readers at once
lose items, and one of them throws `TypeError`. Reading it again after it has
ended throws `TypeError` too.

The constructor takes an `onclose` callback, called on the first `close()`,
which waits for it: a place to remove event listeners or clear a timer. See the
[API reference](https://jsr.io/@j50n/proc/doc/~/WritableIterable).
