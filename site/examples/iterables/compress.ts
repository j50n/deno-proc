import { enumerate, run } from "@j50n/proc";

const files = ["a.txt", "b.txt", "c.txt"];
for (const file of files) {
  await Deno.writeTextFile(file, `${file}\n`.repeat(10_000));
}

// Up to two gzip processes at a time.
const results = await enumerate(files)
  .concurrentMap(async (file) => {
    await run("gzip", "-k", file).collect(); // wait for it, reading its output
    const before = (await Deno.stat(file)).size;
    const after = (await Deno.stat(`${file}.gz`)).size;
    return `${file}: ${before} -> ${after} bytes`;
  }, { concurrency: 2 })
  .collect();

console.log(results);
