# Error Handling

Error handling is proc's primary design goal. Rather than requiring complex
coordination between producers and consumers, proc makes errors flow through
pipelines naturally, just like data.

## Solving the Backpressure and Error Problem

Traditional streams create two problems: complex backpressure coordination AND
complex error handling. proc solves both:

### Traditional Streams - Complex Backpressure + Error Handling

<!-- NOT TESTED: Illustrative example -->

```typescript
// Node.js streams - backpressure AND error handling complexity
const stream1 = createReadStream("input.txt");
const transform1 = new Transform({/* options */});
const transform2 = new Transform({/* options */});
const output = createWriteStream("output.txt");

// Backpressure handling
stream1.pipe(transform1, { end: false });
transform1.pipe(transform2, { end: false });
transform2.pipe(output);

// Error handling at each stage
stream1.on("error", handleError);
transform1.on("error", handleError);
transform2.on("error", handleError);
output.on("error", handleError);

// Plus drain events, pause/resume, etc.
```

### proc - No Backpressure, Simple Errors

<!-- NOT TESTED: Illustrative example -->

```typescript
// proc - pull-based flow eliminates both problems
try {
  await read("input.txt")
    .lines
    .map(transform1)
    .map(transform2)
    .writeTo("output.txt");
} catch (error) {
  // All errors caught here - no backpressure coordination needed
  console.error(`Pipeline failed: ${error.message}`);
}
```

**Why this works:**

- **Pull-based flow**: Consumer controls pace, no backpressure needed
- **Error propagation**: Errors flow with data through the same path
- **One catch block**: Handle all errors in one place

## The Traditional Problem

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
  stdin: "piped",
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
stream1.on("error", handleError);
stream2.on("error", handleError);
stream3.on("error", handleError);
```

## How proc Changes Everything

proc treats errors as first-class data that flows through your pipeline
alongside the actual results. When you build a pipeline with multiple
operations—running processes, transforming data, filtering results—any error
that occurs anywhere in the chain automatically propagates to your final catch
block:

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

This approach eliminates the need for error handling at each step. Whether a
process exits with a non-zero code, a transformation throws an exception, or a
filter encounters invalid data, the error flows downstream and gets caught in
one place.

## How Error Propagation Works

When something goes wrong anywhere in the pipeline:

1. The error is captured
2. Downstream operations are skipped
3. The error propagates to your catch block

It's functional programming—errors are just another type of data flowing
through.

## Errors Are Synchronous With Data

Here's a critical design principle that makes proc fundamentally different from
the Streams API: **errors occur in sync with the data stream**.

When a process fails, you don't see the error immediately. You see it when you
iterate to it:

<!-- NOT TESTED: Illustrative example -->

```typescript
try {
  // If this command fails on line 100...
  await run("command")
    .lines
    .forEach((line) => {
      console.log(line);
    });
} catch (error) {
  // ...you'll successfully process lines 1-99 first
  console.error(`Error after processing data: ${error.message}`);
}
```

This is how streaming **should** work:

- **Partial consumption is safe**: If you only take 50 lines (`.take(50)`), you
  never encounter an error that happens on line 100
- **Data comes first**: You always process all available data before seeing the
  error
- **Predictable flow**: Errors arrive exactly when you iterate to them, not
  asynchronously

### Why This Matters

The Streams API has a fundamental problem: errors occur **out of sync** with the
data. A process might fail, but the error arrives as a separate event,
disconnected from the data flow. This creates subtle bugs and edge cases:

<!-- NOT TESTED: Illustrative example -->

```typescript
// Streams API - error arrives separately from data
const stream = createReadableStream();

stream.on("data", (chunk) => {
  // Process chunk
});

