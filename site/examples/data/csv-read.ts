import { read } from "@j50n/proc";
import { fromCsvToRows } from "@j50n/proc/transforms";

const rows = await read("data-orders.csv")
  .transform(fromCsvToRows())
  .flatten()
  .drop(1) // the header
  .collect();

console.log(rows);
