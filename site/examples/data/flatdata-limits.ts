import { enumerate, ExitCodeError } from "@j50n/proc";

const flatdata = import.meta.resolve("@j50n/proc/flatdata");
const csv = (text: string) => enumerate([new TextEncoder().encode(text)]);

// A tab inside a quoted CSV field: TSV can't hold it, so csv2tsv fails.
// Its error message goes to stderr, naming the row and field.
try {
  await csv('a,b\n"c\td",e\n')
    .run("deno", "run", flatdata, "csv2tsv")
    .lines
    .forEach((line) => console.log(JSON.stringify(line)));
} catch (error) {
  if (error instanceof ExitCodeError) console.log(`exit code ${error.code}`);
}
