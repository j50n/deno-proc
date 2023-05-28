# Errors

## Resource Leak

[Ticket #31](https://github.com/j50n/deno-proc/issues/31)

This may be related to
[Aborting a CompressionStream/DecompressionStream leaks a resource #14212](https://github.com/denoland/deno/issues/14212).

I have tried several ways to inject the `ExitCodeError` of the process into the
stream, including using `flush` of `TransformStream`. I settled on converting
the stream to `AsyncIterableIterator`, throwing the error after the stream had
been fully processed, and then converting all that back to `ReadableStream` -
because that mechanism is conceptually straightforward and should just work.

The error:

```
 ERRORS 

Non-zero exit code => ./tests/exitcode-errors/errors-1.test.ts:4:6
error: Leaking resources:
  - A text decoder (rid 5) was created during the test, but not finished during the test. 
    Close the text decoder by calling `textDecoder.decode('')` or `await textDecoderStream.readable.cancel()`.
```

The error is being suppressed where it occurs by setting
`sanitizeResources: false` in the test definition:
