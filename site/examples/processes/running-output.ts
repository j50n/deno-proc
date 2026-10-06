import { concat, run } from "@j50n/proc";

// Every line, in an array.
const all = await run("cat", "fruit.txt").lines.collect();
console.log(all);

// One line at a time, as the command writes them.
for await (const line of run("cat", "fruit.txt").lines) {
  console.log(`- ${line}`);
}

// Only the first line.
const first = await run("cat", "fruit.txt").lines.first;
console.log(first);

// Raw bytes, in chunks as they arrive; `concat` joins them.
const chunks = await run("cat", "app.log.gz").collect();
console.log(`${concat(chunks).length} bytes`);

// Straight to this program's stdout, unchanged.
await run("cat", "fruit.txt").toStdout();
