_This is a **pre-release**. The API is stabilizing. The documentation is under
construction. The project is usable._

# deno-proc

An easy way to run processes like a shell script in Deno.

## documentation

```bash
deno doc -q https://deno.land/x/proc/mod.ts
```

## Examples

- [Simple Examples for Input and Output Handlers](./runners/handlers/README.md)
- [Count Unique Words in _War and Peace_](./examples/warandpeace/README.md)


# Input and Output Types

Raw `stdin`, `stdout`, and `stderr` from a process are streamed byte data. This
is a simple definition, but it is not very useful. We need to be able to
interpret data differently in different circumstances.

Streamed byte data is the fastest, so if we are just piping bytes from one
process to another, we would use `BytesIterableOutput()` for `stdout` of process
#1 and `BytesIterableInput()` for `stdin` of process #2.

If you have a small amount of data (it can be kept in memory),
`proc.stringInput()` and `proc.stringOutput()` let you work with `string` data.
For text data that is too big to fit in memory, or if you just want to work with
real-time streamed text data, use `proc.stringIterableInput()` and
`proc.stringIterableOutput()`. There is some overhead associated with processing
streamed bytes into text lines, but this is how you will interact with process
input and output much of the time.

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
function gzip(text: string): Promise<Uint8Array> {
  const pg = group();
  try {
    /* I am using a string for input and a Uint8Array (bytes) for output. */
    const pr: Runner<string, Uint8Array> = runner(
      stringInput(),
      bytesOutput(),
    )(pg);

    return pr.run({
      cmd: ["gzip", "-c"],
    }, text);
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
| `EmptyInput()`              | There is no process input.                       |
| `StringInput()`             | Process input is a `string`.                     |
| `BytesInput()`              | Process input is a `Uint8Array`.                 |
| `ReaderInput()`<sup>*</sup> | Process input is a `Deno.Reader & Deno.Closer`.  |
| `StringIterableInput()`     | Process input is an `AsyncIterable<string>`.     |
| `BytesIterableInput()`      | Process input is an `AsyncIterable<Uint8Array>`. |

<sup>*</sup> - `ReaderInput` is a special input type that does not have a
corresponding output type. It is not useful for piping data from process to
process.

## Output Types

| Name                                               | Description                                                                            |
| :------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `StringOutput()`                                   | Process output is a `string`.                                                          |
| `BytesOutput()`                                    | Process output is a `Uint8Array`.                                                      |
| `StringIterableOutput()`                           | Process output is an `AsyncIterable<string>`.                                          |
| `BytesIterableOutput()`                            | Process output is an `AsyncIterable<Uint8Array>`.                                      |
| `StderrToStdoutStringIterableOutput()`<sup>*</sup> | `stdout` and `stderr` are converted to text lines (`string`) and multiplexed together. |

<sup>*</sup> - Special output type that mixes `stdout` and `stderr` together.
`stdout` must be text data.


# Key Concepts

## Asynchronous Iterables



## Prevent Resource Leakage

Processes are system resources, like file handles. This means they need special handling. We have to take special care to close each process, and we also have to close all the resources associated with each process - `stdin`, `stdout`, and `stderr`. Special care has to be given to process resources not to close them more than once. Also, depending on how a Deno process shuts down, it may leave behind orphan child processes in certain cases (this behavior is well documented but annoying nonetheless). 

In other words, it is complicated.

To address the problem of leakage, `proc` uses `group()` to group related process lifetimes. When you are done using a group of processes, you just close the group. This cleans up everything all at once.

If you forget to close a group, or if your Deno process exits while you have some processes open, the group takes care of cleaning things up in that case too. _Note that a group cannot be garbage-collected until it is explicitly closed._

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
