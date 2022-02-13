# proc

An easy way to run processes like a shell script - in Deno.

`proc` lets you write process-handling code in readable, idiomatic Typescript
using `async/await` and `AsyncIterator` promisy goodness. It provides a variety
of powerful and flexible input and output handlers, making using processes
comfortable and intuitive. And `proc` handles closing and shutting down
process-related resources in a sane manner - because you have enough to worry
about, right?

For more ramblings, see [Key Concepts](./runners/KEY-CONCEPTS.md).

## Documentation

```bash
deno doc --reload https://deno.land/x/proc/mod.ts 2> /dev/null
```

## Examples

- [Simple Examples for Input and Output Handlers](./runners/handlers/README.md)
- [Playing Sounds with `aplay`](./examples/sounds/README.md)
- [Count the Unique Words in _War and Peace_](./examples/warandpeace/README.md)
- [Use `PushIterable` to Implement Workers](./examples/pushiterable/README.md)

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

To get you started, here is a simple example where we pass a text `string` to a
process and get back a `Uint8Array` - text compressed to bytes using `gzip`.

```ts
/**
 * Use `gzip` to compress some text.
 * @param text The text to compress.
 * @return The text compressed into bytes.
 */
async function gzip(text: string): Promise<Uint8Array> {
  return await runner(stringInput(), bytesOutput())().run({
    cmd: ["gzip", "-c"],
  }, text);
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
  console.log(runner.run({ cmd: ["ls", "-la"] }));
} finally {
  pg.close();
}
```

### A Simpler Alternative - The Global Group

It is not strictly necessary to create and close a local `Group`. If you don't
specify a group, `proc` will use the global `Group` that exists for the lifetime
of the Deno process.

```ts
const runner = proc.runner(proc.emptyInput(), proc.stringOutput())();
console.log(runner.run({ cmd: ["ls", "-la"] }));
```

Notice the empty parentheses at the end of the first line in the second example.
This is using the implicit global `Group` (which you don't need to close
manually).

Most of the time, `proc` can automatically clean up processes. In some cases
where the output of one process feeds into the input of another, the first
process won't be fully processed and therefore cannot be automatically shut
down. This can also happen if you don't fully process `AsyncIterable` output of
a process. This will result in resource leakage. If your program is short and
does not start many processes, or if you are sure that the way you are using
processes is well behaved (either non-streaming output or all output data is
fully consumed), you can use the short form safely.

### Direct Control Over `stderr`

For most of the output handlers, the first argument is optional and allows you
to pass a function to process `stderr` yourself.

- The function is passed one argument - an `AsyncIterator<string>` of `stderr`
  lines in text form (unbuffered)
- You can optionally return a `string[]` of lines from this function; these are
  attached to the `ProcessExitError` if the process returns a non-zero error
  code
- You can throw an error from this function; this allows you to scrape `stderr`
  and do special error handling

The examples use this feature a couple of times.

See [stderr-support.ts](./runners/stderr-support.ts) for some functions that
provide non-default `stderr` bahaviors. You can use these directly, and they
also serve as good working examples.

### Overriding the Default Exit-Code Error Handling Behavior

For most of the output handlers, the second argument is optional and allows you
to redefine the way that `proc` raises errors based on the process exit code.

This doesn't come up very often, but occasionally you may not want to treat all
non-zero exit codes as an error. You also may want to throw your own error
rather than the standard `ProcessExitError`.

The default error handling definition is defined in
[error-support.ts](./runners/error-support.ts). Refer to this code if you want
to create a custom error handler.
