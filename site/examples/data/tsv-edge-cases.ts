import { enumerate } from "@j50n/proc";
import { fromTsvToRows } from "@j50n/proc/transforms";

async function parse(text: string): Promise<string> {
  const rows = await enumerate([new TextEncoder().encode(text)])
    .transform(fromTsvToRows())
    .flatten()
    .collect();
  return JSON.stringify(rows);
}

const inputs = [
  "a\tb\r\nc\td", // CRLF; no line end on the last row
  "a\n\nb\n", // blank lines are skipped
  "\t\n", // but a lone tab is two empty fields
  '"a\tb"\tc\n', // quotes are text, so they don't protect the tab
  "a\t\tb\t\n", // empty fields
];
for (const text of inputs) {
  console.log(JSON.stringify(text).padEnd(18), await parse(text));
}
