import { run } from "@j50n/proc";

// Lines arrive in arrays, one per chunk read. A step works on the whole
// array, and .run() writes each array to the next command in one go.
const count = await run("seq", "1", "1000000")
  .chunkedLines
  .map((lines) => lines.filter((line) => !line.endsWith("7")))
  .run("wc", "-l")
  .lines
  .first;

console.log(count);
