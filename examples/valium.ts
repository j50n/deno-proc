#!/usr/bin/env -S deno run --unstable --quiet --reload --allow-run=sleep

import { emptyInput, group, runner, stringOutput } from "./deps.ts";

/*
 * Sleep for 60 seconds. The `sleep` command does not output anything, so we are just
 * ignoring the output.
 */

const pg = group();
try {
  await runner(emptyInput(), stringOutput()).run(pg, { cmd: ["sleep", "60"] });
} finally {
  pg.close();
}
