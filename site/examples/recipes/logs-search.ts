import { enumerate, read } from "@j50n/proc";

/** The lines of a log file, unzipping it first if it ends in `.gz`. */
function logLines(path: string) {
  const bytes = read(path);
  return path.endsWith(".gz")
    ? bytes.transform(new DecompressionStream("gzip")).lines
    : bytes.lines;
}

// app.log, app.log.1.gz, app.log.2.gz, ...
const dir = "recipes-logs";
const files: string[] = [];
for await (const entry of Deno.readDir(dir)) {
  if (entry.name.startsWith("app.log")) files.push(`${dir}/${entry.name}`);
}
files.sort().reverse(); // oldest first

await enumerate(files)
  .flatMap(logLines)
  .filter((line) => line.includes(" ERROR db:"))
  .toStdout();
