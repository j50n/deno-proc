import { run } from "@j50n/proc";

// `yes` prints "y" forever; taking three stops it.
const ys = await run("yes").lines.take(3).collect();
console.log(ys);
