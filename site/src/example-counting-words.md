# Counting Words

To count non-unique words:

```shell
zcat ./warandpeace.txt.gz \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE '(\\w|'|’|-)+' \
  | wc -l 
```

To count unique words:

```shell
zcat ./warandpeace.txt.gz \
  | tr '[:upper:]' '[:lower:]' \
  | grep -oE '(\\w|'|’|-)+' \
  | sort \
  | uniq \
  | wc -l
```

## Transformer for Unique Words

I could shell out to `sort` and `uniq`, but this way is much faster. It only needs a little extra memory.
It dumps the words, one at a time, into a `Set`. Then it yields the contents of the `Set`.

```typescript
export async function* distinct(words: AsyncIterable<string>) {
  const uniqueWords = new Set();
  for await (const word of words) {
    uniqueWords.add(word);
  }
  yield* uniqueWords;
}
```

## Transformer to Split into Words

Convert each line to lower case. Use `grep` to split the lines into words. Remove 
empties, anything with a number, and "CHAPTER" titles.

```typescript
export function split(lines: AsyncIterable<string>) {
  return enumerate(lines)
    .map((it) => it.toLocaleLowerCase())
    .run("grep", "-oE", "(\\w|'|’|-)+")
    .lines
    .filterNot((it) => it.length === 0 || /[0-9]|CHAPTER/.test(it));
}
```

## Putting It All Together

Read the file. Uncompress it and convert to lines (`string`). Use the transformer function, `split`, to split into words. 

```typescript
const words = read(
  fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
)
  .transform(gunzip)
  .transform(toLines)
  .transform(split);
```

We want to get (1) a count of all words and (2) a count of unique words. We can use `tee` to create two copies of the stream - since we have to count twice.

```typescript
const [w1, w2] = words.tee();
```

We count the words in the first copy directly. We count the distinct words in the second copy.

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
Total word count:  564,185
Unique word count: 18,612
```
