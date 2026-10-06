import { enumerate } from "@j50n/proc";
import { fromCsvToRows, toCsv } from "@j50n/proc/transforms";

async function parse(text: string): Promise<string> {
  const rows = await enumerate([new TextEncoder().encode(text)])
    .transform(fromCsvToRows())
    .flatten()
    .collect();
  return JSON.stringify(rows);
}

const inputs = [
  "a,b\r\nc,d", // CRLF; no line end on the last row
  "a,b\rc,d\r", // a lone CR ends a row too
  "a\n\n\nb\n", // blank lines are skipped
  ",a,,\n", // empty fields
  '""\n', // one empty field: a row, not a blank line
  'a,"x\ny, ""z"""\n', // quoted line break, separator, quotes
  "a\nb,c,d\n", // rows may differ in length
  ' a , "b"\n', // spaces are kept, so this quote is text
  'a"b,c\n', // a quote inside an unquoted field is text
  'a,"bc\nd,e\n', // an unclosed quote runs to the end of the input
];
for (const text of inputs) {
  console.log(JSON.stringify(text).padEnd(26), await parse(text));
}

// toCsv writes a row holding one empty field as a blank line,
// so it doesn't survive a round trip.
const chunks = await enumerate([["a"], [""], ["b"]])
  .transform(toCsv())
  .map((bytes) => new TextDecoder().decode(bytes))
  .collect();
console.log(JSON.stringify(chunks.join("")), await parse(chunks.join("")));
