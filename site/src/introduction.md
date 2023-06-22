# `proc {{gitv}}`

`proc` is a better way to work with processes in Deno.

[Developer Documentation](https://deno.land/x/proc@{{gitv}}/mod3.ts)

## Usage

Import using this path (note the use of `mod3.ts` rather than `mod.ts`).

```typescript
import * as proc from "https://deno.land/x/proc@{{gitv}}/mod3.ts";
```

## Example

Run `ls -la` as a child process. Decode `stdout` as lines of text. Print to
console.

```typescript
for await (const line of proc.run("ls", "-la").lines) {
  console.log(line);
}
```
