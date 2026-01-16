#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { run } from "../../mod.ts";

const benchmarkScript =
  new URL("../../benchmarks/flatdata-throughput.ts", import.meta.url).pathname;

await run(
  "deno",
  "run",
  "--allow-read",
  "--allow-write",
  "--allow-run",
  benchmarkScript,
)
  .toStdout();
