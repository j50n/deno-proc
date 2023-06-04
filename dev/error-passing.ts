#!/usr/bin/env -S deno run --allow-run --allow-read

/*
 * Errors are not being passed. Let's see if we can figure out why.
 *
 * This gathers the stdout and then throws the error - if working properly.
 */

import { Command, toLines } from "../mod3.ts";

const results: string[] = [];

const process = new Command(
  { stdout: "piped", stdin: "piped" },
  "cat",
  "-",
)
  .spawn();

(async () => {
  try {
    for (const line of ["A", "B", "C", "D"]) {
      await process.stdin.write([line]);
    }
  } finally {
    await process.stdin.close(new Error("This is a test."));
  }
})();

try {
  for await (
    const lines of toLines(process.stdout)
  ) {
    for (const line of lines) {
      results.push(line);
    }
  }
} finally {
  await process.close();
  console.dir(results);
}
