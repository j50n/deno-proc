import { enumerate, read } from "@j50n/proc";
import { fromCsvToRows, toJson } from "@j50n/proc/transforms";

// toJson takes batches, which is what the parsers yield.
await read("data-orders.csv")
  .transform(fromCsvToRows())
  .map((batch) =>
    batch
      .filter((row) => row[0] !== "id") // the header
      .map(([id, customer, , qty]) => ({ id, customer, qty: Number(qty) }))
  )
  .transform(toJson())
  .toStdout();

// After .flatten(), wrap each value in a batch of one.
await enumerate([{ total: 13 }])
  .map((value) => [value])
  .transform(toJson())
  .toStdout();
