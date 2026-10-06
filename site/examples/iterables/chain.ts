import { read } from "@j50n/proc";

// How many lines at each level, leaving out INFO.
const levels = await read("app.log")
  .lines
  .map((line) => line.split(/\s+/)[2]) // "INFO", "ERROR", "WARN"
  .filterNot((level) => level === "INFO")
  .reduce(
    (counts, level) => counts.set(level, (counts.get(level) ?? 0) + 1),
    new Map<string, number>(),
  );

console.log(levels);
