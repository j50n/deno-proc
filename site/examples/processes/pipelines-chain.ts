import { run } from "@j50n/proc";

// cut -d " " -f 3 app.log | sort | uniq -c
const counts = await run("cut", "-d", " ", "-f", "3", "app.log")
  .run("sort")
  .run("uniq", "-c")
  .lines
  .map((line) => line.trim())
  .collect();

console.log(counts);
