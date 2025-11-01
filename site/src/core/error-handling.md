# Error Handling

Error handling is proc's primary design goal. **Errors flow through pipelines naturally, just like data.**

## The Problem

Traditional stream error handling requires managing errors at multiple points:

<!-- NOT TESTED: Illustrative example -->
```typescript
// With Deno.Command - manual error handling at each step
const cmd1 = new Deno.Command("cat", { args: ["file.txt"] });
const proc1 = cmd1.spawn();
const output1 = await proc1.output();
if (!output1.success) {
  throw new Error(`cat failed: ${output1.code}`);
}

const cmd2 = new Deno.Command("grep", { 
  args: ["pattern"],
  stdin: "piped"
});
const proc2 = cmd2.spawn();
// ... manually pipe output1 to proc2 stdin ...
const output2 = await proc2.output();
if (!output2.success) {
  throw new Error(`grep failed: ${output2.code}`);
}
```

With Node.js streams, you need error handlers on each stream:

<!-- NOT TESTED: Illustrative example -->
```typescript
stream1.on('error', handleError);
stream2.on('error', handleError);
stream3.on('error', handleError);
```

## The proc Solution

Errors flow through pipelines like data. Handle them once, at the end:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("cat", "file.txt")
    .run("grep", "pattern")
    .run("wc", "-l")
    .lines
    .map(transform)
    .filter(predicate)
    .forEach(process);
} catch (error) {
  // All errors caught here:
  // - Process exit codes
  // - Transform errors
  // - Filter errors
  // - Your own errors
  console.error(`Pipeline failed: ${error.message}`);
}
```

**One try-catch. No edge cases. No separate error channels.**

## How It Works

When something goes wrong anywhere in the pipeline:

1. The error is captured
2. Downstream operations are skipped
3. The error propagates to your catch block

It's functional programming—errors are just another type of data flowing through.

## Error Types

proc throws specific error types so you can handle them differently:

### ExitCodeError

Thrown when a process exits with a non-zero code:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { ExitCodeError } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("false").lines.collect();
} catch (error) {
  if (error instanceof ExitCodeError) {
    console.error(`Process failed with code ${error.code}`);
    console.error(`Command: ${error.command.join(" ")}`);
  }
}
```

### SignalError

Thrown when a process is killed by a signal:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { SignalError } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("sleep", "1000").lines.collect();
  // Kill it with Ctrl+C
} catch (error) {
  if (error instanceof SignalError) {
    console.error(`Process killed by signal: ${error.signal}`);
  }
}
```

### UpstreamError

Thrown when an error comes from upstream in a pipeline:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { UpstreamError } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("cat", "missing.txt")  // This fails
    .run("grep", "pattern")         // This gets UpstreamError
    .lines.collect();
} catch (error) {
  if (error instanceof UpstreamError) {
    console.error(`Upstream failure: ${error.cause}`);
  }
}
```

## Checking Exit Status Without Throwing

Sometimes you want to check the exit code without throwing:

<!-- NOT TESTED: Illustrative example -->
```typescript
const p = run("some-command");
await p.lines.collect();  // Consume output
const status = await p.status;  // Check status

if (status.code !== 0) {
  console.error(`Command failed with code ${status.code}`);
}
```

**Important:** Consume the output first, then check status. Otherwise you'll leak resources.

## Handling Specific Exit Codes

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("grep", "pattern", "file.txt").lines.collect();
} catch (error) {
  if (error instanceof ExitCodeError) {
    if (error.code === 1) {
      // grep returns 1 when no matches found
      console.log("No matches found");
    } else {
      // Other errors
      throw error;
    }
  }
}
```

## Errors in Transformations

Errors in your own code propagate the same way:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("cat", "numbers.txt")
    .lines
    .map(line => {
      const num = parseInt(line);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${line}`);
      }
      return num;
    })
    .forEach(console.log);
} catch (error) {
  // Catches both process errors AND your parsing errors
  console.error(`Pipeline failed: ${error.message}`);
}
```

## Custom Error Handling

You can customize how errors are handled per process using the `fnError` option:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run(
  {
    fnError: (error, stderrData) => {
      // Custom error handling
      if (error?.code === 1) {
        // Suppress or transform specific errors
        console.warn("Command returned 1, continuing anyway");
        return;
      }
      // Re-throw other errors
      throw error;
    }
  },
  "command"
).lines.collect();
```

### Suppress All Errors

Sometimes you want to ignore failures:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Ignore all errors from this command
await run(
  { fnError: () => {} },
  "command"
).lines.collect();
```

### Transform Errors

Add context or change error types:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run(
  {
    fnError: (error) => {
      throw new Error(`Database backup failed: ${error.message}`);
    }
  },
  "pg_dump", "mydb"
).lines.collect();
```

## Working with Stderr

By default, stderr is passed through to `Deno.stderr`. You can capture and process it:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run(
  {
    fnStderr: async (stderr) => {
      for await (const line of stderr.lines) {
        console.error(`[STDERR] ${line}`);
      }
    }
  },
  "command"
).lines.collect();
```

### Collect Stderr

Capture stderr for analysis:

<!-- NOT TESTED: Illustrative example -->
```typescript
const stderrLines: string[] = [];

await run(
  {
    fnStderr: async (stderr) => {
      for await (const line of stderr.lines) {
        stderrLines.push(line);
      }
    }
  },
  "command"
).lines.collect();

console.log("Stderr output:", stderrLines);
```

### Combine Stdout and Stderr

Process both streams together:

<!-- NOT TESTED: Illustrative example -->
```typescript
const allOutput: string[] = [];

await run(
  {
    fnStderr: async (stderr) => {
      for await (const line of stderr.lines) {
        allOutput.push(`[ERR] ${line}`);
      }
    }
  },
  "command"
).lines.forEach(line => {
  allOutput.push(`[OUT] ${line}`);
});
```

## Best Practices

### 1. Catch at the End

Don't catch errors in the middle of a pipeline unless you're handling them specifically:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Don't do this
try {
  const lines = await run("command").lines.collect();
} catch (e) {
  // Handle here
}
try {
  const filtered = lines.filter(predicate);
} catch (e) {
  // And here
}

// ✅ Do this
try {
  await run("command")
    .lines
    .filter(predicate)
    .forEach(process);
} catch (error) {
  // Handle once
}
```

### 2. Always Consume Output

Even if you don't care about the output, consume it:

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Resource leak
const p = run("command");
// Never consumed!

// ✅ Consume it
await run("command").lines.collect();
// Or
await run("command").lines.forEach(() => {});
```

### 3. Use Specific Error Types

Handle different errors differently:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await pipeline();
} catch (error) {
  if (error instanceof ExitCodeError) {
    // Process failed
  } else if (error instanceof SignalError) {
    // Process killed
  } else {
    // Something else
  }
}
```

### 4. Use Custom Handlers Sparingly

Only customize error handling when you have a specific need. The default behavior works well for most cases.

## Why This Matters

Error handling is the **primary reason** proc exists. If you've ever:

- Fought with stream error events
- Debugged edge cases in error propagation
- Written the same error handling code over and over
- Lost errors in complex pipelines

...then you understand why this is revolutionary.

**Errors just work.** Like they should have all along.

## Next Steps

- [Running Processes](./running-processes.md) - Learn all the ways to run commands
- [Process Pipelines](./pipelines.md) - Chain commands together
- [Custom Error Handling](../advanced/custom-errors.md) - Advanced error customization
