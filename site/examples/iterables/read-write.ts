import { read } from "@j50n/proc";

// Copy the error lines into a file of their own.
await read("app.log")
  .lines
  .filter((line) => line.includes("ERROR"))
  .writeTo("errors.txt"); // each line written with a "\n"

console.log(await read("errors.txt").lines.collect());
