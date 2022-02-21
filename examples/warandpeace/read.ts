#!/usr/bin/env -S deno run --allow-run=spd-say,fmt

import * as proc from "../../mod.ts";

for await (
  const text of proc.bytesToTextLines(proc.readerToBytes(Deno.stdin))
) {
  if (text.trim().length > 0) {
    console.log();
    console.log(
      await proc.runner(proc.stringInput(), proc.stringOutput())().run({
        cmd: ["fmt", "-w", "80"],
      }, text.trim()),
    );
    await proc.run0({
      cmd: ["spd-say", "-w", "-t", "female3", text.trim()],
    });
  }
  await proc.sleep(500);
}
