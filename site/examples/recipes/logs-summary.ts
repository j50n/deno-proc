import { enumerate, read } from "@j50n/proc";

const files = ["app.log.2.gz", "app.log.1.gz", "app.log"]
  .map((name) => `recipes-logs/${name}`);

const perDay = new Map<string, number>();
const perSource = new Map<string, number>();

await enumerate(files)
  .flatMap((path) =>
    path.endsWith(".gz")
      ? read(path).transform(new DecompressionStream("gzip")).lines
      : read(path).lines
  )
  .filter((line) => line.slice(20, 25) === "ERROR")
  .forEach((line) => {
    // 2026-10-05 09:01:13 ERROR db: connection refused
    const day = line.slice(0, 10);
    const source = line.slice(26).split(":")[0];
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    perSource.set(source, (perSource.get(source) ?? 0) + 1);
  });

console.log("errors per day:", Object.fromEntries(perDay));
const ranked = [...perSource].sort(([, a], [, b]) => b - a);
console.log("by source:", ranked.map(([s, n]) => `${s} ${n}`).join(", "));
