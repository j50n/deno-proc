import { enumerate } from "@j50n/proc";
import { fromCsvToRows } from "@j50n/proc/transforms";

// A space after the closing quote on the third line.
const text = 'id,name\n1,Ada\n"2" ,Grace\n3,Linus\n';

const rows = await enumerate([new TextEncoder().encode(text)])
  .transform(fromCsvToRows())
  .flatten()
  .collect();

console.log(rows); // no error, and most of the data is gone
