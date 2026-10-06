import { enumerate, read } from "@j50n/proc";
import { fromCsvToRows, toJson } from "@j50n/proc/transforms";

// toJson takes one value per item, so flatten the parser's batches first.
await read("data-orders.csv")
  .transform(fromCsvToRows())
  .flatten()
  .drop(1) // the header
  .map(([id, customer, , qty]) => ({ id, customer, qty: Number(qty) }))
  .transform(toJson())
  .toStdout();

// A value with no JSON form is refused, naming the item.
try {
  await enumerate([{ total: 13 }, undefined]).transform(toJson()).toStdout();
} catch (error) {
  if (error instanceof TypeError) console.log(error.message);
}
