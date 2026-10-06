/**
 * Every example in the book is a file in `site/examples/`, pulled into its page
 * with `{{#include}}`. These tests type-check all of them, then run each one in
 * a fresh directory holding copies of the files in `site/examples/fixtures/`,
 * and compare what it prints with the `.out` file beside it (the page shows
 * that too). An example with no `.out` file only has to succeed.
 */

import { assertEquals } from "@std/assert";
import { copy } from "@std/fs/copy";
import { walk } from "@std/fs/walk";
import { enumerate } from "../mod.ts";

const examples = new URL("../site/examples/", import.meta.url);
const fixtures = new URL("fixtures/", examples);
const config = new URL("../deno.json", import.meta.url).pathname;
const decoder = new TextDecoder();

const files: string[] = [];
for await (
  const entry of walk(examples, { exts: [".ts"], skip: [/\/fixtures\//] })
) {
  files.push(entry.path);
}
files.sort();

Deno.test("Every book example type-checks.", async () => {
  const { code, stderr } = await new Deno.Command(Deno.execPath(), {
    args: ["check", "--quiet", "--config", config, ...files],
    env: { NO_COLOR: "1" },
  }).output();
  assertEquals(code, 0, decoder.decode(stderr));
});

Deno.test("Every book example prints what its page shows.", async () => {
  const failures = await enumerate(files)
    .concurrentUnorderedMap(runExample, {
      concurrency: navigator.hardwareConcurrency,
    })
    .filter((failure) => failure !== undefined)
    .collect();

  assertEquals(failures, []);
});

/** Run one example; return what went wrong, or `undefined` if nothing did. */
async function runExample(file: string): Promise<string | undefined> {
  const name = file.slice(examples.pathname.length);
  const dir = await Deno.makeTempDir();
  try {
    await copy(fixtures, dir, { overwrite: true });

    const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
      args: ["run", "--no-check", "--quiet", "-A", "--config", config, file],
      cwd: dir,
      env: { NO_COLOR: "1" },
    }).output();
    const printed = decoder.decode(stdout);

    if (code !== 0) {
      return `${name} exited with ${code}:\n${decoder.decode(stderr)}`;
    }
    const expected = await Deno.readTextFile(file.replace(/\.ts$/, ".out"))
      .catch(() => undefined);
    if (expected !== undefined && printed !== expected) {
      return `${name} printed:\n${printed}\ninstead of:\n${expected}`;
    }
    return undefined;
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}
