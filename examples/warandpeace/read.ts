#!/usr/bin/env -S deno run --allow-run=spd-say,fmt

import * as proc from "../../mod.ts";

const pg = proc.group();
try {
  for await (const text of proc.toLines(proc.readerToBytes(Deno.stdin))) {
    if (text.trim().length > 0) {
      console.log();
      console.log(
        await proc.runner(proc.stringInput(), proc.stringOutput())(pg).run({
          cmd: ["fmt", "-w", "80"],
        }, text.trim()),
      );
      await proc.simpleRunner(pg).run({
        cmd: ["spd-say", "-w", "-t", "female3", text.trim()],
      });
    }
    await proc.sleep(500);
  }
} finally {
  pg.close();
}
