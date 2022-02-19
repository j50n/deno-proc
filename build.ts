#!/usr/bin/env -S deno run --quiet --allow-run

import * as proc from "./mod.ts";
import { dirname } from "./runners/utility.ts";

async function findAllTypescriptFiles(): Promise<string[]> {
  return await proc.run0Sa(
    { cmd: ["find", dirname(import.meta), "-name", "*.ts"] },
  );
}

async function updateDependencies(): Promise<void> {
  await proc.run00({ cmd: ["udd", ...(await findAllTypescriptFiles())] });
}

async function format(): Promise<void> {
  await proc.run00({ cmd: ["deno", "fmt", dirname(import.meta)] });

  /* Fix breaks to legacy shebang caused by deno formatter. */
  await proc.run00(
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
  await proc.run00({ cmd: ["deno", "lint", dirname(import.meta)] });
}

async function test(): Promise<void> {
  await proc.run00({
    cmd: ["deno", "test", "--allow-run", "--reload", dirname(import.meta)],
  });
}

await updateDependencies();
await format();
await lint();
await test();
