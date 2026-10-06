import { read } from "@j50n/proc";

const counts = new Map<string, number>();

await read("recipes-warandpeace.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .chunkedLines // arrays of lines: one await per chunk, not one per word
  .forEach((lines) => {
    for (const line of lines) {
      for (const word of line.toLowerCase().match(/[a-z]+/g) ?? []) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  });

const top = [...counts].sort(([, a], [, b]) => b - a).slice(0, 3);
console.log(top);
