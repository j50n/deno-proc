import { read } from "@j50n/proc";

const errors = await read("app.log") // a source: the file's bytes
  .lines // a step: bytes to lines of text
  .filter((line) => line.includes("ERROR")) // another step
  .count(); // the consumer: pulls everything through

console.log(errors);
