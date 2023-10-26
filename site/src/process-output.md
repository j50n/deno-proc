# Output

Process standard output, or _stdout_, is an `AsyncIterable<Uint8Array>`.

This can be efficiently piped to another process with `run`:

```typescript
// Count the words and print the result.
await run("echo", "Hello, world.").run("wc", "-w").toStdout();
```

You can't assume much about the data you are receiving from a process. It may be
written out line by line, or it may be in large or small chunks.

```typescript
await run("echo", "Hello, world.").forEach((it) => console.dir(it));

// Uint8Array(14) [
//    72, 101, 108, 108, 111,
//    44,  32, 119, 111, 114,
//   108, 100,  46,  10
// ]
```

That's not very useful. Let's try again, converting to text.

```typescript
await run("echo", "Hello,\nworld.").lines.forEach((it) => console.dir(it));

// Hello,
// world.
```

To convert the lines to an array, `collect` them.

```typescript
const data: string[] = await run("echo", "Hello,\nworld.").lines.collect();
console.dir(data);

// [ "Hello,", "world." ]
```

If you just want to dump the output from the child process to stdout, there is
an easy way to do that.

```typescript
await run("echo", "Hello, world.").toStdout();

// Hello, world.
```
