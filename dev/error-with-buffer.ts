#!/usr/bin/env -S deno run --allow-run --allow-read

import { Process, toChunkedLines } from "../mod.ts";

const process = new Process(
  { stdout: "piped", stdin: "piped" },
  "cat",
  ["-"],
);

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
