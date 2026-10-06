import { read } from "@j50n/proc";
import { fromCsvToRows } from "@j50n/proc/transforms";

const rows = await read("people.csv")
  .transform(fromCsvToRows()) // yields batches: arrays of rows
  .flatten() // one row at a time
  .collect();

console.log(rows);
