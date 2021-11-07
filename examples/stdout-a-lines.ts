#!/usr/bin/env -S deno run --allow-run=ls --quiet

import { run } from "../proc.ts";

/*
 * List the files in the current directory, line by line.
 */

for await (const line of run({ cmd: ["ls", "-la"] }).stdoutLines()) {
  console.log(line);
}
