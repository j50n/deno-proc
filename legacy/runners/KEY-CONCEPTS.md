# Key Concepts

## Process Basics

Processes accept input through `stdin` and output data to `stdout`. These two
streams may be interpreted either as byte data or as text data, depending on the
use case.

There is another output stream called `stderr`. This is typically used for
logging and/or details about any errors that occur. `stderr` is always
interpreted as text. In most cases it just gets dumped to the `stderr` stream of
the parent process, but you have some control over how it is handled.

In some cases (Java processes come to mind), `stdout` and `stderr` are roughly
interchangable, with logging and error messages written to either output stream
in a sloppy manner. The `stderrToStdoutStringIterableOutput()` output handler
gives you an option for handling both streams together.

Processes return a numeric exit code when they exit. `0` means success, and any
other number means something went wrong. `proc` deals with error conditions on
process exit by throwing a `ProcessExitError`. You should never have to poll for
process status.

## Asynchronous Iterables

JavaScript introduced the `AsyncIterable` as part of the 2015 spec. This is an
asynchronous protocol, so it works well with the streamed data to and from a
process.

`proc` heavily relies on `AsyncIterable`.

See
[JavaScript Iteration Protocols (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols).

Streaming code executes differently than you may be used to. Errors work
differently too, being passed from iterable to iterable rather than failing
directly. Bugs in this kind of code can be difficult to figure out. To help with
this, `proc` can chain its errors. You can turn this feature on by calling a
function:

```ts
proc.enableChaining(true);
```

This can produce some really long error chains that you may not want to work
with in production, so this feature is turned off by default.

## Preventing Resource Leakage

Processes are system resources, like file handles. This means they need special
handling. We have to take special care to close each process, and we also have
to close all the resources associated with each process - `stdin`, `stdout`, and
`stderr`. Also, depending on how a Deno process shuts down, it may leave behind
orphan child processes in certain cases (this behavior is well documented but
annoying nonetheless) if measures aren't taken specifically to prevent this.

In other words, working with Deno's process API is more complicated than it
looks.

To address the problem of leakage, `proc` uses `group()` to group related
process lifetimes. When you are done using a group of processes, you just close
the group. This cleans up everything all at once. It's easy. It's foolproof.

If you forget to close a group, or if your Deno process exits while you have
some processes open, the group takes care of cleaning things up in that case
too. _Note that a group cannot be garbage-collected until it is explicitly
closed._

```ts
const pr = runner(emptyInput(), stringOutput());
const pg = group();
try {
  console.log(
    await pr(pg).run({
      cmd: ["ls", "-la"],
    }),
  );
} finally {
  pg.close();
}
```

If you don't specify a group when running a command, the global group will be
used. This is fine if the processes you run are all "well behaved" and/or if you
are doing a short run of just a few processes.

## Performance Considerations

In general, `Uint8Array`s are faster than `string`s. This is because processes
really just deal with bytes, so text in JavaScript has to be converted to and
from `UTF-8` both coming and going. Also, lines of text tend to be smaller than
the ideal byte buffer size (there is a bit of overhead for every line or buffer
passed).

Iterable (or streaming) data allows commands to run in parallel, streaming data
from one to the next as soon as it becomes available. Non-streaming data (bytes,
string, or arrays of these) has to be fully resolved before it can be passed to
the next process, so commands run this way run one at a time - serially.

Buffered data is sometimes a _lot_ faster than unbuffered data, but it really
depends. As a general rule, use the buffered handlers if you want the best
performance. If you need output from the process as soon as it is available,
that is when you would normally use unbuffered data.

To sum it all up, when you have a lot of data, the fastest way to run processes
is to connect them together with buffered `AsyncIterable<Uint8Array>`s or to
pipe them together using a `bash` script - though you give up some ability to
capture error conditions with the later. `AsyncIterable<Uint8Array>` (default
buffered) is iterable/streaming buffered byte data, so commands can run in
parallel, chunk size is optimal, and there is no overhead for text/line
conversion.

`AsyncIterable<string>` is reasonably fast, and you'll use it if you want to
process string data in the Deno process. This data has to be converted from
lines of text to bytes into and out of the process, so there is significant
amount of overhead. Iterating over lots of very small strings does not perform
well.

If you don't have a lot of data to process, it doesn't really matter which form
you use.
