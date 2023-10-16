# `proc {{gitv}}`

`proc` let's you use child processes with
[`AsyncIterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
instead of the streams API, and it includes a library of higher-order functions
for `AsyncIterator` via
[`Enumerable`](https://deno.land/x/proc@{{gitv}}/mod.ts?s=Enumerable) that
roughly matches what you can do with an array (`map`, `filter`, `find`), but for
asynchronous code.

`proc` simplifies the process of converting a `bash` script into a Deno
application. The intention is to make writing code that uses lots of IO and
child processes _almost_ as easy as shell scripting, but you also get proper
error handling, type checking, and Deno's security-by-default.

[Developer Documentation](https://deno.land/x/proc@{{gitv}}/mod.ts)

## Usage

```typescript
import { run } from "https://deno.land/x/proc@{{gitv}}/mod.ts";
```

## A Simple Example

Run `ls -la` as a child process. Decode `stdout` as lines of text. Print to
console.

```typescript
await run("ls", "-la").toStdout();
```

## A Better Example

Don't worry about understanding everything in this example yet. This shows a
little of what is possible using `proc`.

Given the text for _War and Peace_:

- Read the file into an `AsyncIterable` of `Uint8Array`.
- Uncompress it (the file is GZ'd).
- Convert to lowercase using JavaScript, because the JavaScript conversion is
  more correct than the one in `tr`.
- `grep` out all the words on word boundaries.
- `tee` this into two streams (`AsyncIterable` of `Uint8Array`) of words.
  - Count the total number of words.
  - Use `sort` with `uniq` to count the unique words.

```typescript
const [words1, words2] = read(
  fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
)
  .transform(gunzip)
  .lines
  .map((line) => line.toLocaleLowerCase())
  .run({ buffer: true }, "grep", "-oE", "(\\w|')+")
  .tee();

const [uniqueWords, totalWords] = await Promise.all([
  words1.run("sort").run("uniq").lines.count(),
  words2.lines.count(),
]);

console.log(`Total:  ${totalWords.toLocaleString()}`);
console.log(`Unique: ${uniqueWords.toLocaleString()}`);
```

Up to the point where we run `Promise.all`, this is asynchronous, streaming,
lazily evaluated code. It is trivially running three child processes (`grep`,
`sort`, and `uniq`), a `DecompressionStream` transform, and in-process logic to
normalize to lower-case. This is all happening concurrently, mostly in parallel,
one buffer, one line, or one word at a time.
