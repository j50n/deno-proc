# Stream Conversions

Deno has methods to convert between `AsyncIterable` and streams as well as
readers and writers at
[https://deno.land/std/streams/mod.ts](https://deno.land/std/streams/mod.ts).
These libraries have moved around quite a bit so they can be difficult to search
for.

_Note that error propagation through streams in Deno is somewhere between tricky
and broken._ Be sure to test your code thoroughly for error handling if you need
to convert to and use Deno's streams.

## `AsyncIterable` to `Stream`

To convert from an `AsyncIterable` (or `Enumerable`) to a `ReadableStream`, use
the
[readableStreamFromIterable](https://deno.land/std/streams/mod.ts?s=readableStreamFromIterable)
function.

## `Stream` to `AsyncIterable`

A `ReadableStream` is an `AsyncIterable`. Avoid the use of `.pipeThrough()` and
`.pipeTo()`. Use `for await` or `enumerate()` instead.

## **Conversion of TransformStream to Transformer**
