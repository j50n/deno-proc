import { read, toBytes } from "@j50n/proc";

// Copy the error lines into a file of their own.
await read("app.log")
  .lines
  .filter((line) => line.includes("ERROR"))
  .transform(toBytes) // lines back to bytes, a "\n" after each
  .writeTo("errors.txt");

console.log(await read("errors.txt").lines.collect());
