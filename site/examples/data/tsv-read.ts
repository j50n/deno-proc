import { read } from "@j50n/proc";
import { fromTsvToRows } from "@j50n/proc/transforms";

const big = await read("data-orders.tsv")
  .transform(fromTsvToRows())
  .flatten()
  .drop(1) // the header
  .filter((row) => Number(row[3]) > 1)
  .map(([, customer, item]) => `${customer}: ${item}`)
  .collect();

console.log(big);
