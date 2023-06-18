#!/usr/bin/env -S deno run --allow-run --allow-read

import { fromFileUrl } from "./deps/path.ts";
import { enumerate, gunzip, read, toLines } from "../../mod3.ts";

console.time("count");

export function splitOnWords(lines: AsyncIterable<string>) {
  return enumerate(lines)
    .filterNot((line) => line.length === 0)
    .map((it) => it.toLocaleLowerCase())
    .flatMap((it) => it.split(/[\s—]+/g))
    .map((it) => it.replaceAll(/(?![’'-])[^\p{L}\p{N}]/ug, ""))
    .filterNot((it) => it.length === 0 || /[0-9]|CHAPTER/.test(it));
}

export function splitOnWordsAlt(lines: AsyncIterable<string>) {
  return enumerate(lines)
    .filterNot((line) => line.length === 0)
    .map((it) => it.toLocaleLowerCase())
        .run("grep", "-oE", "(\\w|'|’|-)+")
    .lines
    .filterNot((it) => it.length === 0 || /[0-9]|CHAPTER/.test(it));
}

export function distinctStreaming(words: AsyncIterable<string>) {
  return enumerate(words)
    .run("sort")
    .run("uniq")
    .lines;
}

export async function* distinctInMemory(words: AsyncIterable<string>) {
  const uniqueWords = new Set();
  for await (const word of words) {
    uniqueWords.add(word);
  }
  yield* uniqueWords;
}

const words = read(
  fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
)
  .transform(gunzip)
  .transform(toLines)
  .transform(splitOnWordsAlt);
// .transform(debug<string>)

const [w1, w2] = words.tee();

const [count, unique] = await Promise.all([
  w1.count(),
  w2.transform(distinctInMemory).count(),
]);

console.log(`Total word count:  ${count.toLocaleString()}`);
console.log(`Unique word count: ${unique.toLocaleString()}`);

/* split on whitespace */
/* "Negative lookahead" in Regex. Remove all non-alphanum except for a few. */
/* Remove a few remaining empties and CHAPTER headings. */
/* Convert to lower case to avoid uniqueness mistakes. */

/* 117MB used on a 1.2MB file (compressed). 100 to 1 inflation? */

console.timeEnd("count");

// const unique = new Set(words);

// console.dir(Deno.memoryUsage());
// await sleep(30000);

// console.log(words.length);

// console.log(unique.size);
