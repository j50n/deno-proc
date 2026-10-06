import { enumerate } from "@j50n/proc";
import { fromCsvToLazyRows } from "@j50n/proc/transforms";

// 100,000 orders; every tenth is from New Zealand.
const csv = Array.from(
  { length: 100_000 },
  (_, i) => `${i},customer${i},${i % 10 === 0 ? "NZ" : "US"},${i % 97}\n`,
).join("");
const orders = () =>
  enumerate([new TextEncoder().encode(csv)]).transform(fromCsvToLazyRows());

// Row by row: every step after .flatten() is an await per row.
const rowByRow = await orders()
  .flatten()
  .filter((row) => row.fieldEquals(2, "NZ"))
  .count();

// A batch at a time: plain array methods inside one step per batch.
const byBatch = await orders()
  .map((rows) => rows.filter((row) => row.fieldEquals(2, "NZ")))
  .flatten()
  .count();

console.log(rowByRow, byBatch);
