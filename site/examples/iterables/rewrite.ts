import { read } from "@j50n/proc";

// Rewrite fruit.txt in place: atomic writes a new file and renames it over
// the old one, so reading the old one while writing works.
await read("fruit.txt")
  .lines
  .map((line) => line.toUpperCase())
  .writeTo("fruit.txt", { atomic: true });

console.log((await Deno.readTextFile("fruit.txt")).trimEnd());
