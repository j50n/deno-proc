# Counting Words <!-- omit from toc -->

- [Direct Translation from Bash](#direct-translation-from-bash)
- [Embedding a Shell Script](#embedding-a-shell-script)
- [Doing All the Work in Deno](#doing-all-the-work-in-deno)
  - [Transformer for Unique Words](#transformer-for-unique-words)
  - [Transformer to Split into Words](#transformer-to-split-into-words)
  - [Putting It All Together](#putting-it-all-together)

This shell script counts total and unique words:

```shell
#!/bin/bash
set -e

# total word count
zcat ./warandpeace.txt.gz \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE "(\\w|'|’|-)+" \
  | wc -l 

#count unique words
zcat ./warandpeace.txt.gz \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE "(\\w|'|’|-)+" \
  | sort \
  | uniq \
  | wc -l
```

There are multiple approaches to doing the same thing in Deno using `proc`. You
can run this in-process as a pure Typescript/JavaScript solution, run it as a
shell script, or translate each command in the shell script into `run` methods.

> ⚠️ The `tr` used to convert to lowercase **is not** fully unicode compliant.
> Expect counts to be a little different between this code and the code that
> uses JavaScript's `.toLocaleLowercase()`, which **is** fully unicode
> compliant.

## Direct Translation from Bash

This is the equivalent to the shell script using `proc` methods. This
substitutes `gunzip` for `zcat`, translates each output to a number, and runs
the operations concurrently (and in parallel) - since that is easy to do.
Otherwise it is doing exactly the same thing.

Otherwise, this is a direct translation where `proc` just controls the streaming
from process to process. All the same child processes are being launched.

```typescript
const [total, unique] = await Promise.all([
  read(fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")))
    .run("gunzip")
    .run("tr", "[:upper:]", "[:lower:]")
    .run("grep", "-oE", "(\\w|'|’|-)+")
    .run("wc", "-l")
    .lines
    .map((n) => parseInt(n, 10))
    .first,

  read(fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")))
    .run("gunzip")
    .run("tr", "[:upper:]", "[:lower:]")
    .run("grep", "-oE", "(\\w|'|’|-)+")
    .run("sort")
    .run("uniq")
    .run("wc", "-l")
    .lines
    .map((n) => parseInt(n, 10))
    .first,
]);

console.log(total);
console.log(unique);
```

## Embedding a Shell Script

Another approach is to embed a shell script. No translation required here. This
is a `bash` script run using `/bin/bash`. This moves the entire workload and its
management into other processes. Consider this solution if your application is
doing lots of other things concurrently.

Note that you give up some control over error handling with this approach, so be
sure to test for the types of errors you think you may encounter. Shell scripts
are notorious for edge-case bugs - which is why we reach for a "real"
programming language when things start to get complex.

This is also a simple example of a generated script. We are injecting the full
path of our text file as determined by the Deno script.

This example shows the total count.

```typescript
await run(
  "/bin/bash",
  "-c",
  ` set -e
    zcat "${fromFileUrl(import.meta.resolve("./warandpeace.txt.gz"))}" \
      | tr '[:upper:]' '[:lower:]' \
      | grep -oE "(\\w|'|’|-)+" \
      | wc -l
  `,
)
  .lines
  .forEach((line) => console.log(line));
```

## Doing All the Work in Deno

This is a streaming solution staying fully in Deno, in a single
Typescript/JavaScript VM (not using child processes at all). The avoids (most
of) the memory overhead that would be needed to process the document in memory
(non-streaming), and it is fast.

This demonstrates _transformer-composition_ in `proc`. Because transformers are
just functions of iterable collections, you can compose them into logical units
the same way you would any other code.

### Transformer for Unique Words

We could shell out to `sort` and `uniq`, but this way is much faster. It only
needs a little extra memory. It dumps the words, one at a time, into a `Set`.
Then it yields the contents of the `Set`.

The set of unique words is much smaller than the original document, so the
memory required is quite small.

```typescript
export async function* distinct(words: AsyncIterable<string>) {
  const uniqueWords = new Set();
  for await (const word of words) {
    uniqueWords.add(word);
  }
  yield* uniqueWords;
}
```

### Transformer to Split into Words

Convert each line to lower case. Use `Regex` to split the line into words.
Remove anything without a character (all symbols), anything with a number, and
"CHAPTER" titles. The symbol characters in the regular expression are specific
to the test document and probably won't work generally.

The document we are targeting, `./warandpeace.txt.gz`, uses extended unicode
letters and a few unicode symbols as well. We know that the Typescript solution
below works correctly with unicode characters (note the `u` flag on the regular
expression). Some of the *nix utilities were written a long time ago and still
do not support unicode. In particular, `tr` does not translate case correctly
all of the time, and I am not sure what `grep` is doing - it sort of works, but
the regular expression language has subtle differences to what I am used to. A
benefit of working in a tightly spec'd language like Typescript is you know what
your code should be doing at all times. The counts are very close, but they are
not exactly the same, so we know something is a little bit off with `tr` and/or
`grep`.

```typescript
export function split(lines: AsyncIterable<string>) {
  return enumerate(lines)
    .map((it) => it.toLocaleLowerCase())
    .flatMap((it) =>
      [...it.matchAll(/(\p{L}|\p{N}|['’-])+/gu)]
        .map((a) => a[0])
    )
    .filterNot((it) =>
      /^['’-]+$/.test(it) ||
      /[0-9]/.test(it) ||
      /CHAPTER/.test(it)
    );
}
```

### Putting It All Together

Read the file. Uncompress it and convert to lines (`string`). Use the
transformer function we created earlier, `split`, to split into words.

```typescript
const words = read(
  fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
)
  .transform(gunzip)
  .transform(toLines)
  .transform(split);
```

Now we need to get (1) a count of all words and (2) a count of unique words. We
can use `tee` to create two copies of the stream - since we have to count twice.
This gets around the limitation of being able to use an iterable only once and
means we don't have to do extra work splitting the document into words two
times.

```typescript
const [w1, w2] = words.tee();
```

We can count the words in the first copy directly. For the second copy, we use
the `distinct` transformer before counting.

```typescript
const [count, unique] = await Promise.all([
  w1.count(),
  w2.transform(distinct).count(),
]);

console.log(`Total word count:  ${count.toLocaleString()}`);
console.log(`Unique word count: ${unique.toLocaleString()}`);
```

The results:

```
Total word count:  563,977
Unique word count: 18,609
```

Clean, readable code. Understandable error handling. Fast. The only downside is
that the processing is done in-process (we only have one thread to work with in
JavaScript). If you are doing other things at the same time, this will slow them
down.
