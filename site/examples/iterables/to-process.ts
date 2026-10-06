import { enumerate, WritableIterable } from "@j50n/proc";

// The command starts now, and reads its stdin as items are written.
const input = new WritableIterable<string>();
const sorted = enumerate(input).run("sort").lines.collect();

for (const fruit of ["pear", "apple", "fig"]) {
  await input.write(fruit);
}
await input.close(); // sort sees the end of its input

console.log(await sorted);
