import { run } from "@j50n/proc";

const messages = await run("cat", "app.log")
  .lines
  .filter((line) => line.includes(" ERROR "))
  .map((line) => line.slice(26)) // drop the timestamp and level
  .run("sort", "-f") // -f: ignore case
  .lines
  .collect();

console.log(messages);
