import { enumerate } from "@j50n/proc";
import { toCsv } from "@j50n/proc/transforms";

const rows = [
  ["item", "note"],
  ["Widget, large", 'says "hi"'],
  ["Bolt", "two\nlines"],
  ["Nut", " spaces kept "],
];

await enumerate(rows).transform(toCsv()).toStdout();
console.log("--");
await enumerate(rows).transform(toCsv({ separator: ";" })).toStdout();
