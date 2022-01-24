_This the new API. It is still under development, under-tested, and buggy. The
API should be considered unstable._

# deno-proc

Running child processes should not be difficult. `proc` attempts to bring the
ease of `bash` scripting to Deno.

## documentation

```bash
deno doc -q https://deno.land/x/proc/mod.ts
```

# Key Concepts

## Leaking Resources

One of the challenges of working with processes in Deno is that you _must_
manually close every process resource - readers, writers, and the process
itself. Additionally, it is an error (with real consequences) to attempt to try
to close an already closed resource again. This can make working with even one
process somewhat awkward and tricky. With more than one process, it is confusing
and maybe a bit dangerous.

To help with this problem, `proc` introduces `ProcGroup`. A `ProcGroup` is a
`Deno.Closer`, and when you close it, you also close all resources associated
with the group.

`proc` requires that all processes it manages are associated with a `ProcGroup`.

```ts
const pg = procgroup();
try {
  console.log(
    await proc(EmptyInput(), StringOutput()).run(pg, {
      cmd: ["ls", "-la"],
    }),
  );
} finally {
  pg.close();
}
```

# Input and Output Types

Raw `stdin`, `stdout`, and `stderr` from a process are streamed byte data. This
is a simple definition, but it is not very useful. We need to be able to
interpret data differently in different circumstances.

Streamed byte data is the fastest, so if we are just piping bytes from one
process to another, we would use `BytesIterableOutput()` for `stdout` of process
#1 and `BytesIterableInput()` for `stdin` of process #2.

A lot of processing with processes involves string data. If you have a small
amount of data (it can be kept in memory), `StringInput()` and `StringOutput()`
let you work with `string` data. For text data that is too big to fit in memory,
or if you just want to work with real-time streamed text data, use
`StringIterableInput()` and `StringIterableOutput()`.

This example shows how `proc(...)` is used to generate a process definition. In
this case, I am going to pass in a `string` and get back a `Uint8Array`. `gzip`
is just getting a stream of bytes in both cases of course. Our definition is
translating for us.

```ts
/**
 * Use `gzip` to compress some text.
 * @param text The text to compress.
 * @return The text compressed into bytes.
 */
async function gzip(text: string): Promise<Uint8Array> {
  const pg = procgroup();
  try {
    /* I am using a string for input and a Uint8Array (bytes) for output. */
    const processDef: Proc<string, Uint8Array> = proc(
      StringInput(),
      BytesOutput(),
    );

    return await processDef.run(pg, {
      cmd: ["gzip", "-c"],
    }, text);
  } finally {
    pg.close();
  }
}

const pg = procgroup();
try {
  console.dir(await gzip("Hello, world."));
} finally {
  pg.close();
}
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

# Examples

## Run an Inline Bash Script

Starting with something simple yet useful, this is an example of running a
`bash` script using `proc`.

```ts
const pg = procgroup();
try {
  console.log(
    await proc(EmptyInput(), StringOutput()).run(pg, {
      cmd: [
        "/bin/bash",
        "--login",
        "-c",
        "echo 'Hello, Deno.'",
      ],
    }),
  );
} finally {
  pg.close();
}
```
