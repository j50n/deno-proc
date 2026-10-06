import { read } from "@j50n/proc";
import { fromCsvToLazyRows, toCsv } from "@j50n/proc/transforms";

await read("data-orders.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
  .drop(1) // the header
  .filter((row) => Number(row.getField(3)) > 1) // decodes field 3 only
  .map((row) => {
    row.setField(1, row.getField(1).toUpperCase());
    return row;
  })
  .transform(toCsv()) // takes LazyRows as they are
  .toStdout();
