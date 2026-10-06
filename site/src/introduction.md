# proc

proc runs child processes from Deno the way a shell pipes them, with errors that
reach one `catch`. It also gives any async iterable the Array methods you
already know: `map`, `filter`, `reduce`, `take`, and concurrent versions of
`map`.

```typescript
{{#include ../examples/intro/taste.ts}}
```

```text
{{#include ../examples/intro/taste.out}}
```

Each `.run()` pipes the output of one command into the next. `.lines` turns
bytes into lines of text, and `collect()` gathers them into an array. If any of
the three commands fails, the `await` throws.

## What it is for

- **Scripts that drive other programs**: git, compilers, ffmpeg, cloud CLIs,
  anything you would otherwise chain in bash, with TypeScript's types and real
  error handling.
- **Streaming data**: logs, CSV exports, and compressed files, a line or a row
  at a time, in constant memory.
- **Long-running children**: programs that launch other programs and must give
  them time to shut down, including in containers.
- **Async iterables in general**: the same methods work on anything you can
  `for await` over, with or without processes.

## What you get

- [`run()`](./processes/running.md) to start a command, and `.run()` to pipe
  into the next one.
- [`enumerate()`](./iterables/enumerable.md) to wrap any iterable in the same
  methods.
- [`read()`, `writeTo()`, and `toStdout()`](./iterables/files.md) for files and
  standard streams.
- [`main()`](./processes/shutdown.md) to let child processes finish cleaning up
  before your program exits.
- [`WritableIterable`](./iterables/writable-iterable.md) to turn callbacks and
  events into an iterable.
- [Data transforms](./data/overview.md) between CSV, TSV, JSON lines, and a
  record format.

## When you don't need it

If you run one command and want all of its output at once,
`await new Deno.Command("git", { args: ["status"] }).output()` does that, and
you check `success` yourself. proc earns its place when you pipe commands
together, read output as it arrives, or want a failed command to throw.

## Next

[Install it and run a first script](./start/install.md), then read
[Key ideas](./start/key-ideas.md): eight short points that cover how every part
of proc behaves.
