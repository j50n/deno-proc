# proc

An easy way to run processes like a shell script in Deno.

`proc` lets me write process-handling code in readable, idiomatic Typescript
using `async/await` and `AsyncIterator` promisy goodness.

## Documentation

```bash
deno doc --reload https://deno.land/x/proc/mod.ts 2> /dev/null
```

## Examples

- [Simple Examples for Input and Output Handlers](./runners/handlers/README.md)
- [Count Unique Words in _War and Peace_](./examples/warandpeace/README.md)

## Related Projects

- [deno-asynciter](https://github.com/j50n/deno-asynciter)

# Input and Output Types

Processes really just deal with one type of data - bytes, in streams. Many
programs will take this one step further and internally translate to and from
text data, processing this data one line at a time.

`proc` treats process data as either `Uint8Array` or `AsyncIterable<Uint8Array>`
for byte data, or `string` or `AsyncIterable<string>` (as lines of text) for
text. It defines a set of standard input and output handlers that provide both
type information and data handling behavior to the runner.

#### An Example

To get you started, here is a simple example where we pass a `string` to a
process and get back a `Uint8Array`. The group is hidden in the `gzip(...)`
function.

```ts
/**
 * Use `gzip` to compress some text.
 * @param text The text to compress.
 * @return The text compressed into bytes.
 */
async function gzip(text: string): Promise<Uint8Array> {
  const pg = group();
  try {
    /* I am using a string for input and a Uint8Array (bytes) for output. */
    const pr: Runner<string, Uint8Array> = runner(
      stringInput(),
      bytesOutput(),
    )(pg);

    return await pr.run({ cmd: ["gzip", "-c"] }, text);
  } finally {
    pg.close();
  }
}

console.dir(await gzip("Hello, world."));
/* prints an array of bytes to console. */
```

## Input Types

| Name                                  | Description                                                  |
| :------------------------------------ | :----------------------------------------------------------- |
| `emptyInput()`                        | There is no process input.                                   |
| `stringInput()`                       | Process input is a `string`.                                 |
| `stringArrayInput()`                  | Process input is a `string[]`.                               |
| `bytesInput()`                        | Process input is a `Uint8Array`.                             |
| `readerInput()`<sup>*</sup>           | Process input is a `Deno.Reader & Deno.Closer`.              |
| `readerUnbufferedInput()`<sup>*</sup> | Process input is a `Deno.Reader & Deno.Closer`, unbuffered.  |
| `stringIterableInput()`               | Process input is an `AsyncIterable<string>`.                 |
| `stringIterableUnbufferedInput()`     | Process input is an `AsyncIterable<string>`, unbuffered.     |
| `bytesIterableInput()`                | Process input is an `AsyncIterable<Uint8Array>`.             |
| `bytesIterableUnbufferedInput()`      | Process input is an `AsyncIterable<Uint8Array>`, unbuffered. |

<sup>*</sup> - `readerInput()` and `readerUnbufferedInput()` are special input
types that do not have corresponding output types.

## Output Types

| Name                                               | Description                                                                            |
| :------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `stringOutput()`                                   | Process output is a `string`.                                                          |
| `stringArrayOutput()`                              | Process output is a `string[]`.                                                        |
| `bytesOutput()`                                    | Process output is a `Uint8Array`.                                                      |
| `stringIterableOutput()`                           | Process output is an `AsyncIterable<string>`.                                          |
| `stringIterableUnbufferedOutput()`                 | Process output is an `AsyncIterable<string>`, unbuffered.                              |
| `bytesIterableOutput()`                            | Process output is an `AsyncIterable<Uint8Array>`.                                      |
| `bytesIterableUnbufferedOutput()`                  | Process output is an `AsyncIterable<Uint8Array>`, unbuffered.                          |
| `stderrToStdoutStringIterableOutput()`<sup>*</sup> | `stdout` and `stderr` are converted to text lines (`string`) and multiplexed together. |

<sup>*</sup> - Special output handler that mixes `stdout` and `stderr` together.
`stdout` must be text data. `stdout` is unbuffered to allow the text lines to be
multiplexed as accurately as possible.

> ℹ️ **You must fully consume `Iterable` outputs.** If you only partially
> consume `Iterable`s, process errors will not propagate properly. For correct
> behavior, we have to return all the data from the process streams before we
> can propagate an error.

## Running a Command

`proc` is easiest to use with a wildcard import.

```ts
import * as proc from "https://deno.land/x/proc@0.0.0/mod.ts";
```

First, create a template. The template is a static definition and may be reused.
The input and output handlers determine the data types used by your runner.

```ts
const template = proc.runner(proc.emptyInput(), proc.stringOutput());
```

Next, create a _runner_ by binding the template to a group.

```ts
const pg = proc.group();
const runner: proc.Runner<void, string> = template(pg);
```

Finally, use the runner to execute a command.

```ts
try {
  console.log(
    runner.run({cmd: ["ls", "-la"]});
  );
} finally {
  pg.close();
}
```

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

## Performance Considerations

In general, `Uint8Array`s are faster than `string`s. This is because text has to
be converted to and from `UTF-8`, and lines of text tend to be smaller than then
ideal byte buffer size (there is a bit of overhead for every line or buffer
passed).

Iterable (or streaming) data allows commands to run in parallel, streaming data
from one to the next as soon as it becomes available. Non-streaming data (bytes,
string, or arrays of these) has to be fully resolved before it can be passed to
the next process, so commands run this way run one at a time.

Buffered data is sometimes a _lot_ faster than unbuffered data, but it really
depends on how your processes behave. As a general rule, use the buffered
handlers if you want the best performance. If you need output from the process
as it is available, that is when you would normally use unbuffered data.

To sum it all up, when you have a lot of data, the fastest way to run processes
is to connect them together with `AsyncIterable<Uint8Array>`s or to pipe them
together using a `bash` script - though you give up some ability to capture
error conditions with the later. `AsyncIterable<Uint8Array>` is
iterable/streaming buffered byte data, so commands can run in parallel, chunk
size is optimal, and there is no overhead for text/line conversion.

`AsyncIterable<string>` is reasonably fast, and useful if you want to process
string data in the Deno process. This data has to be converted from lines of
text to bytes into and out of the process, so there is significant amount of
overhead. Iterating over lots of very small strings does not perform well.

If you don't have a lot of data to process, it doesn't really matter which form
you use.
