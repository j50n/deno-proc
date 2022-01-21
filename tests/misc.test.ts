import { stdinNull } from "../inputs.ts";
import { stdoutLines } from "../outputs.ts";
import { ProcessGroup } from "../runner.ts";

Deno.test({
  name:
    "I can run a simple command and list the output (stdout) as lines of text.",
  async fn() {
    const proc = new ProcessGroup();
    try {
      const lines = await proc.run(stdinNull, stdoutLines, undefined, {
        cmd: ["ls", "-la"],
      });
      console.log();
      for await (const line of lines) {
        console.log(`\t-> "${line}"`);
      }
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "I can grab the first line of stdout from a simple process (no stdin) and close the group without errors.",
  async fn() {
    const proc = new ProcessGroup();
    try {
      const lines = await proc.run(stdinNull, stdoutLines, undefined, {
        cmd: ["ls", "-la"],
      });
      console.log();
      for await (const line of lines) {
        console.log(`\t-> "${line}"`);
        break;
      }
    } finally {
      proc.close();
    }
  },
});
