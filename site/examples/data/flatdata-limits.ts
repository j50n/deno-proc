import { enumerate } from "@j50n/proc";
import { fromTsvToRows } from "@j50n/proc/transforms";

const flatdata = import.meta.resolve("@j50n/proc/flatdata");
const csv = (text: string) => enumerate([new TextEncoder().encode(text)]);

// A tab inside a quoted CSV field goes into the TSV as it is: one more field.
const rows = await csv('"a\tb",c\n')
  .run("deno", "run", flatdata, "csv2tsv")
  .transform(fromTsvToRows())
  .flatten()
  .collect();
console.log(rows);

// Text after a closing quote: no output, and exit code 0.
const lines = await csv('a,b\n"x" ,y\nc,d\n')
  .run("deno", "run", flatdata, "csv2tsv")
  .lines
  .collect();
console.log(lines);
