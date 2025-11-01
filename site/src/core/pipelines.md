# Process Pipelines

Chain processes together like shell pipes. It's beautiful.

## The Basics

In a shell, you'd write:

```bash
cat file.txt | grep error | wc -l
```

In proc, you write:

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await run("cat", "file.txt")
  .run("grep", "error")
  .run("wc", "-l")
  .lines.first;
```

Each `.run()` pipes the previous output to the next command's stdin.

## How It Works

<!-- NOT TESTED: Illustrative example -->
```typescript
run("command1")      // Produces output
  .run("command2")   // Receives command1's output as stdin
  .run("command3")   // Receives command2's output as stdin
```

The data flows through, one buffer at a time. Nothing is collected in memory unless you ask for it.

## Real Examples

### Count Lines

<!-- NOT TESTED: Illustrative example -->
```typescript
const lines = await run("cat", "file.txt")
  .run("wc", "-l")
  .lines.first;

console.log(`${lines} lines`);
```

### Find and Count

<!-- NOT TESTED: Illustrative example -->
```typescript
const errorCount = await run("cat", "app.log")
  .run("grep", "ERROR")
  .run("wc", "-l")
  .lines.first;
```

### Sort and Unique

<!-- NOT TESTED: Illustrative example -->
```typescript
const unique = await run("cat", "words.txt")
  .run("sort")
  .run("uniq")
  .lines.collect();
```

### Case Conversion

<!-- NOT TESTED: Illustrative example -->
```typescript
const lowercase = await run("echo", "HELLO WORLD")
  .run("tr", "A-Z", "a-z")
  .lines.first;
// "hello world"
```

## Mixing Processes and Transformations

You can mix process pipes with JavaScript transformations:

<!-- NOT TESTED: Illustrative example -->
```typescript
const result = await run("cat", "data.txt")
  .run("grep", "pattern")
  .lines
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .collect();
```

The `.lines` converts bytes to text, then JavaScript takes over.

## Complex Pipelines

Build sophisticated data processing pipelines:

<!-- NOT TESTED: Illustrative example -->
```typescript
const stats = await run("cat", "access.log")
  .run("grep", "ERROR")
  .run("cut", "-d", " ", "-f", "1")  // Extract IP addresses
  .run("sort")
  .run("uniq", "-c")                  // Count occurrences
  .run("sort", "-rn")                 // Sort by count
  .run("head", "-10")                 // Top 10
  .lines
  .collect();

console.log("Top 10 error sources:");
stats.forEach(line => console.log(line));
```

## Branching Pipelines

Sometimes you need to process the same data in multiple ways. Use `.tee()` to split a pipeline into multiple branches:

<!-- NOT TESTED: Illustrative example -->
```typescript
const [branch1, branch2] = run("cat", "data.txt")
  .lines
  .tee();

// Process both branches concurrently
const [result1, result2] = await Promise.all([
  branch1.filter(line => line.includes("A")).collect(),
  branch2.filter(line => line.includes("B")).collect(),
]);
```

**How it works:** `.tee()` creates two independent iterables from one source. Each branch can be processed differently, and both can run concurrently.

**Use cases:**
- Collect different subsets of data in one pass
- Calculate multiple statistics simultaneously
- Process data while also logging it

**Important:** Both branches must be consumed, or you'll leak resources.

## Error Handling in Pipelines

Errors propagate through the entire pipeline:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  await run("cat", "missing.txt")  // This fails
    .run("grep", "pattern")         // Never runs
    .run("wc", "-l")                // Never runs
    .lines.collect();
} catch (error) {
  // Catches the error from cat
  console.error(`Pipeline failed: ${error.message}`);
}
```

See [Error Handling](./error-handling.md) for details.

## Performance Characteristics

Pipelines are:

- **Streaming** - Data flows through, not collected in memory
- **Lazy** - Nothing runs until you consume the output
- **Concurrent** - All processes run at the same time
- **Efficient** - Minimal memory usage, even for huge files

<!-- NOT TESTED: Illustrative example -->
```typescript
// This processes a 10GB file using ~constant memory
await run("cat", "huge-file.txt")
  .run("grep", "pattern")
  .run("wc", "-l")
  .lines.first;
```

## Debugging Pipelines

Print intermediate results:

<!-- NOT TESTED: Illustrative example -->
```typescript
await run("cat", "file.txt")
  .run("grep", "pattern")
  .lines
  .map(line => {
    console.log(`Processing: ${line}`);
    return line;
  })
  .forEach(process);
```

Or split it up:

<!-- NOT TESTED: Illustrative example -->
```typescript
const step1 = run("cat", "file.txt");
const step2 = step1.run("grep", "pattern");
const step3 = step2.lines;

// Now you can inspect each step
for await (const line of step3) {
  console.log(line);
}
```

## Common Patterns

### Extract and Count

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await run("cat", "file.txt")
  .run("grep", "-o", "pattern")
  .lines.count();
```

### Filter and Transform

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await run("cat", "data.csv")
  .run("grep", "-v", "^#")  // Remove comments
  .run("cut", "-d", ",", "-f", "1,3")  // Extract columns
  .lines
  .map(line => line.split(","))
  .collect();
```

### Aggregate Data

<!-- NOT TESTED: Illustrative example -->
```typescript
const sum = await run("cat", "numbers.txt")
  .lines
  .map(line => parseInt(line))
  .reduce((acc, n) => acc + n, 0);
```

## When to Use Pipelines

**Use pipelines when:**
- You're processing large files
- You want to chain Unix tools
- You need streaming performance
- You're replacing shell scripts

**Use JavaScript when:**
- You need complex logic
- You're working with structured data (JSON, etc.)
- You need type safety
- The operation is CPU-bound

**Mix both** for the best of both worlds!

## Next Steps

- [Working with Output](./output.md) - Transform and process output
- [Concurrent Processing](../advanced/concurrent.md) - Parallel pipelines
- [Streaming Large Files](../advanced/streaming.md) - Handle huge files efficiently
