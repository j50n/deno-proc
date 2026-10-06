import { read } from "@j50n/proc";
import { fromCsvToLazyRows, toCsv } from "@j50n/proc/transforms";

await read("data-orders.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
  .drop(1) // the header
  .filter((row) => !row.fieldEquals(3, "1")) // compares bytes; decodes nothing
  .map((row) => {
    const fields = row.toStringArray(); // a LazyRow can't change; its array can
    fields[1] = fields[1].toUpperCase();
    return fields;
  })
  .transform(toCsv())
  .toStdout();
