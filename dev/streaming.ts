#!/usr/bin/env -S deno run --allow-run --allow-read

/*
 * Packets are getting lost. I need to find them.
 *
 * If this runs consistently and gives the right number of bytes, all is well.
 *
 * Found the bug using different colors for my `console.error()` calls from
 * different parts of the stream. It really helped me to see how the concurrency
 * was playing. Another addition to my bag of tricks.
 */

import { enumerate, toChunkedLines } from "../mod.ts";
import { path } from "./deps.ts";

const file = await Deno.open(
  path.fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
);

await enumerate(file.readable)
  .run("gunzip")
  .run("grep", "-v", "^$")
  .run("head")
  .transform(toChunkedLines)
  .flatten()
  .forEach((line) => console.log(line));

// let bytes = 0;
// let count = 0;

// await runnable(file.readable)
//   .run("gunzip")
//   .forEach((b) => {
//     bytes += b.length;
//     count += 1;
//     console.log(colors.gray(`\t${count}: ${b.length} (${bytes})`));
//   });

// console.log(`Total Bytes: ${bytes}; Count: ${count}`);
