# Process Pipelines

Chaining processes together creates powerful data processing workflows that combine the efficiency of Unix tools with the expressiveness of JavaScript.

## Understanding Pipeline Basics

In a shell, you'd write:

```bash
cat file.txt | grep error | wc -l
```

In proc, you write the same logic with method chaining:

<!-- NOT TESTED: Illustrative example -->
```typescript
const count = await run("cat", "file.txt")
  .run("grep", "error")
  .run("wc", "-l")
  .lines.first;
```

Each `.run()` pipes the previous output to the next command's stdin, creating a seamless data flow where each process receives exactly what the previous one produces.

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

Sometimes you need to process the same data in multiple ways. Use `.tee()` to split a pipeline into multiple branches that can be processed independently:

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

The `.tee()` method creates two independent iterables from one source, allowing each branch to be processed differently while both run concurrently. This is perfect for collecting different subsets of data in one pass, calculating multiple statistics simultaneously, or processing data while also logging it. Remember that both branches must be consumed to avoid resource leaks.

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

## Performance and Efficiency

Pipelines are designed for optimal performance and resource usage. They stream data through the pipeline one buffer at a time, meaning nothing is collected in memory unless you explicitly request it. All processes in the pipeline run concurrently, creating efficient parallel processing:

<!-- NOT TESTED: Illustrative example -->
```typescript
// This processes a 10GB file using ~constant memory
await run("cat", "huge-file.txt")
  .run("grep", "pattern")
  .run("wc", "-l")
  .lines.first;
```

The lazy evaluation means nothing actually runs until you consume the output, and the streaming nature ensures minimal memory usage even for huge files.

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

## Choosing Between Pipelines and JavaScript

Understanding when to use each approach helps you build efficient and maintainable data processing workflows.

Use pipelines when you're processing large files, want to chain Unix tools together, need streaming performance, or you're replacing shell scripts with more robust TypeScript code.

Use JavaScript transformations when you need complex logic that's difficult to express with Unix tools, you're working with structured data like JSON, you need type safety and IDE support, or the operation is CPU-bound rather than I/O-bound.

The most powerful approach is mixing both techniques, using Unix tools for efficient data filtering and JavaScript for complex transformations and business logic.

## Next Steps

- [Working with Output](./output.md) - Transform and process output
- [Concurrent Processing](../advanced/concurrent.md) - Parallel pipelines
- [Streaming Large Files](../advanced/streaming.md) - Handle huge files efficiently
