#!/usr/bin/env -S deno run -A

/**
 * Run a book example the way `tests/book_examples.test.ts` does, in a fresh
 * directory holding copies of `site/examples/fixtures/`, and print its output.
 *
 * With `--save`, also write that output to the `.out` file beside it, which the
 * page shows and the test compares against. Read the output before saving it:
 * the test can only check that the page stays true to what you saved.
 *
 *     deno run -A tools/book-example.ts [--save] site/examples/topic/name.ts
 */

import { copy } from "jsr:@std/fs@1/copy";
import { resolve } from "jsr:@std/path@1/resolve";

const save = Deno.args.includes("--save");
const files = Deno.args.filter((arg) => arg !== "--save").map((f) =>
  resolve(f)
);
const fixtures = new URL("../site/examples/fixtures/", import.meta.url);
const config = new URL("../deno.json", import.meta.url).pathname;

for (const file of files) {
  const dir = await Deno.makeTempDir();
  try {
    await copy(fixtures, dir, { overwrite: true });
    const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
      args: ["run", "--check", "--quiet", "-A", "--config", config, file],
      cwd: dir,
      env: { NO_COLOR: "1" },
    }).output();

    console.log(`== ${file} (exit ${code})`);
    await Deno.stdout.write(stdout);
    await Deno.stderr.write(stderr);
    if (save && code === 0) {
      await Deno.writeFile(file.replace(/\.ts$/, ".out"), stdout);
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}
