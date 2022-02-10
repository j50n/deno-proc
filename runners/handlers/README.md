# Examples

## Easy

### Just Run a Command

If you just want to run a command, try `simpleRunner()`. It is a specialized,
one-off solution, but this use case comes up a lot. It works when `stdin` is
empty, and you don't really care about `stdout` and `stderr` (they are written
to `stdout` and `stderr` of the parent process).

In this example, I am wrapping the whole thing in a function so I can open and
close the `Group` locally.

`spd-say` is installed by default on Ubuntu.

```ts
async function say(text: string): Promise<void> {
  const pg = proc.group();
  try {
    await proc.simpleRunner(pg).run({
      cmd: [
        "spd-say",
        "-w",
        "-t",
        "female3",
        text,
      ],
    });
  } finally {
    pg.close();
  }
}

await say(
  "moo moo farms are the best cow farms ever. They say moo, " +
    "they don't pollute the earth, and they give milk. Visit " +
    "moo moo farms today for only twelve easy payments of seventeen " +
    "ninety five weekly!",
);
```

## Non-Streaming Handlers

### Bytes (`Uint8Array`)

Bytes can be used as input or output.

In this example, we pass some bytes to `gzip` to compress them and then pass
those bytes to `gunzip` to decompress.

```ts
const pg = proc.group();
try {
  const pr = proc.runner(proc.bytesInput(), proc.bytesOutput())(pg);

  const original = new Uint8Array([1, 2, 3, 4, 5]);

  const gzipped = await pr.run({ cmd: ["gzip"] }, original);
  console.dir(gzipped);
  const unzipped = await pr.run({ cmd: ["gunzip"] }, gzipped);

  assertEquals(unzipped, original);
} finally {
  pg.close();
}
```

### Text (`string`)

Text can be used as input or output.

This example shows how you can wrap/hide a call to a process in a function.
Since we are not dealing with `AsyncIterable` data, we can create and close the
`Group` immediately.

`cowsay` needs to be installed:

```sh
sudo apt install cowsay
```

It is a well known fact that people instinctively find things said by cows to be
more credible than things not said by cows. Feel free to steal this code.

```ts
const cowsay = async (text: string): Promise<string> => {
  const pg = proc.group();
  try {
    return await proc.runner(proc.stringInput(), proc.stringOutput())(pg)
      .run({ cmd: ["cowsay"] }, text);
  } finally {
    pg.close();
  }
};

const whatTheCowSaid = await cowsay("*proc* is pretty cool!");

console.log(whatTheCowSaid);

/*
 *  ________________________
 * < *proc* is pretty cool! >
 *  ------------------------
 *        \   ^__^
 *         \  (oo)\_______
 *            (__)\       )\/\
 *                ||----w |
 *                ||     ||
 */
```

### Text (`string[]`)

When it comes to cows, go **BIG** or go home. Also, this demonstrates using
`string[]` for input and output.

`figlet` is a utility that prints letters as ASCII art. For more features and
fonts, check out `toilet`.

`figlet` needs to be installed:

```sh
sudo apt install figlet
```

This cow is very loud.

```ts
const moo = await proc.runner(proc.emptyInput(), proc.stringArrayOutput())()
  .run({ cmd: ["figlet", "MOO!"] });

console.log(moo.join("\n"));

/*  __  __  ___   ___  _
 * |  \/  |/ _ \ / _ \| |
 * | |\/| | | | | | | | |
 * | |  | | |_| | |_| |_|
 * |_|  |_|\___/ \___/(_)
 */

const cowSaysMoo = await proc.runner(
  stringArrayInput(),
  stringArrayOutput(),
)().run({ cmd: ["cowsay", "-n"] }, moo);

console.log(cowSaysMoo.join("\n"));

/*
 *  ________________________
 * /  __  __  ___   ___  _  \
 * | |  \/  |/ _ \ / _ \| | |
 * | | |\/| | | | | | | | | |
 * | | |  | | |_| | |_| |_| |
 * | |_|  |_|\___/ \___/(_) |
 * \                        /
 *  ------------------------
 *         \   ^__^
 *          \  (oo)\_______
 *             (__)\       )\/\
 *                 ||----w |
 *                 ||     ||
 */
```

In all seriousness, this is a pretty nifty way to distinguish important error
messages from background noise in long log output.

The above script is the equivalent of typing in `figlet "MOO!" | cowsay -n` in
the terminal.

## Streaming Handlers

### Bytes (`Reader`) - Input Only

### Bytes (`AsyncIterable<Uint8Array>`)

### Text (`AsyncIterable<string>`)

## Unbuffered Handlers

### Text (`AsyncIterable<string>`) - Unbuffered

Unbuffered text can be used as input or output.

If you use buffered output, lines won't be processed until a buffer (usually
4,092 bytes) is completely full. For output that is meant to be read by a person
at the terminal, this can make the process look like it is hung. By using
unbuffered output, each line is printed as soon as it is ready - instant
feedback.

This example demonstrates unbuffered output. I am going to run `deno doc` and
decorate both `stderr` and `stdout` streams.

Note that you can define a custom `stderr` handler function in the
`runner(...)`, and `stderr` is always unbuffered - because it is often used for
real-time feedback at the console.

The program is getting a line at a time, as it is ready (no buffering), from
both streams - asynchronously. These lines are immediately written to console
with either a red timestamp or a blue timestamp to indicate the stream of
origin.

```ts
const pg = proc.group();
try {
  for await (
    const line of proc.runner(
      proc.emptyInput(),
      proc.stringIterableUnbufferedOutput(async (stderr) => {
        for await (const line of stderr) {
          console.error(
            `${red(`${new Date().getTime()}`)} -> ${stripColor(line)}`,
          );
        }
      }),
    )(pg).run({
      cmd: [
        "deno",
        "doc",
        "--reload",
        "https://deno.land/x/proc/mod.ts",
      ],
    })
  ) {
    console.log(
      `${blue(`${new Date().getTime()}`)} -> ${stripColor(line)}`,
    );
  }
} finally {
  pg.close();
}
```
