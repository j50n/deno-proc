#!/usr/bin/env -S deno run --unstable --quiet --reload --allow-run=sleep

import { emptyInput, proc, procGroup, stringOutput } from "./deps.ts";

/*
 * Sleep for 60 seconds. The `sleep` command does not output anything, so we are just
 * ignoring the output.
 */

const pg = procGroup();
try {
  await proc(emptyInput(), stringOutput()).run(pg, { cmd: ["sleep", "60"] });
} finally {
  pg.close();
}
