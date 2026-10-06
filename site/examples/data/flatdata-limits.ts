import { enumerate, ExitCodeError } from "@j50n/proc";

const flatdata = import.meta.resolve("@j50n/proc/flatdata");
const csv = (text: string) => enumerate([new TextEncoder().encode(text)]);

// A tab inside a quoted CSV field: TSV can't hold it, so csv2tsv fails. It
// writes one line to stderr, naming the row and field, and exits with 1.
try {
  await csv('a,b\n"c\td",e\n')
    .run(
      {
        fnStderr: (stderr) => stderr.lines.collect(),
        fnError: (error, stderrLines) => {
          if (error instanceof ExitCodeError) {
            console.log(`exit code ${error.code}: ${stderrLines?.join("; ")}`);
          }
          if (error) throw error;
        },
      },
      "deno",
      "run",
      flatdata,
      "csv2tsv",
    )
    .lines
    .forEach((line) => console.log(JSON.stringify(line)));
} catch (error) {
  if (!(error instanceof ExitCodeError)) throw error;
}
