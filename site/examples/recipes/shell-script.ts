import { type Enumerable, read, run } from "@j50n/proc";

/** Like `$(...)`: all the output as one string, without the last newline. */
async function text(output: Enumerable<Uint8Array>): Promise<string> {
  return (await output.lines.collect()).join("\n");
}

const dir = "recipes-exports";
const files: string[] = [];
for await (const entry of Deno.readDir(dir)) {
  if (entry.name.endsWith(".csv")) files.push(entry.name);
}
files.sort(); // a glob is sorted; readDir is not

const manifest: string[] = [];
for (const name of files) {
  const f = `${dir}/${name}`;
  const rows = await read(f).lines.drop(1).count();
  const refunds = await read(f).lines.count((l) => l.endsWith(",refunded"));
  const sum = await text(run("sha256sum", f).run("cut", "-c", "1-12"));
  manifest.push(`${name} rows=${rows} refunds=${refunds} sha256=${sum}`);
  await run("gzip", "-f", f).collect();
}

await Deno.writeTextFile("manifest.txt", manifest.join("\n") + "\n");
await read("manifest.txt").toStdout(); // cat manifest.txt
