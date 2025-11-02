# API Patterns

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
