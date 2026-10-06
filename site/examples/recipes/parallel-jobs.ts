import { enumerate, run } from "@j50n/proc";

const dir = "recipes-backups";
const files: string[] = [];
for await (const entry of Deno.readDir(dir)) {
  if (entry.name.endsWith(".gz")) files.push(`${dir}/${entry.name}`);
}

/** Test one archive. A failure is returned, not thrown, so the rest go on. */
async function check(file: string) {
  try {
    await run(
      {
        fnStderr: (stderr) => stderr.lines.collect(),
        fnError: (error, stderr) => {
          if (error) throw new Error(stderr?.join(" ").trim() || error.message);
        },
      },
      "gzip",
      "-t",
      file,
    ).collect();
    return { file, problem: undefined };
  } catch (error) {
    return {
      file,
      problem: error instanceof Error ? error.message : `${error}`,
    };
  }
}

const results = await enumerate(files)
  .concurrentUnorderedMap(check, { concurrency: 4 })
  .collect();

const failed = results.filter((r) => r.problem !== undefined)
  .sort((a, b) => a.file.localeCompare(b.file));

console.log(`${results.length - failed.length} of ${results.length} are good`);
for (const { problem } of failed) console.log(problem);
