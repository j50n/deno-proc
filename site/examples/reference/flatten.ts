import { read } from "@j50n/proc";
import { fromCsvToRows } from "@j50n/proc/transforms";

const batches = await read("people.csv").transform(fromCsvToRows()).count();
const rows = await read("people.csv").transform(fromCsvToRows()).flatten()
  .count();

console.log({ batches, rows });
