#!/usr/bin/env -S deno run --allow-run --allow-read

import { enumerate, gunzip, range, run, toBytes } from "../../mod.ts";
import { buffer } from "../../src/transformers.ts";

await range({ to: 3 })
  .forEach((line) => console.log(line.toString()));

await range({ to: 3 })
  .map((n) => n.toString())
  .transform(toBytes)
  .transform(buffer(8192))
  .writeTo(Deno.stdout.writable, { noclose: true });

await run("ls", "-la")
  .writeTo(Deno.stdout.writable, { noclose: true });

console.log(
  await enumerate(Deno.stdin.readable)
    .transform(gunzip)
    .lines
    .filter((line) => line.trim().length === 0)
    .count(),
);

for await (const line of run("ls", "-la").lines) {
  console.log(line);
}
