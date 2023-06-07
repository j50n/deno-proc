#!/usr/bin/env -S deno run --allow-run --allow-read

import { Command, toChunkedLines } from "../mod3.ts";

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
    const lines of toChunkedLines(process.stdout)
  ) {
    for (const line of lines) {
      console.log(line);
    }
  }
} finally {
  await process.close();
}
