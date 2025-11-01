# Running Processes

Running a child process with proc is as simple as it gets.

## Basic Usage

<!-- TESTED: tests/mdbook_examples.test.ts - "running-processes: capture output" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

// Run a command
await run("ls", "-la").lines.collect();
```

That's it. No boilerplate, no configuration, just run it.

## Command and Arguments

The first parameter is the command, the rest are arguments:

<!-- NOT TESTED: Illustrative example -->
```typescript
run("command", "arg1", "arg2", "arg3")
```

**Important:** Arguments are separate parameters, not a single string:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ✅ Correct
run("ls", "-la", "/home")

// ❌ Wrong - this won't work
run("ls -la /home")
```

## Capturing Output

### As an Array

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await run("ls", "-la").lines.collect();
// lines is string[]
```

### Line by Line

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const line of run("ls", "-la").lines) {
  console.log(line);
}
```

### First or Last Line

<!-- TESTED: tests/mdbook_examples.test.ts - "running-processes: first line" -->
```typescript
const first = await run("ls").lines.first;
const last = await run("ls").lines.last;
```

### As Raw Bytes

<!-- NOT TESTED: Illustrative example -->
```typescript
const bytes = await run("cat", "file.bin").collect();
// bytes is Uint8Array[]
```

## Printing to Console

Send output directly to stdout:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls", "-la").toStdout();
```

This is perfect for commands where you just want to see the output.

## Building Commands Dynamically

Sometimes you need to build a command from variables:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { type Cmd, run } from "jsr:@j50n/proc@{{gitv}}";

const cmd: Cmd = ["ls"];

if (showAll) {
  cmd.push("-la");
}

if (directory) {
  cmd.push(directory);
}

await run(...cmd).toStdout();
```

The `Cmd` type is an array where the first element is the command (string or URL) and the rest are string arguments. Using the `Cmd` type ensures type safety when building commands dynamically.

## Process Options

Customize process behavior with options:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run(
  {
    cwd: "/tmp",           // Working directory
    env: { FOO: "bar" },   // Environment variables
  },
  "command",
  "arg1"
).lines.collect();
```

### Working Directory

<!-- NOT TESTED: Illustrative example -->
```typescript
await run(
  { cwd: "/var/log" },
  "ls"
).toStdout();
```

### Environment Variables

<!-- NOT TESTED: Illustrative example -->
```typescript
await run(
  { env: { PATH: "/custom/path" } },
  "command"
).lines.collect();
```

## Checking Exit Status

Get the exit status without throwing:

<!-- NOT TESTED: Illustrative example -->
```typescript
const p = run("command");
await p.lines.collect();  // Consume output first
const status = await p.status;

console.log(`Exit code: ${status.code}`);
console.log(`Success: ${status.success}`);
```

**Remember:** Always consume output before checking status, or you'll leak resources.

## Process ID

Get the process ID:

<!-- NOT TESTED: Illustrative example -->
```typescript
const p = run("sleep", "10");
console.log(`PID: ${p.pid}`);
await p.lines.collect();
```

## Running with URLs

You can use URLs for the command:

<!-- NOT TESTED: Illustrative example -->
```typescript
const scriptUrl = new URL("./script.sh", import.meta.url);
await run(scriptUrl).toStdout();
```

## Common Patterns

### Silent Execution

Run a command and ignore output:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("command").lines.forEach(() => {});
```

### Capture and Print

Capture output while also printing it:

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines: string[] = [];
await run("command").lines.forEach(line => {
  console.log(line);
  lines.push(line);
});
```

### Conditional Execution

<!-- NOT TESTED: Illustrative example -->
```typescript
if (needsProcessing) {
  await run("process-data").toStdout();
}
```

## Error Handling

By default, non-zero exit codes throw `ExitCodeError`:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("false").lines.collect();
} catch (error) {
  console.error(`Command failed: ${error.code}`);
}
```

See [Error Handling](./error-handling.md) for complete details.

## Performance Tips

### Stream Instead of Collect

Process data as it arrives rather than loading everything into memory:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Loads everything into memory
const lines = await run("cat", "huge-file.txt").lines.collect();
for (const line of lines) {
  process(line);
}

// ✅ Processes one line at a time
for await (const line of run("cat", "huge-file.txt").lines) {
  process(line);
}
```

### Pipe Instead of Collect Intermediate Results

Chain processes instead of collecting intermediate results:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Collects intermediate results
const lines1 = await run("cat", "file.txt").lines.collect();
const input = lines1.join("\n");
const lines2 = await run("grep", "pattern").lines.collect();

// ✅ Streams through
await run("cat", "file.txt")
  .run("grep", "pattern")
  .toStdout();
```

### Use take() to Stop Early

Stop processing once you have what you need:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Stops after finding 10 matches
const first10 = await run("grep", "ERROR", "huge.log")
  .lines
  .take(10)
  .collect();
```

### Filter Before Expensive Operations

Reduce the amount of data flowing through expensive operations:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ✅ Filter first (fast), then transform (expensive)
const result = await run("cat", "data.txt")
  .lines
  .filter(line => line.length > 0)  // Fast filter
  .map(expensiveTransform)          // Only runs on filtered data
  .collect();
```

For more performance optimization strategies, see [Concurrent Processing](../advanced/concurrent.md) and [Streaming Large Files](../advanced/streaming.md).

## Next Steps

- [Process Pipelines](./pipelines.md) - Chain commands together
- [Working with Output](./output.md) - Transform and process output
- [Error Handling](./error-handling.md) - Handle failures gracefully
