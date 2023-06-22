# Input and Output

Use `ReadableStream` and `WritableStream` from Deno APIs for input and output.

## Write to Stdout

Write to `stdout` a line at a time using `console.log`.

```typescript
await range({ to: 3 })
  .forEach((line) => console.log(line.toString()));
```

Write to `stdout` as a `WritableStream`. In the case of `stdout`, we don't close
it. To use `writeTo`, the data has to be in `Uint8Array` form. This also adds
output buffering to consolidate the write operations into larger chunks.

`Deno.stdout.writable` is a `WritableStream`.

```typescript
await range({ to: 10000 })
  .map((n) => n.toString())
  .transform(toBytes)
  .transform(buffer(8192))
  .writeTo(Deno.stdout.writable, { noclose: true });
```

Run a child process and stream output directly to `stdout`. This has no
conversion to lines and no additional buffering, so it will also work with ANSI
escape codes and positioning characters.

```typescript
await run("ls", "-la")
  .writeTo(Deno.stdout.writable, { noclose: true });
```

## Read from Stdin

Read `stdin`. Uncompress it and convert to lines (`string`). Remove all the
blank lines. Count them. Print the count.

`Deno.stdin.readable` is a `ReadableStream` which is an
`AsyncIterable<Uint8Array>`.

```typescript
console.log(
  await enumerate(Deno.stdin.readable)
    .transform(gunzip)
    .lines
    .filter((line) => line.trim().length === 0)
    .count(),
);
```
