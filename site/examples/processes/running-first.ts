import { run } from "@j50n/proc";

const lines = await run("head", "-n", "3", "app.log").lines.collect();

console.log(lines);
