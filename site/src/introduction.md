# `proc {{gitv}}`

`proc` is a powerful functional extension for `AsyncIterable` in Deno. It
supports managing external processes, provides extensions for concurrent
programming, and works seamlessly with `Deno` IO streams. With `proc`, writing
shell-style solutions in Deno is painless.

[Developer Documentation](https://deno.land/x/proc@{{gitv}}/mod3.ts)

## Import

Import using this path (note the use of `mod3.ts` rather than `mod.ts`).

```typescript
import * as proc from "https://deno.land/x/proc@{{gitv}}/mod3.ts";
```

## A Few Examples

Here are some of the things `proc` can do.

### Running a Process

List the file names in the current directory (`-1` puts each on its own line),
capture as lines, and collect the names into an array.

```typescript
const filesAndFolders = run("ls", "-1", "-a", ".").lines.collect();
```

### Chaining Processes Together

Read "War and Peace" in from a compressed file. Uncompress the file. `grep` out
empty lines. Print it.

```typescript
const warandpeace = resolve("./warandpeace.txt.gz");

read(warandpeace)
  .run("gunzip").
  .run("grep", "-v", "^$")
  .lines
  .forEach((line) => console.log(line));
```

This is equivalent to:

```sh
cat ./warandpeace.txt.gz | gunzip | grep -v '^$'
```

### Functional Style

For all even numbers between 1 and 100, multiply by 2 and print. So 4, 8, 12
... 200.

```typescript
await range({ from: 1, until: 100 })
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .forEach((n) => console.log(n));
```

## A Few More Examples

These examples are longer. More involved. Good stuff.



## Odd Ducks

Other useful stuff. These might be a little off topic for this library, but here
they are.

### A Lazy Way to Count

Print the numbers from 0 to 99.

```typescript
for await (const i of range({ to: 100 })) {
  console.log(i);
}
```

### Sleep

A convenient way to wait a little bit. This pauses for 1 second.

```typescript
await sleep(1000);
```
