# Performance

A few notes on performance.

## Avoid String Conversions

Avoid unnecessary string conversions.

Conversions from bytes to JavaScript strings and back are expensive. String data
is typically represented at UTF-8, which is one to six bytes per unicode code
point. JavaScript strings are represented in memory as UTF-16, or 16 bits or 32
bits (2 bytes or 4 bytes) to represent one unicode code point. Conversion logic
is non-trivial.

Whenever possible, `proc` allows passing raw byte arrays between processes so
conversion is optional.

Do this:

```typescript
const lineCount = parseInt(
  await read("warandpeace.txt").run("wc", "-l").lines.first,
  10,
);
```

Not this. This will work, as the lines will automatically be converted back to
UTF-8 before being passed to `wc -l` (which counts lines). However, this makes
the V8 engine do a lot of extra work and slows down execution.

```typescript
const lineCount = parseInt(
  await read("warandpeace.txt").lines.run("wc", "-l").lines.first,
  10,
);
```

## Asynchronous Code

Asynchronous code is fast, but it's not as fast as code using for-loops, arrays,
and simple types.

Given what it is doing, V8 does a stellar job of optimizing asynchronous code.
Most of the time, you shouldn't have to worry about performance of code written
this way. However, `async`/`await` isn't (quite) a zero-cost abstraction.

When performance is a concern and data size allows, it may be more performant to
move operations to in-memory arrays. Code that does lots of small operations or
works on very small data can usually be reworked into non-asynchronous code for
better performance.

Keep in mind that code written using promises, `AsyncIterable`, and
`async`/`await` is going to be very well optimized and run quickly. A _lot_ of
work went into making promise code run as quickly as possible in V8. Write clean
code first and measure your performance before you start trying to hand-optimize
things.

[Async Iterators: These Promises Are Killing My Performance!](https://medium.com/netscape/async-iterators-these-promises-are-killing-my-performance-4767df03d85b)
on Medium and supporting benchmarks in
[async-iteration](https://github.com/danvk/async-iteration) on Github.

[The Performance Overhead of JavaScript Promises and Async Await](https://madelinemiller.dev/blog/javascript-promise-overhead/)
shows a couple of examples that isolate the performance difference to overhead
due to promises.
