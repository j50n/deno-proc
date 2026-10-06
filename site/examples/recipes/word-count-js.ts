import { read } from "@j50n/proc";

const counts = new Map<string, number>();

await read("recipes-warandpeace.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .flatMap((line) => line.toLowerCase().match(/[a-z]+/g) ?? [])
  .forEach((word) => {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });

const top = [...counts].sort(([, a], [, b]) => b - a).slice(0, 10);
for (const [word, count] of top) {
  console.log(`${String(count).padStart(7)} ${word}`);
}
