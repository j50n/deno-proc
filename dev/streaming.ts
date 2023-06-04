#!/usr/bin/env -S deno run --allow-run --allow-read

/*
 * Packets are getting lost. I need to find them.
 *
 * If this runs consistently and gives the right number of bytes, all is well.
 */

import { runnable } from "../mod3.ts";
import { colors, path } from "./deps.ts";

const file = await Deno.open(
  path.fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
);

let bytes = 0;
let count = 0;

await runnable(file.readable)
  .run("gunzip")
  .forEach((b) => {
    bytes += b.length;
    count += 1;
    console.log(colors.gray(`\t${count}: ${b.length} (${bytes})`));
  });

console.log(`Total Bytes: ${bytes}; Count: ${count}`);
