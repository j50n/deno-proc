import { read } from "@j50n/proc";
import { fromCsvToRows } from "@j50n/proc/transforms";

// The header is the first row, like any other.
let header: string[] = [];
const orders = await read("data-orders.csv")
  .transform(fromCsvToRows())
  .flatten()
  .enum()
  .filter(([row, index]) => {
    if (index === 0) header = row;
    return index > 0;
  })
  .map(([row]) => Object.fromEntries(header.map((name, i) => [name, row[i]])))
  .collect();

console.log(orders);

// Or skip it.
const quantities = await read("data-orders.csv")
  .transform(fromCsvToRows())
  .flatten()
  .drop(1)
  .map((row) => Number(row[3]))
  .collect();

console.log(quantities);
