#!/usr/bin/env -S deno run --allow-run=bash --quiet
import * as proc from "../../mod.ts";

const pg = proc.group();
try {
  await proc.runner(proc.emptyInput(), proc.stringOutput()).run(pg, {
    cmd: ["bash", "-c", "exit 1"],
  });
} catch (e) {
  if (e instanceof proc.ProcessExitError) {
    console.log(e.message);
    console.log(e.code);
    console.log(e.name);
    console.dir(e.options);
    console.log();
  }
  throw e;
} finally {
  pg.close();
}
