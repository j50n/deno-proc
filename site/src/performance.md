# Performance

A few notes on performance.

## Does Performance Matter?

For 90% of the code you write, the bottom line is that performance does not
matter. For example, if you have some code that reads configuration on startup
and dumps it into an object, that code might be complicated, but it won't matter
if it runs in 10 milliseconds or 100 nanoseconds. Write clear code first and
optimize once things are working. Follow this process, and you will quickly
figure out which things do and don't matter.

## The Cost of Iteration

We use iteration everywhere. Doing it wrong can kill your performance. Doing it
right can get you close to (single threaded) C performance. This is a quick
summary of what you can expect. To keep it short, I am just going to cover the
high points and not show my work.

The fastest code you can write in pure JavaScript looks like
[asm.js](https://en.wikipedia.org/wiki/Asm.js). If you stick to `for` loops that
count and index simple types or data object lookups in arrays or numbers in
typed-arrays (like `Uint8Array`), you can expect that code to run at or near
single-threaded C speed.

Expect `for...of` with iterables and generators to be about 10x slower. This
includes array methods like `map`, `filter`, and `reduce`. Anything that has to
call a function in a loop is going to have extra overhead.

Promise-driven asynchronous code is another 10x slower, or 100x slower than the
`asm.js`-style code. This affects code written using `proc`, particularly
`Enumerable`.

So does this mean you have to always use `asm.js` syntax? Not at all. `for...of`
syntax and array methods make for cleaner code, and asynchronous operations are
the whole reason we're here. Iteration performance is mostly about the inner
loops. If your inner loops are tight, a little less efficiency in the outer
loops won't matter much. Write clean code first. When things are working, look
for opportunities to make it faster. Often this will mean a little profiling and
rewriting a few routines in `asm.js` style. If you do it right, you should be
able to get very good performance along with readable code.

[Async Iterators: These Promises Are Killing My Performance!](https://medium.com/netscape/async-iterators-these-promises-are-killing-my-performance-4767df03d85b)
on Medium and supporting benchmarks in
[async-iteration](https://github.com/danvk/async-iteration) on Github.

[The Performance Overhead of JavaScript Promises and Async Await](https://madelinemiller.dev/blog/javascript-promise-overhead/)
shows a couple of examples that isolate the performance difference to overhead
due to promises.
