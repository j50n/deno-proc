# `proc {{gitversion}}`

`proc` is a powerful functional extension for `AsyncIterable` in Deno. It
supports managing external processes, provides extensions for concurrent
programming, and works seamlessly with `Deno` IO streams. With `proc`, writing
shell-style solutions in Deno is painless.

## Import

Import using this path (note the use of `mod3.ts` rather than `mod.ts`).

```typescript
import {
  Cmd,
  enumerate,
  read,
  run,
} from "https://deno.land/x/proc@{{gitversion}}/mod3.ts";
```

## Examples

These examples show some of the things `proc` can do.

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

### Working with Multiple Copies of the Same Data

Read "War and Peace" and uncompress. Convert to lower case. Split into words.
Split into `A` and `B` enumerations.

With `A`, sort the words, find the unique words, and count them.

With `B`, just count the total number of words.

```typescript
const warandpeace = resolve("./warandpeace.txt.gz");

const [wordsA, wordsB] = read(warandpeace)
  .run("gunzip").lines
  .map((line) => line.toLocaleLowerCase())
  .run("grep", "-oE", "(\\w|')+")
  .tee();

const [uniqueWords, totalWords] = await Promise.all([
  wordsA.run("sort").run("uniq").run("wc", "-l").lines
    .map((n) => parseInt(n, 10))
    .first,
  wordsB.run("wc", "-l").lines
    .map((n) => parseInt(n, 10))
    .first,
]);

console.log(`Total: ${totalWords.toLocaleString()}`);
console.log(`Unique: ${uniqueWords.toLocaleString()}`);
```

This is (_almost_) equivalent to:

```sh
# Count unique words
cat ./warandpeace.txt.gz \
  | gunzip \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE "(\\w|')+" \
  | sort \
  | uniq \
  | wc -l 

# Count all words
cat ./warandpeace.txt.gz \
  | gunzip \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE "(\\w|')+" \
  | wc -l
```

### Concurrent Total Used Storage for S3 Buckets

`proc` supports concurrent operations with controlled (limited) concurrency.
This is a way to run child processes in parallel without swamping your server.

If you have to work with S3 buckets, you know it is time consuming to determine
how much storage space you are using/paying for, and where you are using the
most storage. `proc` makes it possible to run `ls --summarize` with parallelism
matching the number of CPU cores available (or whatever concurrency you
specify). The specific methods that support concurrent operations are
`.concurrentMap()` and `.concurrentUnorderedMap()`.

To list the `s3` buckets in your AWS account from terminal:

```sh
aws s3 ls
```

The result looks something like this:

```
2013-07-11 17:08:50 mybucket
2013-07-24 14:55:44 mybucket2
```

Grab those bucket names with `proc`:

```typescript
const buckets = await run("aws", "s3", "ls")
  .map((b) => b.split(/\s+/g, 3))
  .map((b) => b[b.length - 1])
  .collect();
```

To get the total storage size in bytes from terminal:

```sh
aws s3 ls s3://mybucket --recursive --summarize
```

This will list all objects in the bucket, but we can ignore that noise. At the
end of the operation, we are looking for a line that looks like this:

```
Total Size: 2.9 MiB
```

This is potentially a long-running operation (some buckets have a lot of
objects), so we want to run it concurrently. With `proc`:

```typescript
enumerate(buckets).concurrentUnorderedMap(
  async (bucket) => {
    const answer: string = await run(
        "nice", "-19",
        "aws", "s3", "ls", 
        `s3://${bucket}`, 
        "--recursive", "--summarize")
      .filter(line => line.includes("Total Size:"))
      .map(line => line.trim())
      .first;

    return {bucket, answer};
  }.forEach(({bucket, answer}) => console.log(`${bucket}\t${answer}`))
)
```

Use `nice` because _this will eat your server otherwise._ The method
`.concurrentUnorderedMap()` will, by default, run one process for each CPU
available concurrently until all work is done.

The result will look something like this:

```
mybucket  Total Size: 2.9 MiB
mybucket2 Total Size: 30.2 MiB
```
