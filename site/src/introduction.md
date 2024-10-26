# `proc {{gitv}}`

When I started this project, Deno was still young. My goal was to create a better way to run 
child processes. I realized the Deno had the potential to be a better version of Bash scripting.
In its simplest form, a Deno script can run standalone, without external configuration or compilation.
A big selling point is the security-by-default, which is a problem for system admins who run Bash 
scripts with `root` privileges. 
However, the young Deno lacked a lightweight, fluent way to run child processes - something that Bash is exceedingly good at.

Fast forward a few years and a few rewrites. The library has become a way to work with streaming data (files, IO, etc.) using 
[`AsyncIterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
instead of JavaScript streams for everything. You can use `map`, `filter`, `find`, and a whole bunch of other 
methods just like you would on an `Array`, but they are streamed and lazy. Errors work the
way you expect them to. You can process through terrabytes of information while using very little memory.

It also lets you `run` child processes. Yeah, that part turned out really good. It's easy. It's almost trivial. 
You can run processes concurrently. There is a little more boilerplate than Bash, you know, because it
uses Typescript syntax - but it is really minimal and easy to read. Deno has improved their process runner since the old days, but 
this is still better.



<!--  `proc` let's you use child processes with
[`AsyncIterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
instead of the streams API, and it includes a library of higher-order functions
for `AsyncIterator` via
[`Enumerable`](https://deno.land/x/proc@{{gitv}}/mod.ts?s=Enumerable) that
roughly matches what you can do with an array (`map`, `filter`, `find`), but for
asynchronous code. -->

<!-- `proc` simplifies the process of converting a `bash` script into a Deno
application. The intention is to make writing code that uses lots of IO and
child processes _almost_ as easy as shell scripting, but you also get proper
error handling, type checking, and Deno's security-by-default. -->

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
const [words1, words2] = 
  read(fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")))
  .transform(gunzip)
  .lines
  .map((line) => line.toLocaleLowerCase())
  .run("grep", "-oE", "(\\w|')+") // grep out the words to individual lines
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
