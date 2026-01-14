# Resource Management

Proper resource management ensures your applications don't leak memory or file handles when working with processes and streams.

## The Fundamental Rule

The most important principle in proc is simple: always consume process output. When you start a process, you must consume its output through methods like `.collect()`, `.forEach()`, or by iterating through the results:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

// ❌ Resource leak
const p = run("ls");
// Output never consumed!

// ✅ Output consumed
await run("ls").lines.collect();
```

## Understanding Resource Leaks

Unconsumed output keeps the process handle open, preventing proper cleanup. This happens because the process continues running and holding resources until its output stream is fully consumed. Even if you don't care about the actual output data, you still need to consume it to signal that the process can be cleaned up.

## Methods for Consuming Output

proc provides several ways to consume process output, each suited to different use cases. Use `.collect()` when you need all output as an array:

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await run("ls").lines.collect();
```

Use `.forEach()` when you want to process each item without collecting everything in memory:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls").lines.forEach(line => {
  console.log(line);
});
```

Use for-await loops when you need more control over the iteration process:

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const line of run("ls").lines) {
  console.log(line);
}
```

Use `.toStdout()` when you just want to display the output:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls").toStdout();
```

Aggregation methods like `.count()` and property access like `.first` also consume output:

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await run("ls").lines.count();
const first = await run("ls").lines.first;
```

## Checking Status

Consume output before checking status:

<!-- NOT TESTED: Illustrative example -->
```typescript
const p = run("command");
await p.lines.collect();  // Consume first
const status = await p.status;  // Then check
```

## Error Handling

Errors automatically clean up resources:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("false").lines.collect();
} catch (error) {
  // Resources cleaned up automatically
}
```

## Long-Running Processes

For processes that run indefinitely:

<!-- NOT TESTED: Illustrative example -->
```typescript
// This is fine - consuming output as it arrives
for await (const line of run("tail", "-f", "log").lines) {
  process(line);
}
```

## Best Practices for Resource Management

Following these principles will help you avoid resource leaks and build reliable applications:

Always consume output using methods like `collect()`, `forEach()`, or iteration. This is the most important rule for preventing resource leaks.

When you need to check process status, consume the output first, then check the status. The process must complete its output before status information is reliable.

Let errors propagate naturally through your pipelines. proc's error handling automatically cleans up resources when errors occur, so you don't need to manually manage cleanup in error cases.

For custom cleanup scenarios, use try-finally blocks, but remember that proc handles most cleanup automatically through its error propagation system.

## Next Steps

- [Error Handling](./error-handling.md) - Handle failures
- [Running Processes](./running-processes.md) - Process basics
