import { ExitCodeError, run } from "@j50n/proc";

/** grep and zgrep exit 1 when nothing matches; treat that as no lines. */
function noMatchIsFine(error?: Error) {
  if (error instanceof ExitCodeError && error.code === 1) return;
  if (error) throw error;
}

const logs = ["app.log.2.gz", "app.log.1.gz", "app.log"]
  .map((name) => `recipes-logs/${name}`);

for (const pattern of ["timeout", "segfault"]) {
  const hits = await run(
    { fnError: noMatchIsFine },
    "zgrep",
    "-h",
    pattern,
    ...logs,
  ).lines.collect();
  console.log(`${pattern}: ${hits.length}`, hits);
}
