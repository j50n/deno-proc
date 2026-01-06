# API Design Patterns

## toStdout() Behavior

`.toStdout()` is a convenience method that handles multiple data types:

- **Strings**: Automatically have `\n` appended (like println)
- **String arrays**: Each string gets `\n` appended
- **Uint8Array**: Written as-is, no automatic newlines
- **Uint8Array arrays**: Written as-is, no automatic newlines

Internally uses `toBytes()` transformer to convert strings to bytes.

### Examples

```typescript
// Strings - newlines added automatically
await enumerate(["line1", "line2"]).toStdout();
// Output: line1\nline2\n

// Process lines - newlines added automatically
await run("ls")
  .lines
  .map(line => line.toUpperCase())
  .toStdout();

// Bytes - no automatic newlines
const encoder = new TextEncoder();
await enumerate([
  encoder.encode("line1\n"),
  encoder.encode("line2\n")
]).toStdout();
// Output: line1\nline2\n (newlines from source data)
```

### Key Points

- **DO NOT** manually add `\n` to strings - it will double the line feeds
- **DO NOT** use `.transform(toBytes)` before `.toStdout()` - it's redundant
- `.toStdout()` is the idiomatic way to write output
- `.forEach(line => console.log(line))` works but is not idiomatic

## Common Patterns

### Output to stdout
```typescript
// Preferred: Use .toStdout() for writing to stdout (idiomatic)
// toStdout() handles strings, string arrays, Uint8Arrays, and arrays of those
// Strings automatically have newlines appended
await run("ls")
  .lines
  .map(line => line.toUpperCase())
  .toStdout();

// Alternative: forEach with console.log
await run("ls").lines.forEach(line => console.log(line));
```

### Process Execution
```typescript
// Good: Output consumed
await run("ls").lines.collect();

// Bad: Output not consumed (resource leak)
const p = run("ls");
```

### Error Handling
```typescript
// Good: Single try-catch at end
try {
  await run("cmd1").run("cmd2").lines.forEach(process);
} catch (error) {
  handle(error);
}

// Bad: Try-catch at each step
try {
  const p1 = run("cmd1");
  try {
    const p2 = p1.run("cmd2");
    // ...
  } catch (e2) { }
} catch (e1) { }
```

### Enumeration
```typescript
// Good: enumerate() wraps, .enum() adds indices
await enumerate(data).enum().map(([item, i]) => ...)

// Bad: Expecting enumerate() to add indices automatically
await enumerate(data).map((item, i) => ...) // i is undefined
```
