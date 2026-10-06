import { enumerate } from "@j50n/proc";
import { toCsv, toTsv } from "@j50n/proc/transforms";

const rows = [["id", "note"], ["1", "line one\nline two"]];

try {
  await enumerate(rows).transform(toTsv()).toStdout();
} catch (error) {
  if (error instanceof Error) console.log(`[${error.message}]`);
}

// CSV can hold it: the field is quoted.
await enumerate(rows).transform(toCsv()).toStdout();
