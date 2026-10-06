import { run } from "@j50n/proc";

const errors = await run("grep", "ERROR", "app.log").lines.collect();

console.log(`${errors.length} errors`);
for (const line of errors) {
  console.log(line);
}
