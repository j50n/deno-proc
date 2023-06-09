# proc

Maybe the easiest way to run child processes in Deno ever.

## The Old API

The documentation for the legacy API is available at
[Legacy Documentation](./legacy/README.md).

TO use the old API:

- https://deno.land/x/proc/mod.ts
- https://deno.land/x/proc/mod1.ts

When the new API is ready, there will be a 1.0 release and `mod.ts` will be
switched to the new API. The old API will continue to be maintained at `mod1.ts`
for some time after the Deno 2.0 release.

The old API was built on `Deno.run()` which is now deprecated and scheduled to
be removed in Deno 2.0. There were other reasons to start over from scratch, but
this was the primary reason everything changed.

## The New API

The documentation is available at
[https://j50n.github.io/deno-proc/](https://j50n.github.io/deno-proc/).

To use the new API:

- http://deno.land/x/proc/mod3.ts

The new API is stabilizing and the code is working. New tests are being added
regularly. Obviously the documentation is a work in progress. Refactors are
likely before the 1.0.0 release.

The new API is a nice way to work with `AsyncIterable` in general. It also
blends in a really nice way to work with child processes where things like
errors _just work_ and you don't have to worry about resource leaks.
