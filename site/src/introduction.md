# `proc {{gitv}}`

`proc` makes running child processes really, really easy.

The real power of `proc`, however, is that it lets you use (most of) the higher
order functions from JavaScript arrays - `map`, `filter`, `find`, etc. - on
[`AsyncIterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
data. The code you run this way is lazy and streamed, so you can work with data
that is **much larger** than you can fit in memory. This lets you do all sorts
of complex IO, and simply. If you have struggled to get JavaScript streams to
run without edge case bugs, and if you find streams awkward to work with, you
are going to love this.

`proc` also includes functions that make concurrent processing _with
controlled/limited concurrency_ easy, and easy to understand. If you thought
that JavaScript was not great for parallel programming, this might change your
mind.

I personally use `proc` for sysadmin work as a replacement for Bash scripting. I
can just drop `deno` into `/usr/local/bin/` and now I can write standalone Deno
scripts that can do (almost) anything I would want to do with a Bash script, but
with proper type-checking, error handling, and with **safety** (tightly
sandboxed). The ability to run and manage child processes in a sane manner is
critical for this kind of work, and this is where `proc` shines.

[Developer Documentation](https://deno.land/x/proc@{{gitv}}/mod.ts)

## Status

This project is actively maintained. I have used it almost every day since the
first version. If you find bugs, errors, or omissions in the documentation,
please file an issue.

The API is stable. There still could be breaking changes, but things are pretty
much done.

The documentation is a work in progress. The code works. The documentation - not
quite there yet.

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
