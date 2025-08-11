import { type ProcessOptions, run } from "../../../mod.ts";
import { gray, red } from "jsr:@std/fmt@1.0.2/colors";

const decoratedStderr: ProcessOptions<void> = {
  fnStderr: async (stderr) => {
    for await (const line of stderr.lines) {
      console.error(`${gray(new Date().toISOString())} ${red(line)}`);
    }
  },
};

await run(
  { ...decoratedStderr },
  "bash",
  "-c",
  `
    echo "This goes to stderr." >&2 
    echo "This goes to stdout."
  `,
).toStdout();
