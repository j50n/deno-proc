# proc

A high-level way to run child processes that is easy, flexible, powerful, and
prevents resource leaks.

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

- [deno-asynciter](https://github.com/j50n/deno-asynciter) `map`, `filter`,
  `reduce`, and `collect` for `AsyncIterable<?>`

## Short-Form Run Functions

Start here. The short-form api makes the simple stuff simple. Here is a
breakdown of the pros and cons of short-form:

- The Good:
  - Minimal code - easy to write, easy to read.
  - Covers many common use cases.
- The Bad:
  - Not good for large datasets (output is stored in RAM).
  - Can't add custom `stderr` processing.
  - Can't customize error handling.
  - No output available until child process completes.

If you are processing large amounts of data, don't use short-form. Otherwise,
this might be exactly what you need.

The input for a `run*` function may be `undefined` (`void`) or any of the
following:

- `string`
- `Uint8Array`
- `string[]`
- `Uint8Array[]`
- `Iterable<string>`
- `Iterable<Uint8Array>`
- `AsyncIterable<string>`
- `AsyncIterable<Uint8Array>`
- `Deno.Reader & Deno.Closer`

The following short-form `run*` functions are available. There is a different
function for each supported output type.

| Name  | Output Type           | Description                                      |
| :---- | --------------------- | ------------------------------------------------ |
| run0  | `Promise<void>`       | `stdout` is redirected to the parent, unbuffered |
| runB  | `Promise<Uint8Array>` | all the bytes from `stdout`                      |
| runS  | `Promise<string>`     | `stdout` converted to text                       |
| runSa | `Promise<string[]>`   | `stdout` as lines of text                        |

> ℹ️ `run0` doesn't return anything, but it redirects `stdout` (and `stderr`) to
> the parent process in real time. This works great for side-effect jobs like
> builds, where the `stdout` is human-readable log data.

**An Example**

This is how we might compress and then uncompress some text using a shell
script:

```sh
echo "Hello, world." | gzip | gunzip
```

This is how the same thing might be accomplished in TypeScript using the
short-form api in `proc`.

```ts
async function gzip(text: string): Promise<Uint8Array> {
  return await proc.runB({ cmd: ["gzip"] }, text);
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  return await proc.runS({ cmd: ["gunzip"] }, bytes);
}

const compressedBytes = await gzip("Hello, world.");
const originalText = await gunzip(compressedBytes);

console.dir(compressedBytes);
console.log(originalText);

/*
 * Uint8Array(33) [
 *  31, 139,   8,   0,   0,   0,   0,   0,   0,
 *   3, 243,  72, 205, 201, 201, 215,  81,  40,
 * 207,  47, 202,  73, 209,   3,   0, 119, 219,
 *  89, 123,  13,   0,   0,   0
 * ]
 *
 * Hello, world.
 */
```

## The Runner API (Long-Form)

The `runner` api requires a bit more boilerplate, but it is a general solution.
It supports arbitrary input and output handlers, allowing you to choose whether
you want the data to be streamed or buffered, and what types of conversions you
want to be performed automatically. It allows control over `stderr` data and the
ability to customize error handling in different ways.

It also exposes process groups, allowing you to clean up your processes reliably
in more complex streaming scenarios. You'll need to use process groups and
streaming data when larger data sizes and performance are concerns.

### Input and Output Handlers

`proc` uses input and output handlers that let you choose both the types and
behaviors for your data. It also lets you customize `stderr` and error handling.
With just a little code for definition, you can work with bytes or text,
synchronous or asynchronous, buffered or unbuffered.

#### Input Types

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
| `bytesAsyncIterableInput()`           | Process input is an `AsyncIterable<Uint8Array>`.             |
| `bytesAsyncIterableUnbufferedInput()` | Process input is an `AsyncIterable<Uint8Array>`, unbuffered. |

<sup>*</sup> - `readerInput()` and `readerUnbufferedInput()` are special input
types that do not have corresponding output types.

#### Output Types

| Name                                               | Description                                                                            |
| :------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `stringOutput()`                                   | Process output is a `string`.                                                          |
| `stringArrayOutput()`                              | Process output is a `string[]`.                                                        |
| `bytesOutput()`                                    | Process output is a `Uint8Array`.                                                      |
| `stringIterableOutput()`                           | Process output is an `AsyncIterable<string>`.                                          |
| `stringIterableUnbufferedOutput()`                 | Process output is an `AsyncIterable<string>`, unbuffered.                              |
| `bytesAsyncIterableOutput()`                       | Process output is an `AsyncIterable<Uint8Array>`.                                      |
| `bytesAsyncIterableUnbufferedOutput()`             | Process output is an `AsyncIterable<Uint8Array>`, unbuffered.                          |
| `stderrToStdoutStringIterableOutput()`<sup>*</sup> | `stdout` and `stderr` are converted to text lines (`string`) and multiplexed together. |

<sup>*</sup> - Special output handler that mixes `stdout` and `stderr` together.
`stdout` must be text data. `stdout` is unbuffered to allow the text lines to be
multiplexed as accurately as possible.

> ℹ️ **You must fully consume `Iterable` outputs.** If you only partially
> consume `Iterable`s, process errors will not propagate properly. For correct
> behavior, we have to return all the data from the process streams before we
> can propagate an error.

### Running a Command

`proc` is easiest to use with a wildcard import.

```ts
import * as proc from "https://deno.land/x/proc@0.0.0/mod.ts";
```

First, create a template. The template is a static definition and _may be
reused._ The input and output handlers determine the data types used by your
runner.

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

> ⚠️ If you are working with `AsyncIterable` outputs, these must be _completely_
> processed before you close the associated `Group`.

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
process's output won't be fully read, and therefore the process cannot be
automatically shut down. This can also happen if you don't fully process
`AsyncIterable` output of a process. This can result in resource leakage. If
your program is short and does not start many processes, or if you are sure that
the way you are using processes is well behaved (either non-streaming output or
all output data is fully consumed), you can use the short form safely.

> ℹ️ `Deno.test` will detect process resource leakage. An easy approach is to
> test your child process code. If your tests detect a leak, use a local
> `Group`.

### Direct Control Over `stderr`

For most of the output handlers, the first argument is optional and allows you
to pass a function to process `stderr` yourself.

- The function is passed one argument - an `AsyncIterator<Uint8Array>` of
  `stderr` in `Uint8Array` form (unbuffered); use `toLines(...)` to convert into
  text lines
- You can optionally return an `unknown` (anything) from this function; this are
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
