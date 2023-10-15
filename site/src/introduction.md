# `proc {{gitv}}`

A better way to work with processes in Deno.

[Developer Documentation](https://deno.land/x/proc@{{gitv}}/mod.ts)

## Usage

```typescript
import * as proc from "https://deno.land/x/proc@{{gitv}}/mod.ts";
```

## Example

Run `ls -la` as a child process. Decode `stdout` as lines of text. Print to
console.

```typescript
await proc.run("ls", "-la").toStdout()
```
