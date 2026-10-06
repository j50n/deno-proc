import { enumerate } from "@j50n/proc";

const sorted = await enumerate(["pear", "apple", "fig"])
  .run("sort")
  .lines
  .collect();
console.log(sorted);

// Only text and bytes can be written; turn anything else into strings first.
const numbers = await enumerate([10, 9, 100])
  .map((n) => `${n}`)
  .run("sort", "-n")
  .lines
  .collect();
console.log(numbers);
