import { enumerate, read, toBytes } from "@j50n/proc";

// Strings are written as lines; bytes as they are.
await enumerate(["one", "two"]).toStdout();
await read("fruit.txt").toStdout();

// writeTo() closes what it writes to, unless told not to.
await enumerate(["three"])
  .transform(toBytes)
  .writeTo(Deno.stdout.writable, { noclose: true });
console.log("stdout is still open");
