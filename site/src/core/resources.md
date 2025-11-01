# Resource Management

Avoid leaks and manage resources properly.

## The Golden Rule

**Always consume process output.**

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

// ❌ Resource leak
const p = run("ls");
// Output never consumed!

// ✅ Output consumed
await run("ls").lines.collect();
```

## Why This Matters

Unconsumed output keeps the process handle open, preventing cleanup.

## Ways to Consume Output

### collect()

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await run("ls").lines.collect();
```

### forEach()

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls").lines.forEach(line => {
  console.log(line);
});
```

### for-await

<!-- NOT TESTED: Illustrative example -->
```typescript
for await (const line of run("ls").lines) {
  console.log(line);
}
```

### toStdout()

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("ls").toStdout();
```

### Aggregations

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

## Best Practices

1. **Always consume output** - Use collect(), forEach(), or iterate
2. **Check status after consuming** - Don't check status first
3. **Let errors propagate** - They clean up automatically
4. **Use try-finally for cleanup** - If you need custom cleanup

## Next Steps

- [Error Handling](./error-handling.md) - Handle failures
- [Running Processes](./running-processes.md) - Process basics
