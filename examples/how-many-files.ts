#!/usr/bin/env -S deno run --allow-run=ls,wc --quiet --allow-read

import { first } from "../deps/asynciter.ts";
import { resolve } from "../deps/path.ts";
import { run } from "../proc.ts";

/*
 * This is the equivalent of running `ls -1 | wc -l`. In other words, give me all the file
 * and folder names in the current folder, each on their own line; then count the number of
 * lines.
 */

const fileCount = await first(
  run({ cmd: ["ls", "-1"] })
    .pipe(run({ cmd: ["wc", "-l"] }))
    .stdoutLines(),
);

console.info(
  `Total number of files and folders in ${resolve(".")} is ${
    parseInt(fileCount!, 10)
  }.`,
);
