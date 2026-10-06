import { enumerate } from "@j50n/proc";
import { toRecord } from "@j50n/proc/transforms";

const notes = [
  ["1", "first line\nsecond line"],
  ["2", "a\ttab"],
];

// awk splits records on \036 (\x1E) and fields on \037 (\x1F).
const summary = await enumerate(notes)
  .transform(toRecord())
  .run(
    "awk",
    'BEGIN { RS = "\\036"; FS = "\\037" } { print $1 ": " length($2) }',
  )
  .lines
  .collect();

console.log(summary);
