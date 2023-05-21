#!/usr/bin/env -S deno run --quiet --allow-run=deno,find,sed,udd

/*
 * `proc` uses `proc` to build itself.
 */

import * as proc from "./mod.ts";
import { dirname } from "./runners/utility.ts";

async function findAllTypescriptFiles(): Promise<string[]> {
  return await proc.runSa(
    { cmd: ["find", dirname(import.meta), "-name", "*.ts"] },
  );
}

async function updateDependencies(): Promise<void> {
  await proc.run0({ cmd: ["udd", ...(await findAllTypescriptFiles())] });
}

async function format(): Promise<void> {
  await proc.run0({ cmd: ["deno", "fmt", dirname(import.meta)] });

  /* Fix breaks to legacy shebang caused by deno formatter. */
  await proc.run0(
    {
      cmd: [
        "sed",
        "-i",
        '2s|^":";\\s[/][/]#;|":" //#;|',
        ...(await findAllTypescriptFiles()),
      ],
    },
  );
}

async function lint(): Promise<void> {
  await proc.run0({ cmd: ["deno", "lint", dirname(import.meta)] });
}

async function check(): Promise<void> {
  await proc.run0({
    cmd: ["deno", "check", ...(await findAllTypescriptFiles())],
  });
}

async function test(): Promise<void> {
  await proc.run0({
    cmd: [
      "deno",
      "test",
      "--check",
      "--allow-run",
      "--reload",
      dirname(import.meta),
    ],
  });
}

await updateDependencies();
await format();
await lint();
await check();
await test();
