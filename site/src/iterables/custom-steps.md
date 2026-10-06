# Writing your own steps

When no method does what you need, write the step as an async generator function
and pass it to `transform()`. It gets the whole sequence, so it can keep state
between items and yield as many or as few as it likes.

```typescript
{{#include ../../examples/iterables/generator-step.ts}}
```

```text
{{#include ../../examples/iterables/generator-step.out}}
```

A step is any function from an `AsyncIterable<T>` to an `AsyncIterable<U>`; the
type
[`TransformerFunction<T, U>`](https://jsr.io/@j50n/proc/doc/~/TransformerFunction)
names it. A generator function is the step itself: pass `dedupe`, not
`dedupe()`. For a step that takes settings, write a function that returns the
step, and call that: `batches(2)`. The built-in steps come in both kinds
(`toBytes` and `gzip` are passed as they are; `buffer(size)` and the data
formats' `fromCsvToRows()` are called); the list is in
[Enumerable and its methods](./enumerable.md#steps-to-pass-to-transform).

## More items than came in

`yield*` hands on every item of an iterable:

```typescript
{{#include ../../examples/iterables/more-items.ts}}
```

```text
{{#include ../../examples/iterables/more-items.out}}
```

For a step that only changes or drops single items, `map`, `filter`, and
`flatMap` are shorter. Reach for a generator when the step needs memory of
earlier items, needs to see the end (to flush a last batch, or emit a total), or
needs to stop early.

## Stopping early

```typescript
{{#include ../../examples/iterables/stop-early.ts}}
```

```text
{{#include ../../examples/iterables/stop-early.out}}
```

Returning from the generator before its input ends closes the source, as `take`
does: the command's output is closed, and its exit code isn't checked. Code in a
`finally` block of the generator runs when the step stops for any reason,
including a consumer that stops early downstream.

## Errors

An error thrown in a step comes out of the consumer's `await`, unchanged. An
error from upstream (a failed command, a callback that threw) is thrown inside
the step, from its `for await` loop, so a step can catch it, to add context or
to recover:

```typescript
{{#include ../../examples/iterables/step-errors.ts}}
```

```text
{{#include ../../examples/iterables/step-errors.out}}
```

Rethrow with the original as `cause` rather than swallowing it. A step that
catches an error and simply returns hides the failure: the pipeline ends as if
the input had run out.

## With a TransformStream

`transform()` also takes a `TransformStream`, or any `{ writable, readable }`
pair, such as `CompressionStream`:

```typescript
{{#include ../../examples/iterables/stream-step.ts}}
```

```text
{{#include ../../examples/iterables/stream-step.out}}
```

A stream works once. Used a second time, it yields nothing or throws, and the
source goes unread, so create a new one for each use, as `upper()` does. An
error from upstream of the stream reaches the consumer unchanged, and so does
one thrown in its `transform()`. A generator is usually simpler to write; use a
stream when you already have one.
