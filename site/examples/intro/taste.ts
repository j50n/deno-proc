import { run } from "@j50n/proc";

// cat app.log | grep ERROR | cut -c 21-
const errors = await run("cat", "app.log")
  .run("grep", "ERROR")
  .run("cut", "-c", "21-")
  .lines
  .collect();

console.log(errors);
