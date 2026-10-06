import { enumerate } from "@j50n/proc";
import { fromCsvToRows, toCsv } from "@j50n/proc/transforms";

async function parse(text: string): Promise<string> {
  try {
    const rows = await enumerate([new TextEncoder().encode(text)])
      .transform(fromCsvToRows())
      .flatten()
      .collect();
    return JSON.stringify(rows);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const inputs = [
  "a,b\r\nc,d", // CRLF; no line end on the last row
  "a\n\n\nb\n", // blank lines are skipped
  ",a,,\n", // empty fields
  '""\n', // one empty field: a row, not a blank line
  'a,"x\ny, ""z"""\n', // quoted line break, separator, quotes
  "a\nb,c,d\n", // rows may differ in length
  ' a , "b"\n', // spaces are kept, so this quote is text
  'a"b,c\n', // a quote inside an unquoted field is text
  '"ab" ,c\n', // text after a closing quote is kept
  'a,"bc\nd,e\n', // an unclosed quote runs to the end of the input
  '"x\ry",z\n', // a CR inside quotes is text
  "a,b\rc,d\r", // a lone CR outside quotes is an error
];
for (const text of inputs) {
  console.log(JSON.stringify(text).padEnd(26), await parse(text));
}

// toCsv writes a row holding one empty field as "", so it survives.
const text = await enumerate([["a"], [""], ["b"]])
  .transform(toCsv())
  .map((bytes) => new TextDecoder().decode(bytes))
  .reduce((all, chunk) => all + chunk, "");
console.log(JSON.stringify(text), await parse(text));
