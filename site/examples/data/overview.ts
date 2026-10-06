import { read } from "@j50n/proc";
import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";

await read("data-orders.csv")
  .transform(fromCsvToRows()) // bytes in, batches of rows out
  .flatten() // one row at a time
  .filter((row) => row[3] !== "1") // row is a string[]
  .transform(toTsv()) // rows in, bytes out
  .toStdout();
