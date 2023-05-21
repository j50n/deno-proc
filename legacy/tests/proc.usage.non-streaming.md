_Development Notes_

# Proc Usage with Non-Streaming Input and Output

This is a test that lets me get some early reps on the new API for the simple
case, which is non-streaming. Passing strings and byte-arrays to and from
processes.

With non-streaming input and output, I can hide the use of `Group` because
everything starts in memory and ends in memory.

In this case, I am wrapping `gzip` in a couple of functions to allow compression
from string to bytes, and decompression back to string.

I like the readability. There is just enough formalism that everything is
defined, but - aside from `Group` boilerplate - nothing extra.

```ts
async function gzip(text: string): Promise<Uint8Array> {
  const pg = group();
  try {
    return await runner(stringInput(), bytesOutput())(pg).run({
      cmd: ["gzip", "-c"],
    }, text);
  } finally {
    pg.close();
  }
}
```
