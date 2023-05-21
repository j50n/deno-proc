#!/usr/bin/env -S deno run --unstable --quiet --reload --allow-run=sleep

import { emptyInput, group, runner, sleep, stringOutput } from "./deps.ts";

/*
 * Sleep for 60 seconds. The `sleep` command does not output anything, so we are just
 * ignoring the output.
 */
await runner(emptyInput(), stringOutput())(group()).run({
  cmd: ["sleep", "10"],
});

/*
 * Of course, the same thing can be done using pure JavaScript.
 */
await sleep(10000);
