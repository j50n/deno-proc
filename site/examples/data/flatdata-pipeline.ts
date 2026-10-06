import { read } from "@j50n/proc";
import { fromRecordToRows } from "@j50n/proc/transforms";

// Installed, the command is just "flatdata". Here it runs from the package.
const flatdata = import.meta.resolve("@j50n/proc/flatdata");

await read("data-orders.csv")
  .run("deno", "run", flatdata, "csv2record") // parses in the child process
  .transform(fromRecordToRows())
  .flatten()
  .drop(1) // the header
  .map(([id, customer, item]) => `${id} ${customer}: ${item}`)
  .toStdout();
