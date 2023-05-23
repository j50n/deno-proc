# proc

Blue sky. Let's make something wonderful!

## Topics

- Buffered versus non-buffered. Is this a thing now?
    - looks like chunks are not buffered, so need to look into that.
- Iterables. 
    - Convert from iterable to ReadableStream. 
    - ReadableStream is just an AsyncIterable.
    - Using AsyncIterables rather than TransformStreams.
        - Error propagation? Is it possible to do cleanly? Abort the writablestream maybe?
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

