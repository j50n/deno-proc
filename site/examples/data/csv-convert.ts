import { read } from "@j50n/proc";
import { csvToTsv, tsvToCsv } from "@j50n/proc/transforms";

// Bytes to bytes, with no rows in between.
await read("data-orders.csv").transform(csvToTsv()).writeTo("orders.tsv");
await read("orders.tsv").transform(tsvToCsv({ separator: ";" })).toStdout();
