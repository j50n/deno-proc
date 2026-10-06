import { enumerate } from "@j50n/proc";
import { toTsv } from "@j50n/proc/transforms";

const rows = [["id", "note"], ["1", "tab\there"], ["2", "two\r\nlines"]];

// TSV can't hold a tab, CR, or LF in a field. If yours might, replace them.
await enumerate(rows)
  .map((row) => row.map((field) => field.replace(/[\t\r\n]+/g, " ")))
  .transform(toTsv())
  .toStdout();