stream.on("error", (error) => {
  // Error arrives here - but how much data did we process?
  // Did we miss some data? Did we process partial data?
  // Hard to reason about!
});
```

With proc, errors are part of the iteration. They're not separate events—they're
items in the stream that you encounter when you reach them:

<!-- NOT TESTED: Illustrative example -->

```typescript
// proc - error is part of the data flow
try {
  for await (const line of run("command").lines) {
    // Process line
    // If an error occurs, you've already processed all previous lines
    // No race conditions, no missing data, no ambiguity
  }
} catch (error) {
  // You know exactly where you are in the stream
}
```

### What This Means for You

1. **No race conditions**: Data and errors flow in a single, predictable
   sequence
2. **Easier debugging**: You know exactly how much data was processed before the
   error
3. **Simpler code**: No need to coordinate between data handlers and error
   handlers
4. **Correct by default**: Code that looks right actually is right

This synchronous error propagation is a core design goal of proc. It takes
careful engineering to ensure errors from child processes are thrown in sync
with the data stream, but it eliminates entire categories of bugs that plague
traditional stream-based code.

## Understanding Error Types

proc throws specific error types that help you handle different failure
scenarios appropriately. Each error type carries relevant context about what
went wrong, making debugging and error recovery more straightforward.

**ExitCodeError** occurs when a process exits with a non-zero code:

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

**SignalError** happens when a process is terminated by a signal, such as when
you interrupt it with Ctrl+C:

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

**UpstreamError** wraps errors that come from earlier stages in a pipeline:

<!-- NOT TESTED: Illustrative example -->

```typescript
import { UpstreamError } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("cat", "missing.txt") // This fails
    .run("grep", "pattern") // This gets UpstreamError
    .lines.collect();
} catch (error) {
  if (error instanceof UpstreamError) {
    console.error(`Upstream failure: ${error.cause}`);
  }
}
```

## Checking Exit Status Without Throwing

Sometimes you want to inspect a process's exit status without triggering an
exception. proc supports this pattern by letting you consume the process output
first, then check the status afterward. This approach is useful when non-zero
exit codes are expected or when you want to implement custom error handling
logic.

Remember to always consume the output before checking the status—otherwise
you'll create resource leaks. The pattern is straightforward: run your process,
consume its output with methods like `.lines.collect()`, then access the
`.status` property to inspect the exit code and make decisions based on the
result.

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
    .map((line) => {
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

While proc's default error handling works well for most cases, you can customize
how errors are handled using the `fnError` option. This function receives the
error and any stderr data, giving you the opportunity to suppress specific
errors, transform them, or add additional context.

For example, some commands like `grep` return exit code 1 when no matches are
found, which isn't really an error in many contexts. You can use a custom error
handler to treat this as normal behavior while still catching genuine failures.
Similarly, you might want to add context to errors to make debugging easier, or
suppress errors entirely for commands where failure is acceptable.

## Working with Stderr

By default, proc passes stderr through to `Deno.stderr`, which means error
messages from child processes appear in your terminal as expected. However, you
can capture and process stderr using the `fnStderr` option, which gives you an
async iterable of stderr lines.

This capability is useful when you need to analyze error output, combine stdout
and stderr streams, or implement custom logging. You can collect stderr lines
into an array for later analysis, process them in real-time, or merge them with
stdout to create a unified output stream. The stderr handler runs concurrently
with your main pipeline, so it doesn't block the processing of stdout.

```typescript
import { enumerate, run, toLines } from "jsr:@j50n/proc";

const stderrLines: string[] = [];

await run(
  {
    fnStderr: async (stderr) => {
      for await (const line of enumerate(stderr).transform(toLines)) {
        stderrLines.push(line);
      }
    },
  },
  "sh",
  "-c",
  "echo 'normal output'; echo 'error message' >&2",
).lines.collect();

console.log("Captured stderr:", stderrLines);
```

## Best Practices for Error Handling

### 1. Catch at the End

Don't catch errors in the middle of a pipeline unless you're handling them
specifically:

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

Only customize error handling when you have a specific need. The default
behavior works well for most cases.

## Why This Approach Matters

Error handling is the primary reason proc exists. If you've struggled with
stream error events, debugged edge cases in error propagation, or written the
same error handling code repeatedly, proc's approach will feel like a relief.

Errors propagate naturally. One catch block handles everything. The complexity
disappears.

## See Also

- [Running Processes](./running-processes.md) — All the ways to run commands
- [Process Pipelines](./pipelines.md) — Chain commands together
- [Troubleshooting](../troubleshooting.md) — Common issues and solutions
