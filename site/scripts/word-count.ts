#!/usr/bin/env -S deno run --allow-run --allow-read

import { fromFileUrl } from "./deps/path.ts";
import { debug, enumerate, gunzip, read, run, toLines } from "../../mod3.ts";

console.time("count");

export function splitOnWords(lines: AsyncIterable<string>) {
  return enumerate(lines)
    .filterNot((line) => line.length === 0)
    .map((it) => it.toLocaleLowerCase())
    // .transform(debug<string>)
    .flatMap((it) =>
      [...it.matchAll(/(\p{L}|\p{N}|['’-])+/gu)].map((a) => a[0])
    )
    //.transform(debug<string>)
    .filterNot((it) =>
      /^['’-]+$/.test(it) || /[0-9]/.test(it) || /CHAPTER/.test(it)
    );
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
  .transform(splitOnWords);
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

// zcat ./warandpeace.txt.gz \
//   | tr '[:upper:]' '[:lower:]' \
//   | grep -oE "(\\w|'|’|-)+" \
//   | wc -l

// #count unique words
// zcat ./warandpeace.txt.gz \
//   | tr '[:upper:]' '[:lower:]' \
//   | grep -oE "(\\w|'|’|-)+" \
//   | sort \
//   | uniq \
//   | wc -l

async function blah() {
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
}
await blah();

await run(
  "/bin/bash",
  "-c",
  ` set -e
    zcat ${fromFileUrl(import.meta.resolve("./warandpeace.txt.gz"))} \
      | tr '[:upper:]' '[:lower:]' \
      | grep -oE "(\\w|'|’|-)+" \
      | sort \
      | uniq \
      | wc -l
  `,
)
  .lines
  .forEach((line) => console.log(line));
