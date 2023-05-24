# proc

Blue sky. Let's make something wonderful!

> **Pardon our mess!** The deprecation of `Deno.run` is both a blessing and a
> curse. `Deno.Command` is a _great_ improvement ... and it breaks pretty much
> everything. I was going to have to redo the old library as it had gone in some
> wrong directions.
>
> - The old API will remain available, unchanged, until Deno 2.0 is released.
> - When Deno 2.0 is release, the `mod.ts` for the old library will be
  > relocated. Imports will have to change, but it will still work with Deno
  > 1.0.
> - The old API will **not** be upgraded to work with `Deno.Command`. Once
  > `Deno.run` is removed, the old API will no longer function.
>
> See [Legacy Documentation](./legacy/README.md) for the old documentation.

I am working on a new version of this library that makes common usage patterns
in `Deno.Command` much easier.

For now, this is a work in progress. Refer to
[count-words.test](./tests/examples/count-words.test.md) for a good usage
example if you want to try this out.

## Topics

- Buffered versus non-buffered. Is this a thing now?
  - looks like chunks are not buffered, so need to look into that.
- Iterables.
  - Convert from iterable to ReadableStream.
  - ReadableStream is just an AsyncIterable.
  - Using AsyncIterables rather than TransformStreams.
    - Error propagation? Is it possible to do cleanly? Abort the writablestream
      maybe?
- Conversions.
  - to text
  - to lines
  - from text back to bytes
  - TransformStream examples and explanation.
- Tee and merge streams.
- Error handling and stream error propagation.
  `cat warandpeace.txt | head -n 50 | wc -l`
- Stream performance. Why it probably makes sense not to convert to
  `AsyncIterable`.
- Bashisms:
  - ??? one thing at a time as it comes up

## Questions

- How do I combine TransformStreams? A. Use functions.
