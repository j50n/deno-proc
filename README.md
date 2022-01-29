_This is a **pre-release**. The API is stabilizing. The documentation is under
construction. The project is usable._

# proc

An easy way to run processes like a shell script in Deno.

`proc` lets me write process-handling code in readable, idiomatic Typescript
using `async/await` and `AsyncIterator` promisy goodness.

My goal in writing `proc` was to put Deno process handling on par with `bash`.
Simple `bash` scripts are wonderful, but they tend to grow unwieldy over time as
things are added. I'd like to be able to replace some of my old `bash` scripts
with something more robust, and Deno is the first scripting language I've found
that feels like it could work for this.

**First**, there is Deno's "Secure by default." This is huge when I am writing
admin scripts, where if I make a mistake, I can wipe out a server. The ability
to define security boundaries from the command-line is a game changer to me.
**Second**, there is Deno's approach to package management, which means I can
just import what I want and use it without required project infrastructure. I
can just write a script and run it. **Third**, there is tight coupling with
Typescript, which means I get strongly typed dynamic programming. I want someone
to catch my mistakes, but I also want to code as fast as possible.

But there is still the nagging problem of the process API in Deno. It feels a
little bit like I am dropping down into a poorly abstracted C library. It is
hard to use processes _correctly_ in Deno with this API. I find that I often end
up leaking resources or - sometimes - leaving orphaned processes hanging around.
However, when I use the Deno process API correctly, it is very reliable, has
predictable behavior, and it is _fast_.

`proc` provides a reasonable solution to the leaky resource problem and - at the
same time - redefines the API to feel more like modern JavaScript. I hope you
find it useful and enjoyable!

## documentation

```bash
deno doc -q https://deno.land/x/proc/mod.ts
```

## Examples

- [Simple Examples for Input and Output Handlers](./runners/handlers/README.md)
- [Count Unique Words in _War and Peace_](./examples/warandpeace/README.md)

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

| Name                        | Description                                      |
| :-------------------------- | :----------------------------------------------- |
| `emptyInput()`              | There is no process input.                       |
| `stringInput()`             | Process input is a `string`.                     |
| `bytesInput()`              | Process input is a `Uint8Array`.                 |
| `readerInput()`<sup>*</sup> | Process input is a `Deno.Reader & Deno.Closer`.  |
| `stringIterableInput()`     | Process input is an `AsyncIterable<string>`.     |
| `bytesIterableInput()`      | Process input is an `AsyncIterable<Uint8Array>`. |

<sup>*</sup> - `ReaderInput` is a special input type that does not have a
corresponding output type. It is not useful for piping data from process to
process.

## Output Types

| Name                                               | Description                                                                            |
| :------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `stringOutput()`                                   | Process output is a `string`.                                                          |
| `bytesOutput()`                                    | Process output is a `Uint8Array`.                                                      |
| `stringIterableOutput()`                           | Process output is an `AsyncIterable<string>`.                                          |
| `bytesIterableOutput()`                            | Process output is an `AsyncIterable<Uint8Array>`.                                      |
| `stderrToStdoutStringIterableOutput()`<sup>*</sup> | `stdout` and `stderr` are converted to text lines (`string`) and multiplexed together. |

<sup>*</sup> - Special output type that mixes `stdout` and `stderr` together.
`stdout` must be text data.

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
