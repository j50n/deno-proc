import { debug, read } from "@j50n/proc";

// Print each item as it passes this point, then carry on.
const b = await read("fruit.txt")
  .lines
  .transform(debug<string>)
  .filter((fruit) => fruit.startsWith("b"))
  .collect();

console.log(b);
