import { read } from "@j50n/proc";

// Rewrite fruit.txt in place: write a new file, then rename it over the old.
const path = "fruit.txt";
const temp = `${path}.tmp`;
await read(path).lines.map((line) => line.toUpperCase()).writeTo(temp);
await Deno.rename(temp, path);

console.log((await Deno.readTextFile(path)).trimEnd());
