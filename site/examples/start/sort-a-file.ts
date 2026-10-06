import { read } from "@j50n/proc";

const sorted = await read("fruit.txt").run("sort").lines.collect();
console.log(sorted);
