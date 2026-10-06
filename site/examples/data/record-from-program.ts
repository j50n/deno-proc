import { run } from "@j50n/proc";
import { fromRecordToRows } from "@j50n/proc/transforms";

// printf writes \037 between fields and \036 after each record.
const rows = await run(
  "printf",
  "Ada\\037line one\\nline two\\036Grace\\037\\036",
)
  .transform(fromRecordToRows())
  .flatten()
  .collect();

console.log(rows);

// A newline after the last record, as echo adds, is a record of its own.
const withNewline = await run("sh", "-c", "printf 'a\\037b\\036'; echo")
  .transform(fromRecordToRows())
  .flatten()
  .collect();

console.log(withNewline);
