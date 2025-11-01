# Frequently Asked Questions

## General

### What is proc?

proc is a Deno library for running child processes and working with async
iterables. It gives you Array-like methods (map, filter, reduce) for streaming
data, with error handling that actually makes sense.

### Why should I use proc instead of Deno.Command?

Deno.Command is low-level and requires manual stream handling. proc gives you:

- Automatic resource management
- Natural error propagation
- Array-like methods for data processing
- Process pipelines that feel like shell pipes
- Streaming by default

### Is proc production-ready?

Yes! proc is stable, actively maintained, and used in production. The API is
mature and unlikely to have breaking changes.

### Does proc work with Node.js?

No, proc is Deno-only. It uses Deno-specific APIs like `Deno.Command` and
requires Deno's permission system.

## Usage

### Why do I get "resource leak" errors?

You must consume process output. Unconsumed output keeps the process handle
open:

```typescript
// ❌ Resource leak
const p = run("ls");

// ✅ Consume output
await run("ls").lines.collect();
```

### Is `.lines` a method or property?

**Property.** Use `.lines` not `.lines()`:

```typescript
// ✅ Correct
run("ls").lines;

// ❌ Wrong
run("ls").lines();
```

Same for `.status`, `.first`, `.last`.

### How do I check exit code without throwing?

Consume output first, then check `.status`:

```typescript
const p = run("command");
await p.lines.collect(); // Consume first
const status = await p.status; // Then check

if (status.code !== 0) {
  console.error("Failed");
}
```

### Why doesn't `enumerate()` add indices?

`enumerate()` wraps an iterable. Use `.enum()` to add indices:

```typescript
const result = await enumerate(["a", "b", "c"])
  .enum() // This adds indices
  .map(([item, i]) => `${i}: ${item}`)
  .collect();
```

### How do I pipe processes together?

Use `.run()` method:

```typescript
await run("cat", "file.txt")
  .run("grep", "pattern")
  .run("wc", "-l")
  .lines.first;
```

### Can I use shell syntax like `ls -la`?

No, arguments must be separate:

```typescript
// ✅ Correct
run("ls", "-la");

// ❌ Wrong
run("ls -la");
```

## Error Handling

### Do I need try-catch at every step?

No! That's the whole point. Errors propagate through the pipeline:

```typescript
try {
  await run("cmd1")
    .run("cmd2")
    .run("cmd3")
    .lines.forEach(process);
} catch (error) {
  // All errors caught here
}
```

### What happens when a process fails?

By default, non-zero exit codes throw `ExitCodeError`. You can catch it:

```typescript
try {
  await run("false").lines.collect();
} catch (error) {
  if (error instanceof ExitCodeError) {
    console.error(`Exit code: ${error.code}`);
  }
}
```

### Can I customize error handling?

Yes, use `fnError` option. See
[Custom Error Handling](./advanced/custom-errors.md).

## Performance

### Is proc fast?

Yes! proc is streaming by default, which means:

- Constant memory usage, even for huge files
- Concurrent process execution
- Lazy evaluation (only runs when consumed)

### How do I process large files?

Stream them:

```typescript
// Processes 10GB file with constant memory
for await (const line of read("huge.txt").lines) {
  process(line);
}
```

### Can I process files in parallel?

Yes, use `concurrentMap`:

```typescript
await enumerate(files)
  .concurrentMap(async (file) => {
    return await processFile(file);
  }, { concurrency: 5 })
  .collect();
```

## Troubleshooting

### My process hangs

You probably didn't consume the output:

```typescript
// ❌ Hangs
const p = run("command");
await p.status; // Waiting for output to be consumed

// ✅ Works
const p = run("command");
await p.lines.collect(); // Consume first
await p.status;
```

### I get type errors

Check if you're using properties as methods:

```typescript
// ❌ Type error
run("ls").lines();

// ✅ Correct
run("ls").lines;
```

### DecompressionStream type error

Add a type cast:

```typescript
.transform(new DecompressionStream("gzip") as TransformStream<Uint8Array, Uint8Array>)
```

Or use `--no-check` flag.

### Permission denied errors

Grant the necessary permissions:

```bash
deno run --allow-run --allow-read your-script.ts
```

## Comparison

### proc vs Deno.Command

| Feature        | Deno.Command | proc      |
| -------------- | ------------ | --------- |
| Boilerplate    | High         | Low       |
| Error handling | Manual       | Automatic |
| Streaming      | Manual       | Built-in  |
| Pipelines      | Manual       | `.run()`  |
| Array methods  | No           | Yes       |

### proc vs shell scripts

| Feature        | Shell   | proc           |
| -------------- | ------- | -------------- |
| Type safety    | No      | Yes            |
| Error handling | Manual  | Automatic      |
| IDE support    | Limited | Full           |
| Debugging      | Hard    | Easy           |
| Portability    | Limited | Cross-platform |

## Getting Help

### Where can I find examples?

- [Quick Start](./getting-started/quick-start.md)
- [Recipes](./recipes/counting-words.md)
- [API Reference](./api/run.md)

### How do I report bugs?

[File an issue](https://github.com/j50n/deno-proc/issues) on GitHub.

### Is there a Discord/Slack?

Not currently. Use GitHub issues for questions and discussions.

## Contributing

### Can I contribute?

Yes! Contributions are welcome. See the repository for guidelines.

### How can I help?

- Report bugs
- Improve documentation
- Add examples
- Fix issues

## Miscellaneous

### Why "proc"?

Short for "process". Easy to type, easy to remember.

### Who maintains proc?

proc is maintained by [@j50n](https://github.com/j50n) and contributors.

### What's the license?

MIT License. Use it freely.

### Can I use proc in commercial projects?

Yes! MIT license allows commercial use.
