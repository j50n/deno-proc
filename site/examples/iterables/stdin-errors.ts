import { enumerate } from "@j50n/proc";

// Print the lines of stdin that mention ERROR.
await enumerate(Deno.stdin.readable)
  .lines
  .filter((line) => line.includes("ERROR"))
  .toStdout();
